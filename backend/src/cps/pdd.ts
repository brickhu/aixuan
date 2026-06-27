import type { CPSAdapter, SearchParams, SearchResult, ProductDetail, CommissionInfo } from './adapter.js';
import { config } from '../config.js';
import { md5Sign, pddTimestamp, httpPost } from './utils.js';

const PDD_GATEWAY = 'https://gw-api.pinduoduo.com/api/router';

// parse sales_tip like "已拼1万件" -> 10000
function parseSalesCount(tip: string): number {
  if (!tip) return 0;
  const cleaned = tip.replace(/已拼|件/g, '').trim();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)([万亿]?)$/);
  if (!match) return Number(cleaned) || 0;
  const num = Number(match[1]) || 0;
  const unit = match[2];
  if (unit === '万') return Math.round(num * 10000);
  if (unit === '亿') return Math.round(num * 100000000);
  return num;
}

export const pddAdapter: CPSAdapter = {
  platform: 'pdd',

  async search(params: SearchParams): Promise<SearchResult[]> {
    const { clientId, clientSecret } = config.cps.pdd;
    if (!clientId || !clientSecret) {
      console.warn('[CPS:pdd] 拼多多多多客未配置 API Key');
      return mockSearch(params);
    }

    const sysParams: Record<string, string> = {
      type: 'pdd.ddk.goods.search',
      client_id: clientId,
      timestamp: pddTimestamp(),
      data_type: 'JSON',
      version: 'V1',
      keyword: params.keyword,
      page: String(params.page ?? 1),
      page_size: String(params.pageSize ?? 20),
    };

    // sort_type: 1=销量降序(默认), 2=佣金降序, 3=价格升序, 4=价格降序
    if (params.sortBy) {
      const sortMap: Record<string, string> = {
        price_asc: '3',
        price_desc: '4',
        sales_desc: '1',
        commission_desc: '2',
      };
      sysParams['sort_type'] = sortMap[params.sortBy] ?? '1';
    }

    // 价格参数（拼多多单位是分，需转换）
    if (params.minPrice !== undefined) sysParams['min_price'] = String(Math.round(params.minPrice * 100));
    if (params.maxPrice !== undefined) sysParams['max_price'] = String(Math.round(params.maxPrice * 100));

    // 拼多多是 append 模式
    sysParams['sign'] = md5Sign(sysParams, clientSecret, 'append');

    const data = await httpPost(PDD_GATEWAY, sysParams);
    if (!data) return [];

    const resp = data as Record<string, unknown>;
    if (resp['error_response']) {
      console.warn('[CPS:pdd] API error:', resp['error_response']);
      return [];
    }

    const searchResp = resp['goods_search_response'] as Record<string, unknown> | undefined;
    if (!searchResp) return [];

    const goodsList = searchResp['goods_list'] as Record<string, unknown>[] | undefined;
    if (!goodsList?.length) return [];

    return goodsList.map((goods) => {
      // 价格单位是分，转为元
      const minGroupPrice = (Number(goods['min_group_price']) || 0) / 100;
      const couponDiscount = (Number(goods['coupon_discount']) || 0) / 100;
      const price = Math.max(0, minGroupPrice - couponDiscount);
      const maxGroupPrice = (Number(goods['max_group_price']) || 0) / 100;

      // promotion_rate 是万分比（basis points），如 500 = 5.00%
      const commissionRate = (Number(goods['promotion_rate']) || 0) / 1000;
      const commissionAmount = Math.round(price * commissionRate * 100) / 100;

      return {
        itemId: String(goods['goods_id']),
        title: String(goods['goods_name'] ?? ''),
        price,
        originalPrice: maxGroupPrice,
        imageUrl: String(goods['goods_image_url'] ?? ''),
        salesCount: parseSalesCount(String(goods['sales_tip'] ?? '')),
        commissionRate,
        commissionAmount,
        shopName: String(goods['mall_name'] ?? ''),
        itemUrl: `https://mobile.yangkeduo.com/goods.html?goods_id=${goods['goods_id']}`,
        platform: 'pdd',
      };
    });
  },

  async getDetail(itemId: string): Promise<ProductDetail> {
    const { clientId, clientSecret } = config.cps.pdd;
    if (!clientId || !clientSecret) {
      return { itemId, title: '', price: 0, imageUrl: '', desc: '', shopName: '', platform: 'pdd' };
    }

    const sysParams: Record<string, string> = {
      type: 'pdd.ddk.goods.detail',
      client_id: clientId,
      timestamp: pddTimestamp(),
      data_type: 'JSON',
      version: 'V1',
      goods_id_list: JSON.stringify([itemId]),
    };

    sysParams['sign'] = md5Sign(sysParams, clientSecret, 'append');

    const data = await httpPost(PDD_GATEWAY, sysParams);
    if (!data) {
      return { itemId, title: '', price: 0, imageUrl: '', desc: '', shopName: '', platform: 'pdd' };
    }

    const resp = data as Record<string, unknown>;
    const detailResp = resp['goods_detail_response'] as Record<string, unknown> | undefined;
    const goodsList = detailResp?.['goods_details'] as Record<string, unknown>[] | undefined;
    const goods = goodsList?.[0];

    if (!goods) {
      return { itemId, title: '', price: 0, imageUrl: '', desc: '', shopName: '', platform: 'pdd' };
    }

    const minGroupPrice = (Number(goods['min_group_price']) || 0) / 100;
    const couponDiscount = (Number(goods['coupon_discount']) || 0) / 100;

    return {
      itemId,
      title: String(goods['goods_name'] ?? ''),
      price: Math.max(0, minGroupPrice - couponDiscount),
      originalPrice: (Number(goods['max_group_price']) || 0) / 100,
      imageUrl: String(goods['goods_image_url'] ?? ''),
      desc: String(goods['goods_desc'] ?? ''),
      salesCount: parseSalesCount(String(goods['sales_tip'] ?? '')),
      shopName: String(goods['mall_name'] ?? ''),
      platform: 'pdd',
    };
  },

  async generatePromotionLink(itemId: string): Promise<string> {
    const { clientId, clientSecret, pid } = config.cps.pdd;
    if (!clientId || !clientSecret) {
      return `https://mobile.yangkeduo.com/app.html?t=${itemId}`;
    }

    const sysParams: Record<string, string> = {
      type: 'pdd.ddk.goods.promotion.url.generate',
      client_id: clientId,
      timestamp: pddTimestamp(),
      data_type: 'JSON',
      version: 'V1',
      goods_id_list: JSON.stringify([itemId]),
      generate_short_url: 'true',
      multi_group: 'true',
    };

    if (pid) sysParams['p_id'] = pid;

    sysParams['sign'] = md5Sign(sysParams, clientSecret, 'append');

    const data = await httpPost(PDD_GATEWAY, sysParams);
    if (!data) {
      return `https://mobile.yangkeduo.com/app.html?t=${itemId}`;
    }

    const resp = data as Record<string, unknown>;
    const promoResp = resp['goods_promotion_url_generate_response'] as Record<string, unknown> | undefined;
    const urlList = promoResp?.['goods_promotion_url_list'] as Record<string, unknown>[] | undefined;
    const urlInfo = urlList?.[0];

    return String(urlInfo?.['short_url'] || urlInfo?.['mobile_url'] || '') ||
      `https://mobile.yangkeduo.com/app.html?t=${itemId}`;
  },

  async getCommission(itemId: string): Promise<CommissionInfo> {
    const detail = await this.getDetail(itemId);
    const commissionRate = detail.price > 0 ? 0.08 : 0;
    return {
      itemId,
      commissionRate,
      commissionAmount: Math.round(detail.price * commissionRate * 100) / 100,
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
