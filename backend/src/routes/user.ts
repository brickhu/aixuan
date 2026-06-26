import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { getProfile } from '../user/profile.js';
import { getPointsHistory, signIn } from '../user/points.js';

const user = new Hono<{ Variables: { userId: string } }>();

/**
 * 用户信息
 */
user.get('/profile', requireAuth, async (c) => {
  const userId = c.get('userId') as string;
  const profile = await getProfile(userId);

  if (!profile) {
    return c.json({ ok: false, error: 'User not found' }, 404);
  }

  return c.json({ ok: true, data: profile });
});

/**
 * 积分明细
 */
user.get('/points', requireAuth, async (c) => {
  const userId = c.get('userId') as string;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Number(c.req.query('pageSize')) || 20;

  const history = await getPointsHistory(userId, page, pageSize);
  return c.json({ ok: true, data: history });
});

/**
 * 每日签到
 */
user.post('/signin', requireAuth, async (c) => {
  const userId = c.get('userId') as string;
  const result = await signIn(userId);

  return c.json({ ok: true, data: result });
});

export { user };
