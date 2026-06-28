import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { tools, createToolHandler } from './tools.js';
import {
  addMessage,
  getSessionMessages,
  updateSessionSummary,
  getSessionState,
  updateSessionState,
  getSession,
} from './sessions.js';
import { getAllAdapters, type SearchParams, type SearchResult } from '../cps/adapter.js';

const anthropic = new Anthropic({
  apiKey: config.deepseekApiKey,
  baseURL: config.deepseekBaseUrl,
});

type OnChunk = (chunk: string) => void;
type OnProducts = (products: SearchResult[]) => void;

/**
 * 从回复中提取选项列表（问句中的可选答案）
 */
export function extractOptions(response: string): string[] {
  const seen = new Set<string>();
  const add = (items: string[]) => { for (const item of items) { if (item && item.length < 30) seen.add(item); } };
  const clean = (text: string) => text.replace(/^\s*\d+[\.、]\s*/, '').replace(/^\s*[A-Z][\.、\)]\s*/, '').trim();

  // 1. 提取编号选项：如 "1. xxx 2. yyy" 或 "1、xxx 2、yyy"
  const numbered = response.match(/(?:^|\n)\s*(?:\d+)[\.、]\s*([^\n]+?)(?=\s*(?:\d+)[\.、]|\s*$)/gm);
  if (numbered && numbered.length >= 2) {
    add(numbered.map(clean));
  }

  // 2. 提取字母选项：如 "A. xxx B. yyy"
  const alpha = response.match(/(?:^|\n)\s*([A-Z])[\.、\)]\s*([^\n]+?)(?=\s*(?:[A-Z])[\.、\)]|\s*$)/gm);
  if (alpha && alpha.length >= 2) {
    add(alpha.map(clean));
  }

  // 3. 扫描所有"还是"句子（不只最后一句）
  const sentences = response.split(/[。！？\n]/);
  for (const s of sentences) {
    if (!s.includes('还是')) continue;
    const parts = s.split('还是').map((p) => p.trim()).filter(Boolean);
    const cleaned = parts.map((p) => {
      return p.replace(/^(?:你想?|你?要|可以|选择|看看|推荐|比如)\s*/, '').replace(/[？?]*$/, '').trim();
    }).filter((p) => p.length > 0 && p.length < 25);
    if (cleaned.length >= 2) add(cleaned);
  }

  return [...seen];
}

/**
 * 流式对话（DeepSeek API）
 */
export async function streamChat(
  sessionId: string,
  userMessage: string,
  onChunk: OnChunk,
  onProducts?: OnProducts,
): Promise<{ content: string; structuredOptions: string[] }> {
  // 保存用户消息
  await addMessage(sessionId, 'user', userMessage, 'text');

  // 加载历史消息
  const history = await getSessionMessages(sessionId);

  // 构建 messages 数组
  const messages: Anthropic.MessageParam[] = history.map((msg) => ({
    role: msg['role'] as 'user' | 'assistant',
    content: msg['content'] as string,
  }));

  const handler = createToolHandler(async (params) => {
    const adapters = getAllAdapters();
    const platforms = params.platforms?.length
      ? params.platforms
      : ['taobao', 'jd', 'pdd', 'douyin'];

    const searchParams: SearchParams = {
      keyword: params.keyword,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      sortBy: params.sortBy as SearchParams['sortBy'],
    };

    const results = await Promise.allSettled(
      adapters
        .filter((a) => platforms.includes(a.platform))
        .map((a) => a.search(searchParams)),
    );

    const flat: SearchResult[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        flat.push(...result.value);
      } else {
        console.warn('[Agent] CPS search failed:', result.reason);
      }
    }

    const state = getSessionState(sessionId);
    updateSessionState(sessionId, {
      recommendedProducts: flat,
      clarificationStep: state.clarificationStep + 1,
    });

    return flat;
  });

  let fullResponse = '';
  const structuredOptions: string[] = [];

  try {
    const stream = anthropic.messages.stream({
      model: config.deepseekModel,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as {
          type: 'object';
          properties?: Record<string, unknown>;
        },
      })),
    });

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_delta':
          if (event.delta.type === 'text_delta') {
            fullResponse += event.delta.text;
            onChunk(event.delta.text);
          }
          break;

        case 'content_block_start':
          // 工具调用由 message_stop 统一处理，此处不追加文本
          break;

        case 'message_delta':
          if (event.delta.stop_reason === 'end_turn' || event.delta.stop_reason === 'stop_sequence') {
            // 对话结束
          }
          break;

        case 'message_stop': {
          const finalMessage = await stream.finalMessage();
          const toolUseBlocks = finalMessage.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          );

          for (const toolUse of toolUseBlocks) {
            const result = await handler(toolUse.name, toolUse.input as Record<string, unknown>);
            if (toolUse.name === 'search_products') {
              // 商品搜索结果单独通过 SSE products 事件推送前端渲染
              try {
                const products = JSON.parse(result) as SearchResult[];
                fullResponse += `\n\n`;
                onChunk(`\n\n`);
                if (products.length > 0 && onProducts) {
                  onProducts(products);
                }
              } catch {
                fullResponse += `\n\n[搜索结果]\n${result}\n\n`;
                onChunk(`\n\n[搜索结果]\n${result}\n\n`);
              }
            } else if (toolUse.name === 'clarify_requirement') {
              // 提取结构化选项，不追加到文本流——气泡中只显示 AI 自然语言问题，选项由芯片承载
              try {
                const parsed = JSON.parse(result);
                if (Array.isArray(parsed.options) && parsed.options.length > 0) {
                  structuredOptions.push(...parsed.options);
                }
              } catch {
                // ignore parse errors
              }
            } else {
              fullResponse += `\n\n${result}\n\n`;
              onChunk(`\n\n${result}\n\n`);
            }
          }
          break;
        }
      }
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    fullResponse += `\n\n抱歉，我遇到了一些问题: ${errMsg}`;
    onChunk(`\n\n抱歉，我遇到了一些问题，请稍后重试。`);
    console.error('[streamChat] Error:', error);
  }

  // 保存助手消息
  await addMessage(sessionId, 'assistant', fullResponse, 'text');

  // 更新会话摘要
  const session = await getSession(sessionId);
  if (session && !session['summary']) {
    const state = getSessionState(sessionId);
    const req = state.requirements;
    const summaryParts: string[] = [];

    if (req.category) summaryParts.push(`品类: ${req.category}`);
    if (req.budget) summaryParts.push(`预算: ¥${req.budget[0]}-${req.budget[1]}`);
    if (req.scenario) summaryParts.push(`场景: ${req.scenario}`);

    if (summaryParts.length > 0) {
      updateSessionSummary(sessionId, summaryParts.join(' | '), state.recommendedProducts.length);
    }
  }

  return { content: fullResponse, structuredOptions };
}
