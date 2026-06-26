import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/pool.js';

const history = new Hono<{ Variables: { userId: string } }>();

/**
 * 导购历史
 */
history.get('/', requireAuth, async (c) => {
  const userId = c.get('userId') as string;

  const sessions = await query(
    `SELECT s.*,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count,
      (SELECT COUNT(*) FROM products WHERE session_id = s.id) as product_count
     FROM sessions s
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT 50`,
    [userId],
  );

  return c.json({ ok: true, data: sessions.rows });
});

/**
 * 点击统计
 */
history.get('/stats/click', requireAuth, async (c) => {
  const userId = c.get('userId') as string;

  const totalResult = await query(
    'SELECT COUNT(*) as count FROM clicks WHERE user_id = $1',
    [userId],
  );
  const totalClicks = Number(totalResult.rows[0]!.count);

  const conversionResult = await query(
    'SELECT COUNT(*) as count, COALESCE(SUM(commission), 0) as total_commission FROM clicks WHERE user_id = $1 AND converted = 1',
    [userId],
  );

  return c.json({
    ok: true,
    data: {
      totalClicks,
      conversions: Number(conversionResult.rows[0]!.count),
      totalCommission: Number(conversionResult.rows[0]!.total_commission),
    },
  });
});

export { history };
