import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { streamChat } from '../agent/agent.js';
import {
  createSession,
  getSession,
  getSessionMessages,
  listUserSessions,
} from '../agent/sessions.js';

type Variables = { userId: string };

const chat = new Hono<{ Variables: Variables }>();

/**
 * 创建新会话
 */
chat.post('/session', optionalAuth, async (c) => {
  const userId: string | undefined = c.get('userId');
  const sessionId = await createSession(userId);

  return c.json({ ok: true, data: { sessionId } });
});

/**
 * 发送消息（SSE 流式返回）
 */
chat.post('/session/:id', optionalAuth, async (c) => {
  const sessionId = c.req.param('id')!;
  const { message } = await c.req.json<{ message: string }>();

  if (!message?.trim()) {
    return c.json({ ok: false, error: 'Message is required' }, 400);
  }

  const session = await getSession(sessionId);
  if (!session) {
    return c.json({ ok: false, error: 'Session not found' }, 404);
  }

  return stream(c, async (s) => {
    s.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

    await streamChat(sessionId, message, (chunk) => {
      s.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
    });

    s.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  });
});

/**
 * 获取会话历史
 */
chat.get('/session/:id', optionalAuth, async (c) => {
  const sessionId = c.req.param('id')!;

  const session = await getSession(sessionId);
  if (!session) {
    return c.json({ ok: false, error: 'Session not found' }, 404);
  }

  const messages = await getSessionMessages(sessionId);

  return c.json({ ok: true, data: { session, messages } });
});

/**
 * 用户的所有会话
 */
chat.get('/sessions', requireAuth, async (c) => {
  const userId = c.get('userId') as string;
  const sessions = await listUserSessions(userId);

  return c.json({ ok: true, data: sessions });
});

export { chat };
