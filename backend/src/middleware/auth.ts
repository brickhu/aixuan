import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Context, Next } from 'hono';
import { config } from '../config.js';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks && config.cloudbase.jwksUri) {
    jwks = createRemoteJWKSet(new URL(config.cloudbase.jwksUri));
  }
  return jwks;
}

export interface CloudBaseAuthPayload {
  /** CloudBase Auth UID */
  sub: string;
  /** 自定义登录时传入的 customUserId */
  customUserId?: string;
  [key: string]: unknown;
}

/**
 * 要求用户已登录，未登录返回 401
 */
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyCloudBaseToken(token);
  if (!payload) {
    return c.json({ ok: false, error: 'Invalid or expired token' }, 401);
  }

  c.set('userId', payload.sub);
  await next();
}

/**
 * 可选登录
 */
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyCloudBaseToken(token);
    if (payload) {
      c.set('userId', payload.sub);
    }
  }
  await next();
}

/**
 * 验证 CloudBase Auth 签发的 access_token（JWT）
 * 通过 JWKS 端点获取公钥验证签名
 */
export async function verifyCloudBaseToken(
  token: string,
): Promise<CloudBaseAuthPayload | null> {
  const ks = getJwks();
  if (!ks) {
    // 未配置 CloudBase 时，开发模式允许 mock
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, ks, {
      issuer: `https://${config.cloudbase.envId}.api.tcloudbasegateway.com/auth/v1`,
    });
    return payload as CloudBaseAuthPayload;
  } catch {
    return null;
  }
}
