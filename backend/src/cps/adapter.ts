export interface SearchParams {
  keyword: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'sales_desc' | 'commission_desc';
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  itemId: string;
  title: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  salesCount?: number;
  commissionRate: number;
  commissionAmount: number;
  shopName: string;
  itemUrl: string;
  platform: string;
}

export interface ProductDetail {
  itemId: string;
  title: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  desc: string;
  salesCount?: number;
  shopName: string;
  platform: string;
}

export interface CommissionInfo {
  itemId: string;
  commissionRate: number;
  commissionAmount: number;
  platform: string;
}

export interface PlatformInfo {
  platform: string;
  name: string;
  configured: boolean;
}

export interface CPSAdapter {
  readonly platform: 'taobao' | 'jd' | 'pdd' | 'douyin';
  search(params: SearchParams): Promise<SearchResult[]>;
  getDetail(itemId: string): Promise<ProductDetail>;
  generatePromotionLink(itemId: string, pid: string): Promise<string>;
  getCommission(itemId: string): Promise<CommissionInfo>;
}

// 注册中心
const adapters = new Map<string, CPSAdapter>();

export function registerAdapter(adapter: CPSAdapter): void {
  adapters.set(adapter.platform, adapter);
}

export function getAdapter(platform: string): CPSAdapter | undefined {
  return adapters.get(platform);
}

export function getAllAdapters(): CPSAdapter[] {
  return Array.from(adapters.values());
}

export function getPlatforms(): PlatformInfo[] {
  return Array.from(adapters.values()).map((a) => ({
    platform: a.platform,
    name: platformName(a.platform),
    configured: isConfigured(a.platform),
  }));
}

function platformName(platform: string): string {
  const names: Record<string, string> = {
    taobao: '淘宝/天猫',
    jd: '京东',
    pdd: '拼多多',
    douyin: '抖音',
  };
  return names[platform] ?? platform;
}

function isConfigured(platform: string): boolean {
  // 由各适配器在注册时通过标记告知
  // 简化为仅检查是否已注册
  return adapters.has(platform);
}
