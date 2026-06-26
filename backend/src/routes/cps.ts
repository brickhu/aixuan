import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { getAdapter, getPlatforms } from '../cps/adapter.js';
import { query } from '../db/pool.js';

const cps = new Hono<{ Variables: { userId: string } }>();

/**
 * 生成推广链接
 */
cps.post('/link', optionalAuth, async (c) => {
  const { platform, itemId, pid } = await c.req.json<{
    platform: string;
    itemId: string;
    pid?: string;
  }>();

  if (!platform || !itemId) {
    return c.json({ ok: false, error: 'platform and itemId are required' }, 400);
  }

  const adapter = getAdapter(platform);
  if (!adapter) {
    return c.json({ ok: false, error: `Unsupported platform: ${platform}` }, 400);
  }

  const clickUrl = await adapter.generatePromotionLink(itemId, pid ?? '');
  const userId = c.get('userId') as string | undefined;
  const sessionId = c.req.header('X-Session-Id');

  // 记录点击
  const clickId = uuid();
  await query(
    `INSERT INTO clicks (id, user_id, session_id, product_id, platform, click_url, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      clickId,
      userId ?? null,
      sessionId ?? null,
      itemId,
      platform,
      clickUrl,
      c.req.header('X-Forwarded-For') ?? c.req.header('x-real-ip') ?? null,
      c.req.header('User-Agent') ?? null,
    ],
  );

  return c.json({
    ok: true,
    data: {
      clickId,
      clickUrl,
      platform,
    },
  });
});

/**
 * 支持的平台列表
 */
cps.get('/platforms', (c) => {
  const platforms = getPlatforms();
  return c.json({ ok: true, data: platforms });
});

export { cps };
