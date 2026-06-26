import { query } from '../db/pool.js';

export interface UserProfile {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  points: number;
  total_earned: number;
  total_saved: number;
  session_count: number;
  created_at: string;
}

/**
 * 获取用户资料 + 统计信息
 */
export async function getProfile(userId: string): Promise<UserProfile | null> {
  const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) return null;

  const user = userResult.rows[0]!;

  const sessionResult = await query(
    'SELECT COUNT(*) as count FROM sessions WHERE user_id = $1',
    [userId],
  );
  const sessionCount = Number(sessionResult.rows[0]!.count);

  return {
    id: user.id,
    nickname: (user.nickname as string) ?? null,
    avatar_url: (user.avatar_url as string) ?? null,
    points: (user.points as number) ?? 0,
    total_earned: (user.total_earned as number) ?? 0,
    total_saved: (user.total_saved as number) ?? 0,
    session_count: sessionCount,
    created_at: user.created_at as string,
  };
}
