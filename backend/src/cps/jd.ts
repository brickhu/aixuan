import type { CPSAdapter, SearchParams, SearchResult, ProductDetail, CommissionInfo } from './adapter.js';
import { config } from '../config.js';
import { md5Sign, formatTimestamp, httpPost } from './utils.js';

const JD_GATEWAY = 'https://api.jd.com/routerjson';

// Helper to convert sortBy to JD's sort field names
function mapSort(sortBy?: string): string {
  const map: Record<string, string> = {
    price_asc: 'priceAsc',
    price_desc: 'priceDesc',
    sales_desc: 'inOrderCountDesc',
    commission_desc: 'commissionDesc',
  };
  return map[sortBy ?? ''] || '';
}

export const jdAdapter: CPSAdapter = {
  platform: 'jd',

  async search(params: SearchParams): Promise<SearchResult[]> {
    const { appKey, appSecret } = config.cps.jd;
    if (!appKey || !appSecret) {
      console.warn('[CPS:jd] 京东联盟未配置 API Key');
      return mockSearch(params);
    }

    const bizParams: Record<string, unknown> = {
      keyword: params.keyword,
      pageIndex: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
    };

    if (params.minPrice !== undefined) bizParams['minPrice'] = params.minPrice;
    if (params.maxPrice !== undefined) bizParams['maxPrice'] = params.maxPrice;
    if (params.sortBy) {
      const s = mapSort(params.sortBy);
      if (s) bizParams['sort'] = s;
    }

    const sysParams: Record<string, string> = {
      method: 'jd.union.open.search.goods',
      app_key: appKey,
      timestamp: formatTimestamp(),
      format: 'json',
      v: '1.0',
      sign_method: 'md5',
      '360buy_param_json': JSON.stringify(bizParams),
    };

    sysParams['sign'] = md5Sign(sysParams, appSecret, 'prepend');

    const data = await httpPost(JD_GATEWAY, sysParams);
    if (!data) return [];

    const resp = data as Record<string, unknown>;
    if (resp['error_response']) {
      console.warn('[CPS:jd] API error:', resp['error_response']);
      return [];
    }

    const searchResp = resp['jd_union_open_search_goods_response'] as Record<string, unknown> | undefined;
    if (!searchResp) return [];

    // JD API 返回的 result 是对象，包含 goodsList 数组
    const resultObj = searchResp['result'] as Record<string, unknown> | undefined;
    const result = (resultObj?.['goodsList'] ?? []) as Record<string, unknown>[];
    if (!result.length) return [];

    return result.map((item) => {
      const priceInfo = item['priceInfo'] as Record<string, unknown> | undefined;
      const price = Number((priceInfo?.['lowPrice'] ?? priceInfo?.['price'])) || 0;
      const originalPrice = Number(priceInfo?.['price']) || price;
      const imageInfo = item['imageInfo'] as Record<string, unknown> | undefined;
      const mainImage = imageInfo?.['mainImage'] as Record<string, unknown>[] | undefined;
      const imageUrl = mainImage?.[0]?.['url'] as string | undefined ?? '';
      const shopInfo = item['shopInfo'] as Record<string, unknown> | undefined;
      const commissionInfo = item['commissionInfo'] as Record<string, unknown> | undefined;
      const commissionRate = (Number(commissionInfo?.['commissionRate']) || 0) / 100;

      return {
        itemId: String(item['skuId']),
        title: String(item['skuName'] ?? ''),
        price,
        originalPrice,
        imageUrl: String(imageUrl),
        salesCount: Number(item['inOrderCount30Days']) || 0,
        commissionRate,
        commissionAmount: Number(commissionInfo?.['commission']) || 0,
        shopName: String(shopInfo?.['shopName'] ?? ''),
        itemUrl: String(item['materialUrl'] ?? ''),
        platform: 'jd',
      };
    });
  },

  async getDetail(itemId: string): Promise<ProductDetail> {
    const { appKey, appSecret } = config.cps.jd;
    if (!appKey || !appSecret) {
      return { itemId, title: '', price: 0, imageUrl: '', desc: '', shopName: '', platform: 'jd' };
    }

    const sysParams: Record<string, string> = {
      method: 'jd.union.open.goods.material.query',
      app_key: appKey,
      timestamp: formatTimestamp(),
      format: 'json',
      v: '1.0',
      sign_method: 'md5',
      '360buy_param_json': JSON.stringify({ skuIds: [itemId] }),
    };

    sysParams['sign'] = md5Sign(sysParams, appSecret, 'prepend');

    const data = await httpPost(JD_GATEWAY, sysParams);
    if (!data) {
      return { itemId, title: '', price: 0, imageUrl: '', desc: '', shopName: '', platform: 'jd' };
    }

    const resp = data as Record<string, unknown>;
    const queryResp = resp['jd_union_open_goods_material_query_response'] as Record<string, unknown> | undefined;
    const result = queryResp?.['result'] as Record<string, unknown>[] | undefined;
    const item = result?.[0];

    if (!item) {
      return { itemId, title: '', price: 0, imageUrl: '', desc: '', shopName: '', platform: 'jd' };
    }

    const priceInfo = item['priceInfo'] as Record<string, unknown> | undefined;
    const imageInfo = item['imageInfo'] as Record<string, unknown> | undefined;
    const mainImage = imageInfo?.['mainImage'] as Record<string, unknown>[] | undefined;
    const shopInfo = item['shopInfo'] as Record<string, unknown> | undefined;

    return {
      itemId,
      title: String(item['skuName'] ?? ''),
      price: Number(priceInfo?.['lowPrice'] ?? priceInfo?.['price']) || 0,
      originalPrice: Number(priceInfo?.['price']) || 0,
      imageUrl: String((mainImage?.[0]?.['url'] as string | undefined) ?? ''),
      desc: String(item['skuName'] ?? ''),
      salesCount: Number(item['inOrderCount30Days']) || 0,
      shopName: String(shopInfo?.['shopName'] ?? ''),
      platform: 'jd',
    };
  },

  async generatePromotionLink(itemId: string): Promise<string> {
    const { appKey, appSecret } = config.cps.jd;
    if (!appKey || !appSecret) {
      return `https://union.jd.com/redirect?to=${itemId}`;
    }

    const sysParams: Record<string, string> = {
      method: 'jd.union.open.promotion.batch.get',
      app_key: appKey,
      timestamp: formatTimestamp(),
      format: 'json',
      v: '1.0',
      sign_method: 'md5',
      '360buy_param_json': JSON.stringify({
        materialIds: [`https://item.jd.com/${itemId}.html`],
        siteId: 'default',
        positionId: 1,
      }),
    };

    sysParams['sign'] = md5Sign(sysParams, appSecret, 'prepend');

    const data = await httpPost(JD_GATEWAY, sysParams);
    if (!data) {
      return `https://union.jd.com/redirect?to=${itemId}`;
    }

    const resp = data as Record<string, unknown>;
    const promoResp = resp['jd_union_open_promotion_batch_get_response'] as Record<string, unknown> | undefined;
    const result = promoResp?.['result'] as Record<string, unknown>[] | undefined;
    const clickURL = result?.[0]?.['clickURL'] as string | undefined;

    return clickURL || `https://union.jd.com/redirect?to=${itemId}`;
  },

  async getCommission(itemId: string): Promise<CommissionInfo> {
    const detail = await this.getDetail(itemId);
    const commissionRate = 0.03;
    return {
      itemId,
      commissionRate,
      commissionAmount: Math.round(detail.price * commissionRate * 100) / 100,
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
