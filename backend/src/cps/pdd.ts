import type { CPSAdapter, SearchParams, SearchResult, ProductDetail, CommissionInfo } from './adapter.js';
import { config } from '../config.js';

export const pddAdapter: CPSAdapter = {
  platform: 'pdd',

  async search(params: SearchParams): Promise<SearchResult[]> {
    if (!config.cps.pdd.apiKey) {
      console.warn('[CPS:pdd] 拼多多多多客未配置 API Key');
      return mockSearch(params);
    }
    // TODO: 接入多多客 API
    return mockSearch(params);
  },

  async getDetail(itemId: string): Promise<ProductDetail> {
    return {
      itemId,
      title: '示例商品',
      price: 59.0,
      imageUrl: '',
      desc: '',
      shopName: '拼多多示例店铺',
      platform: 'pdd',
    };
  },

  async generatePromotionLink(itemId: string, _pid: string): Promise<string> {
    return `https://mobile.yangkeduo.com/app.html?t=${itemId}`;
  },

  async getCommission(itemId: string): Promise<CommissionInfo> {
    return {
      itemId,
      commissionRate: 0.08,
      commissionAmount: 4.72,
      platform: 'pdd',
    };
  },
};

function mockSearch(params: SearchParams): SearchResult[] {
  return [
    {
      itemId: 'pdd_001',
      title: `【示例】${params.keyword} - 拼多多爆款`,
      price: 59.0,
      originalPrice: 119.0,
      imageUrl: '',
      salesCount: 50000,
      commissionRate: 0.08,
      commissionAmount: 4.72,
      shopName: '拼多多示例店铺',
      itemUrl: '',
      platform: 'pdd',
    },
  ];
}
