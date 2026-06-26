import type { CPSAdapter, SearchParams, SearchResult, ProductDetail, CommissionInfo } from './adapter.js';
import { config } from '../config.js';

export const taobaoAdapter: CPSAdapter = {
  platform: 'taobao',

  async search(params: SearchParams): Promise<SearchResult[]> {
    const { appKey, appSecret, pid } = config.cps.taobao;
    if (!appKey || !appSecret || !pid) {
      console.warn('[CPS:taobao] 淘宝客未配置 API 密钥');
      return mockSearch(params);
    }

    // TODO: 实现淘宝客 taobao.tbk.dg.material.optional 接口调用
    // 需要实现 MD5 签名算法
    console.warn('[CPS:taobao] 淘宝客 API 待接入');
    return mockSearch(params);
  },

  async getDetail(itemId: string): Promise<ProductDetail> {
    return {
      itemId,
      title: '示例商品',
      price: 99.0,
      imageUrl: '',
      desc: '',
      shopName: '示例店铺',
      platform: 'taobao',
    };
  },

  async generatePromotionLink(itemId: string, _pid: string): Promise<string> {
    // TODO: 调用转链接口
    return `https://s.click.taobao.com/t?e=placeholder&id=${itemId}`;
  },

  async getCommission(itemId: string): Promise<CommissionInfo> {
    return {
      itemId,
      commissionRate: 0.05,
      commissionAmount: 4.95,
      platform: 'taobao',
    };
  },
};

function mockSearch(params: SearchParams): SearchResult[] {
  return [
    {
      itemId: 'tb_001',
      title: `【示例】${params.keyword} - 商品A`,
      price: 99.0,
      originalPrice: 199.0,
      imageUrl: '',
      salesCount: 10000,
      commissionRate: 0.05,
      commissionAmount: 4.95,
      shopName: '淘宝示例店铺',
      itemUrl: '',
      platform: 'taobao',
    },
  ];
}
