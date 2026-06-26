import type { SearchResult } from '../cps/adapter.js';

export const TOOL_SEARCH_PRODUCTS = {
  name: 'search_products',
  description: '根据用户需求搜索多个平台上的商品',
  input_schema: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '搜索关键词' },
      minPrice: { type: 'number' },
      maxPrice: { type: 'number' },
      platforms: {
        type: 'array',
        items: { type: 'string', enum: ['taobao', 'jd', 'pdd', 'douyin'] },
        description: '要搜索的平台，默认全平台',
      },
      sortBy: {
        type: 'string',
        enum: ['price_asc', 'price_desc', 'sales_desc', 'commission_desc'],
      },
    },
    required: ['keyword'],
  },
};

export const TOOL_CLARIFY_REQUIREMENT = {
  name: 'clarify_requirement',
  description: '向用户提出一个引导性问题，帮助明确购买需求',
  input_schema: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: '建议的选项，仅当问题适合用选择题形式',
      },
    },
    required: ['question'],
  },
};

export const tools = [TOOL_SEARCH_PRODUCTS, TOOL_CLARIFY_REQUIREMENT];

export type ToolHandler = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<string>;

export function createToolHandler(
  searchFn: (params: {
    keyword: string;
    minPrice?: number;
    maxPrice?: number;
    platforms?: string[];
    sortBy?: string;
  }) => Promise<SearchResult[]>,
): ToolHandler {
  return async (toolName, args) => {
    switch (toolName) {
      case 'search_products': {
        const results = await searchFn(args as Parameters<typeof searchFn>[0]);
        return JSON.stringify(results);
      }
      case 'clarify_requirement': {
        return JSON.stringify({
          question: args['question'],
          options: args['options'] ?? [],
        });
      }
      default:
        return JSON.stringify({ error: `未知工具: ${toolName}` });
    }
  };
}
