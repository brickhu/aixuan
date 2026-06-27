import { query } from '../db/pool.js';
import { randomUUID } from 'node:crypto';

export interface UserRow {
  id: string;
  email: string | null;
  nickname: string | null;
  avatar_url: string | null;
  points: number;
  total_earned: number;
  total_saved: number;
  created_at: string;
  updated_at: string;
}

/**
 * 根据邮箱查找或创建用户
 * 用户在首次验证码登录时自动创建
 */
export async function findOrCreateUserByEmail(email: string): Promise<{
  id: string;
  isNew: boolean;
}> {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);

  if (existing.rows.length > 0) {
    return { id: existing.rows[0]['id'] as string, isNew: false };
  }

  const id = randomUUID();
  await query(
    'INSERT INTO users (id, email, email_verified) VALUES ($1, $2, TRUE)',
    [id, email],
  );

  return { id, isNew: true };
}

/**
 * 根据 ID 查找用户
 */
export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await query(
    'SELECT id, email, nickname, avatar_url, points, total_earned, total_saved, created_at, updated_at FROM users WHERE id = $1',
    [id],
  );
  return result.rows.length > 0 ? (result.rows[0] as UserRow) : null;
}

/**
 * 确保用户存在（用于 optionalAuth 场景）
 */
export async function ensureUser(userId: string): Promise<void> {
  const existing = await query('SELECT id FROM users WHERE id = $1', [userId]);
  if (existing.rows.length === 0) {
    await query('INSERT INTO users (id) VALUES ($1)', [userId]);
  }
}