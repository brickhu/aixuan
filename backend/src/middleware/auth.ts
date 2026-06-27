import type { Context, Next } from 'hono';
import { verifyToken } from '../auth/jwt.js';

/**
 * 要求用户已登录，未登录返回 401
 */
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ ok: false, error: 'Invalid or expired token' }, 401);
  }

  c.set('userId', payload.sub);
  await next();
}

/**
 * 可选登录 — 未登录不报错，有 token 则尝试解析
 */
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    if (payload) {
      c.set('userId', payload.sub);
    }
  }
  await next();
}