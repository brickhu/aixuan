import type { CPSAdapter, SearchParams, SearchResult, ProductDetail, CommissionInfo } from './adapter.js';

export const douyinAdapter: CPSAdapter = {
  platform: 'douyin',

  async search(_params: SearchParams): Promise<SearchResult[]> {
    console.warn('[CPS:douyin] 抖音抖客暂未接入');
    return [];
  },

  async getDetail(_itemId: string): Promise<ProductDetail> {
    throw new Error('抖音抖客暂未接入');
  },

  async generatePromotionLink(_itemId: string, _pid: string): Promise<string> {
    throw new Error('抖音抖客暂未接入');
  },

  async getCommission(_itemId: string): Promise<CommissionInfo> {
    throw new Error('抖音抖客暂未接入');
  },
};
