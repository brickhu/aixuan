import { Hono } from 'hono';
import { verifyCloudBaseToken } from '../middleware/auth.js';
import { syncUser } from '../user/auth.js';

const auth = new Hono<{ Variables: { userId: string } }>();

/**
 * 使用 access_token 登录/注册
 * 前端在 CloudBase Auth 完成登录后拿到 access_token，
 * 传给此接口，后端验证 token 并在本地同步用户
 */
auth.post('/login', async (c) => {
  const { accessToken } = await c.req.json<{ accessToken: string }>();

  if (!accessToken) {
    return c.json({ ok: false, error: 'Missing accessToken' }, 400);
  }

  const payload = await verifyCloudBaseToken(accessToken);
  if (!payload) {
    return c.json({ ok: false, error: 'Invalid token' }, 401);
  }

  const user = await syncUser(payload);

  return c.json({
    ok: true,
    data: {
      userId: user.id,
      isNew: user.isNew,
    },
  });
});

/**
 * 获取当前用户信息（token 中的基本信息）
 */
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyCloudBaseToken(token);
  if (!payload) {
    return c.json({ ok: false, error: 'Invalid token' }, 401);
  }

  return c.json({
    ok: true,
    data: {
      uid: payload.sub,
      customUserId: payload.customUserId,
    },
  });
});

export { auth };
