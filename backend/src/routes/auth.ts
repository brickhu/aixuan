import { Hono } from 'hono';
import { signToken } from '../auth/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import { findOrCreateUserByEmail, findUserById } from '../user/auth.js';

const auth = new Hono<{ Variables: { userId: string } }>();

// ── 邮箱验证码存储（内存，单机够用） ──
const codeStore = new Map<string, { code: string; expiresAt: number }>();
const CODE_TTL = 5 * 60 * 1000; // 5 分钟
const RATE_LIMIT = 5; // 每 IP 每小时最多发 5 次
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW = 60 * 60 * 1000; // 1 小时

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

/**
 * POST /api/auth/send-code
 * 发送邮箱验证码（开发环境直接打印到控制台）
 */
auth.post('/send-code', async (c) => {
  const { email } = await c.req.json<{ email: string }>();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ ok: false, error: 'Invalid email address' }, 400);
  }

  // 限流
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return c.json({ ok: false, error: 'Too many requests. Try again later.' }, 429);
  }

  const code = generateCode();
  codeStore.set(email, { code, expiresAt: Date.now() + CODE_TTL });

  // 开发环境：直接打印验证码
  console.log(`[EMAIL CODE] ${email} → ${code}`);

  // TODO: 生产环境替换为阿里云邮件推送 API
  // await sendEmail(email, `您的验证码是: ${code}，有效期 5 分钟`);

  return c.json({ ok: true, data: { message: 'Verification code sent' } });
});

/**
 * POST /api/auth/verify-code
 * 验证邮箱验证码，登录或注册用户
 */
auth.post('/verify-code', async (c) => {
  const { email, code } = await c.req.json<{ email: string; code: string }>();

  if (!email || !code) {
    return c.json({ ok: false, error: 'Missing email or code' }, 400);
  }

  // 验证码校验
  const stored = codeStore.get(email);
  if (!stored || Date.now() > stored.expiresAt) {
    codeStore.delete(email);
    return c.json({ ok: false, error: 'Code expired or not sent' }, 400);
  }
  if (stored.code !== code) {
    return c.json({ ok: false, error: 'Invalid code' }, 400);
  }

  // 验证通过，清理验证码
  codeStore.delete(email);
  rateMap.delete(email);

  // 查找或创建用户
  const user = await findOrCreateUserByEmail(email);

  // 签发 JWT
  const token = await signToken(user.id, email);

  return c.json({
    ok: true,
    data: {
      token,
      userId: user.id,
      isNew: user.isNew,
    },
  });
});

/**
 * GET /api/auth/me
 * 获取当前登录用户信息
 */
auth.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId');
  const user = await findUserById(userId);
  if (!user) {
    return c.json({ ok: false, error: 'User not found' }, 404);
  }
  return c.json({
    ok: true,
    data: {
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatar_url,
      points: user.points,
    },
  });
});

/**
 * GET /api/auth/oauth/:platform
 * 获取第三方 OAuth 授权 URL
 */
auth.get('/oauth/:platform', async (c) => {
  const platform = c.req.param('platform');

  const oauthUrls: Record<string, string> = {
    wechat: 'https://open.weixin.qq.com/connect/qrconnect?appid=YOUR_APP_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=snsapi_login',
    alipay: 'https://openauth.alipay.com/oauth2/publicAppAuthorize.htm?app_id=YOUR_APP_ID&scope=auth_user&redirect_uri=YOUR_REDIRECT_URI',
  };

  const url = oauthUrls[platform];
  if (!url) {
    return c.json({ ok: false, error: `Unsupported platform: ${platform}` }, 400);
  }

  return c.json({ ok: true, data: { redirectUrl: url } });
});

/**
 * GET /api/auth/oauth/callback
 * 第三方 OAuth 回调
 */
auth.get('/oauth/callback', async (c) => {
  const { code, state, platform } = c.req.query();

  if (!code || !platform) {
    return c.json({ ok: false, error: 'Missing code or platform' }, 400);
  }

  // TODO: 用 code 换取第三方 access_token → 获取用户信息 → 创建/登录用户 → 签发 JWT
  console.log(`[OAUTH] ${platform} callback: code=${code}, state=${state}`);

  return c.json({
    ok: false,
    error: 'OAuth not fully implemented yet',
  });
});

export { auth };