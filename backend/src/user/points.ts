import { v4 as uuid } from 'uuid';
import { query } from '../db/pool.js';

export type PointTransactionType = 'signin' | 'share' | 'purchase' | 'redeem';

export interface PointTransaction {
  id: string;
  user_id: string;
  points: number;
  type: PointTransactionType;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}

/**
 * 增加积分
 */
export async function addPoints(
  userId: string,
  points: number,
  type: PointTransactionType,
  referenceId?: string,
  note?: string,
): Promise<void> {
  const id = uuid();

  await query(
    `INSERT INTO point_transactions (id, user_id, points, type, reference_id, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, points, type, referenceId ?? null, note ?? null],
  );

  await query('UPDATE users SET points = points + $1, updated_at = NOW() WHERE id = $2', [
    points,
    userId,
  ]);
}

/**
 * 消费积分，余额不足返回 false
 */
export async function spendPoints(
  userId: string,
  points: number,
  note: string,
): Promise<boolean> {
  const balance = await getPointsBalance(userId);
  if (balance < points) return false;

  await addPoints(userId, -points, 'redeem', undefined, note);
  return true;
}

/**
 * 获取积分余额
 */
export async function getPointsBalance(userId: string): Promise<number> {
  const result = await query('SELECT points FROM users WHERE id = $1', [userId]);
  return (result.rows[0] as { points?: number })?.points ?? 0;
}

/**
 * 获取积分明细（分页）
 */
export async function getPointsHistory(
  userId: string,
  page = 1,
  pageSize = 20,
): Promise<{ items: PointTransaction[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const countResult = await query(
    'SELECT COUNT(*) as count FROM point_transactions WHERE user_id = $1',
    [userId],
  );
  const total = Number(countResult.rows[0]!.count);

  const itemsResult = await query(
    `SELECT * FROM point_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, pageSize, offset],
  );

  return { items: itemsResult.rows as PointTransaction[], total };
}

/**
 * 每日签到
 */
export async function signIn(
  userId: string,
): Promise<{ claimed: boolean; points: number }> {
  const today = await query(
    `SELECT id FROM point_transactions
     WHERE user_id = $1 AND type = 'signin' AND created_at::date = CURRENT_DATE`,
    [userId],
  );

  if (today.rows.length > 0) {
    return { claimed: false, points: 0 };
  }

  await addPoints(userId, 5, 'signin');
  return { claimed: true, points: 5 };
}
