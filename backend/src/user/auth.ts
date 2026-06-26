import { query } from '../db/pool.js';
import type { CloudBaseAuthPayload } from '../middleware/auth.js';

export interface UserRow {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  points: number;
  total_earned: number;
  total_saved: number;
  created_at: string;
  updated_at: string;
}

/**
 * 同步 CloudBase Auth 用户到本地数据库
 * 当用户首次登录时自动创建记录
 */
export async function syncUser(payload: CloudBaseAuthPayload): Promise<{
  id: string;
  isNew: boolean;
}> {
  const existing = await query('SELECT id FROM users WHERE id = $1', [
    payload.sub,
  ]);

  if (existing.rows.length > 0) {
    // 更新昵称和头像（CloudBase JWT payload 可能包含这些字段）
    if (payload.nickname || payload.picture) {
      await query(
        `UPDATE users SET
          nickname = COALESCE(NULLIF($1, ''), nickname),
          avatar_url = COALESCE(NULLIF($2, ''), avatar_url),
          updated_at = NOW()
        WHERE id = $3`,
        [
          (payload.nickname as string) ?? null,
          (payload.picture as string) ?? null,
          payload.sub,
        ],
      );
    }
    return { id: payload.sub, isNew: false };
  }

  await query(
    'INSERT INTO users (id, nickname, avatar_url) VALUES ($1, $2, $3)',
    [
      payload.sub,
      (payload.nickname as string) ?? null,
      (payload.picture as string) ?? null,
    ],
  );

  return { id: payload.sub, isNew: true };
}

/**
 * 确保用户存在（用于 optionalAuth 场景：未登录用户创建匿名记录）
 */
export async function ensureUser(userId: string): Promise<void> {
  const existing = await query('SELECT id FROM users WHERE id = $1', [userId]);
  if (existing.rows.length === 0) {
    await query('INSERT INTO users (id) VALUES ($1)', [userId]);
  }
}
