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

/**
 * 流式对话（DeepSeek API）
 */
export async function streamChat(
  sessionId: string,
  userMessage: string,
  onChunk: OnChunk,
): Promise<void> {
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
          if (event.content_block.type === 'tool_use') {
            fullResponse += `\n\n[使用工具: ${event.content_block.name}]\n\n`;
          }
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
            fullResponse += `\n\n[工具结果]\n${result}\n\n`;
            onChunk(`\n\n[工具结果]\n${result}\n\n`);
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
}
