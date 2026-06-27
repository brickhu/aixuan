import type { CPSAdapter, SearchParams, SearchResult, ProductDetail, CommissionInfo } from './adapter.js';
import { config } from '../config.js';
import { md5Sign, formatTimestamp, parseTaobaoPid, httpPost } from './utils.js';

const TAOBAO_GATEWAY = 'https://gw.api.taobao.com/router/rest';

export const taobaoAdapter: CPSAdapter = {
  platform: 'taobao',

  async search(params: SearchParams): Promise<SearchResult[]> {
    const { appKey, appSecret, pid } = config.cps.taobao;
    if (!appKey || !appSecret || !pid) {
      console.warn('[CPS:taobao] 淘宝客未配置 API 密钥');
      return mockSearch(params);
    }

    const pidInfo = parseTaobaoPid(pid);
    if (!pidInfo) {
      console.warn('[CPS:taobao] 淘宝 PID 格式无效:', pid);
      return mockSearch(params);
    }

    const sysParams: Record<string, string> = {
      method: 'taobao.tbk.dg.material.optional',
      app_key: appKey,
      timestamp: formatTimestamp(),
      format: 'json',
      v: '2.0',
      sign_method: 'md5',
      adzone_id: pidInfo.adzoneId,
      q: params.keyword,
      page_no: String(params.page ?? 1),
      page_size: String(params.pageSize ?? 20),
    };

    if (params.minPrice !== undefined) sysParams['start_price'] = String(params.minPrice);
    if (params.maxPrice !== undefined) sysParams['end_price'] = String(params.maxPrice);
    if (params.sortBy) {
      const sortMap: Record<string, string> = {
        price_asc: 'price_asc',
        price_desc: 'price_desc',
        sales_desc: 'tk_total_sales',
        commission_desc: 'tk_rate_desc',
      };
      sysParams['sort'] = sortMap[params.sortBy] ?? 'tk_total_sales';
    }

    sysParams['sign'] = md5Sign(sysParams, appSecret, 'prepend');

    const data = await httpPost(TAOBAO_GATEWAY, sysParams);
    if (!data) return [];

    const resp = data as Record<string, unknown>;
    if (resp['error_response']) {
      console.warn('[CPS:taobao] API error:', resp['error_response']);
      return [];
    }

    const searchResp = resp['tbk_dg_material_optional_response'] as Record<string, unknown> | undefined;
    if (!searchResp) return [];

    const resultList = searchResp['result_list'] as Record<string, unknown> | undefined;
    if (!resultList) return [];

    const itemList = resultList['item_list'] as Record<string, unknown>[] | undefined;
    if (!itemList?.length) return [];

    return itemList.map((item) => {
      const rawPrice = Number(item['zk_final_price']) || 0;
      const couponAmount = Number(item['coupon_amount']) || 0;
      const price = Math.max(0, rawPrice - couponAmount);
      const commissionRate = (Number(item['commission_rate']) || 0) / 100;
      const commissionAmount = Math.round(price * commissionRate * 100) / 100;

      return {
        itemId: String(item['item_id']),
        title: String(item['title'] ?? ''),
        price,
        originalPrice: Number(item['reserve_price']) || rawPrice,
        imageUrl: String(item['pict_url'] ?? ''),
        salesCount: Number(item['tk_total_sales']) || 0,
        commissionRate,
        commissionAmount,
        shopName: String(item['shop_title'] ?? ''),
        itemUrl: String(item['item_url'] ?? `https://item.taobao.com/item.htm?id=${item['item_id']}`),
        platform: 'taobao',
      };
    });
  },

  async getDetail(itemId: string): Promise<ProductDetail> {
    const { appKey, appSecret } = config.cps.taobao;
    if (!appKey || !appSecret) {
      return { itemId, title: '', price: 0, imageUrl: '', desc: '', shopName: '', platform: 'taobao' };
    }

    const sysParams: Record<string, string> = {
      method: 'taobao.tbk.item.info.get',
      app_key: appKey,
      timestamp: formatTimestamp(),
      format: 'json',
      v: '2.0',
      sign_method: 'md5',
      num_iids: itemId,
    };

    sysParams['sign'] = md5Sign(sysParams, appSecret, 'prepend');

    const data = await httpPost(TAOBAO_GATEWAY, sysParams);
    if (!data) {
      return { itemId, title: '', price: 0, imageUrl: '', desc: '', shopName: '', platform: 'taobao' };
    }

    const resp = data as Record<string, unknown>;
    const detailResp = resp['tbk_item_info_get_response'] as Record<string, unknown> | undefined;
    const results = detailResp?.['results'] as Record<string, unknown> | undefined;
    const items = results?.['n_tbk_item'] as Record<string, unknown>[] | undefined;
    const item = items?.[0];

    if (!item) {
      return { itemId, title: '', price: 0, imageUrl: '', desc: '', shopName: '', platform: 'taobao' };
    }

    return {
      itemId,
      title: String(item['title'] ?? ''),
      price: Number(item['zk_final_price']) || 0,
      originalPrice: Number(item['reserve_price']) || 0,
      imageUrl: String(item['pict_url'] ?? ''),
      desc: String(item['item_description'] ?? ''),
      salesCount: Number(item['tk_total_sales']) || 0,
      shopName: String(item['nick'] ?? ''),
      platform: 'taobao',
    };
  },

  async generatePromotionLink(itemId: string): Promise<string> {
    const { appKey, appSecret, pid } = config.cps.taobao;
    if (!appKey || !appSecret || !pid) {
      return `https://s.click.taobao.com/t?e=placeholder&id=${itemId}`;
    }

    const pidInfo = parseTaobaoPid(pid);
    if (!pidInfo) {
      return `https://s.click.taobao.com/t?e=placeholder&id=${itemId}`;
    }

    const sysParams: Record<string, string> = {
      method: 'taobao.tbk.privilege.get',
      app_key: appKey,
      timestamp: formatTimestamp(),
      format: 'json',
      v: '2.0',
      sign_method: 'md5',
      item_id: itemId,
      adzone_id: pidInfo.adzoneId,
      site_id: pidInfo.siteId,
      platform: '2',
    };

    sysParams['sign'] = md5Sign(sysParams, appSecret, 'prepend');

    const data = await httpPost(TAOBAO_GATEWAY, sysParams);
    if (!data) {
      return `https://s.click.taobao.com/t?e=fallback&id=${itemId}`;
    }

    const resp = data as Record<string, unknown>;
    const privResp = resp['tbk_privilege_get_response'] as Record<string, unknown> | undefined;
    const result = privResp?.['result'] as Record<string, unknown> | undefined;
    const resultData = result?.['data'] as Record<string, unknown> | undefined;

    return String(resultData?.['coupon_click_url'] || resultData?.['click_url'] || '') ||
      `https://s.click.taobao.com/t?e=fallback&id=${itemId}`;
  },

  async getCommission(itemId: string): Promise<CommissionInfo> {
    // 从详情获取价格，用默认佣金率估算
    const detail = await this.getDetail(itemId);
    const commissionRate = 0.05; // 默认 5%
    return {
      itemId,
      commissionRate,
      commissionAmount: Math.round(detail.price * commissionRate * 100) / 100,
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
