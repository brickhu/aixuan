import { createHash } from 'node:crypto';

/**
 * MD5 签名
 * @param params 参与签名的参数（已排序或未排序）
 * @param secret 密钥
 * @param mode prepend — 淘宝/京东模式（secret + 排序串）, append — 拼多多模式（排序串 + secret）
 */
export function md5Sign(
  params: Record<string, string>,
  secret: string,
  mode: 'prepend' | 'append' = 'prepend',
): string {
  const keys = Object.keys(params).sort();
  let raw = '';
  for (const k of keys) {
    raw += k + params[k]!;
  }
  const input = mode === 'prepend' ? secret + raw : raw + secret;
  return createHash('md5').update(input).digest('hex').toUpperCase();
}

/**
 * 格式化为淘宝/京东要求的 yyyy-MM-dd HH:mm:ss 时间戳
 */
export function formatTimestamp(date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 拼多多时间戳（Unix 秒）
 */
export function pddTimestamp(date = new Date()): string {
  return String(Math.floor(date.getTime() / 1000));
}

/**
 * 解析淘宝 PID（格式: mm_{siteId}_{adzoneId}）
 */
export function parseTaobaoPid(pid: string): { siteId: string; adzoneId: string } | null {
  const parts = pid.split('_');
  if (parts.length >= 3 && parts[0] === 'mm') {
    return { siteId: parts[1]!, adzoneId: parts.slice(2).join('_') };
  }
  return null;
}

/**
 * form-encoded POST 请求封装
 * 返回解析后的 JSON，网络错误或非 200 返回 null
 */
export async function httpPost(
  url: string,
  params: Record<string, string>,
  timeoutMs = 10_000,
): Promise<unknown | null> {
  const body = new URLSearchParams(params).toString();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.warn(`[CPS] HTTP ${res.status} from ${url}`);
      return null;
    }
    return (await res.json()) as unknown;
  } catch (err) {
    console.warn(`[CPS] Request failed: ${url}`, err instanceof Error ? err.message : err);
    return null;
  }
}
