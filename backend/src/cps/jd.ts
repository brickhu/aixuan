import type { CPSAdapter, SearchParams, SearchResult, ProductDetail, CommissionInfo } from './adapter.js';
import { config } from '../config.js';

export const jdAdapter: CPSAdapter = {
  platform: 'jd',

  async search(params: SearchParams): Promise<SearchResult[]> {
    if (!config.cps.jd.apiKey) {
      console.warn('[CPS:jd] 京东联盟未配置 API Key');
      return mockSearch(params);
    }
    // TODO: 接入京东联盟 Open API
    return mockSearch(params);
  },

  async getDetail(itemId: string): Promise<ProductDetail> {
    return {
      itemId,
      title: '示例商品',
      price: 129.0,
      imageUrl: '',
      desc: '',
      shopName: '京东示例店铺',
      platform: 'jd',
    };
  },

  async generatePromotionLink(itemId: string, _pid: string): Promise<string> {
    return `https://union.jd.com/redirect?to=${itemId}`;
  },

  async getCommission(itemId: string): Promise<CommissionInfo> {
    return {
      itemId,
      commissionRate: 0.03,
      commissionAmount: 3.87,
      platform: 'jd',
    };
  },
};

function mockSearch(params: SearchParams): SearchResult[] {
  return [
    {
      itemId: 'jd_001',
      title: `【示例】${params.keyword} - 京东优选`,
      price: 129.0,
      originalPrice: 259.0,
      imageUrl: '',
      salesCount: 5000,
      commissionRate: 0.03,
      commissionAmount: 3.87,
      shopName: '京东示例店铺',
      itemUrl: '',
      platform: 'jd',
    },
  ];
}
