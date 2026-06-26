import { v4 as uuid } from 'uuid';
import { query } from '../db/pool.js';
import type { SearchResult } from '../cps/adapter.js';

export interface SessionState {
  requirements: {
    budget?: [number, number];
    category?: string;
    scenario?: string;
    brand?: string[];
    features?: string[];
    platform?: string[];
  };
  clarificationStep: number;
  recommendedProducts: SearchResult[];
  userSelected?: SearchResult;
}

const inMemoryStates = new Map<string, SessionState>();

function defaultState(): SessionState {
  return {
    requirements: {},
    clarificationStep: 0,
    recommendedProducts: [],
  };
}

export async function createSession(userId?: string): Promise<string> {
  const id = uuid();

  await query(
    'INSERT INTO sessions (id, user_id, status) VALUES ($1, $2, $3)',
    [id, userId ?? null, 'active'],
  );

  inMemoryStates.set(id, defaultState());
  return id;
}

export async function getSession(
  sessionId: string,
): Promise<Record<string, unknown> | null> {
  const result = await query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
  return (result.rows[0] as Record<string, unknown>) ?? null;
}

export function getSessionState(sessionId: string): SessionState {
  if (!inMemoryStates.has(sessionId)) {
    inMemoryStates.set(sessionId, defaultState());
  }
  return inMemoryStates.get(sessionId)!;
}

export function updateSessionState(
  sessionId: string,
  state: Partial<SessionState>,
): void {
  const current = getSessionState(sessionId);
  inMemoryStates.set(sessionId, { ...current, ...state });
}

export async function listUserSessions(
  userId: string,
): Promise<Record<string, unknown>[]> {
  const result = await query(
    'SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId],
  );
  return result.rows as Record<string, unknown>[];
}

export async function endSession(sessionId: string): Promise<void> {
  await query(
    "UPDATE sessions SET status = 'completed', updated_at = NOW() WHERE id = $1",
    [sessionId],
  );
}

export async function updateSessionSummary(
  sessionId: string,
  summary: string,
  productCount: number,
): Promise<void> {
  await query(
    'UPDATE sessions SET summary = $1, product_count = $2, updated_at = NOW() WHERE id = $3',
    [summary, productCount, sessionId],
  );
}

export async function getSessionMessages(
  sessionId: string,
): Promise<Record<string, unknown>[]> {
  const result = await query(
    'SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId],
  );
  return result.rows as Record<string, unknown>[];
}

export async function addMessage(
  sessionId: string,
  role: string,
  content: string,
  msgType = 'text',
  metadata?: Record<string, unknown>,
): Promise<string> {
  const id = uuid();
  await query(
    `INSERT INTO messages (id, session_id, role, content, msg_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, sessionId, role, content, msgType, metadata ? JSON.stringify(metadata) : null],
  );
  return id;
}
