import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { getPool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { registerAdapter } from './cps/adapter.js';
import { taobaoAdapter } from './cps/taobao.js';
import { jdAdapter } from './cps/jd.js';
import { pddAdapter } from './cps/pdd.js';
import { douyinAdapter } from './cps/douyin.js';
import { auth } from './routes/auth.js';
import { chat } from './routes/chat.js';
import { user } from './routes/user.js';
import { history } from './routes/history.js';
import { cps } from './routes/cps.js';

type Variables = {
  userId: string;
  requestId: string;
};

// 开发环境加载 .env
if (process.env['NODE_ENV'] !== 'production') {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// 初始化数据库连接池 & 迁移
const pool = getPool();
pool.query('SELECT 1').then(() => {
  console.log('[DB] Database connected');
  return migrate();
}).catch((err) => {
  console.error('[DB] Failed to connect/migrate:', err.message);
});

// 注册 CPS 适配器
registerAdapter(taobaoAdapter);
registerAdapter(jdAdapter);
registerAdapter(pddAdapter);
registerAdapter(douyinAdapter);

const app = new Hono<{ Variables: Variables }>();

// 全局中间件
app.use(
  '*',
  cors({
    origin: config.corsOrigin,
    credentials: true,
  }),
);

// Request ID
app.use('*', async (c, next) => {
  const reqId = crypto.randomUUID();
  c.set('requestId', reqId);
  c.header('X-Request-Id', reqId);
  await next();
});

// 错误处理
app.onError((err, c) => {
  console.error(`[${c.get('requestId') ?? 'unknown'}]`, err);
  return c.json({ ok: false, error: 'Internal Server Error' }, 500);
});

// 健康检查
app.get('/api/health', (c) => {
  return c.json({
    ok: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

// 挂载路由
app.route('/api/auth', auth);
app.route('/api/chat', chat);
app.route('/api/user', user);
app.route('/api/history', history);
app.route('/api/cps', cps);

// 启动服务
const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`[aiXuan] Backend server running on http://localhost:${info.port}`);
    console.log(`[aiXuan] Health check: http://localhost:${info.port}/api/health`);
  },
);

// 优雅退出
process.on('SIGTERM', async () => {
  console.log('[aiXuan] Shutting down...');
  server.close();
  const { closePool } = await import('./db/pool.js');
  await closePool();
});

export default app;
