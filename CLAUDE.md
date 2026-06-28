# 爱选 (aiXuan) — AI 导购平台

## 项目概述

爱选是一个 **AI 驱动的商品导购平台**，用户通过自然语言对话描述购买需求，AI 逐步引导用户明确需求，最终生成带 CPS 推广链接的商品推荐。

- **域名**: www.aixuan.vip
- **定位**: 通用导购系统，覆盖多电商平台的 CPS
- **盈利模式**: CPS 分佣 + 用户积分/返利体系
- **开发方式**: 全程 AI 驱动

---

## 技术栈

### 前端
- **框架**: [SolidJS](https://solidjs.com/)（响应式，细粒度更新）
- **样式**: [TailwindCSS](https://unocss.dev) 4.x（采用最新版）
- **构建**: Vite
- **路由**: solid-router
- **部署**: 阿里云静态托管（OSS + CDN）

### 后端
- **运行时**: Node.js 20 + TypeScript (strict)
- **框架**: [Hono](https://hono.dev)（轻量，支持 SSE 流式响应）
- **数据库**: [PostgreSQL 17](https://www.postgresql.org/)（Docker 部署）
- **数据库驱动**: `pg` (node-postgres) + 连接池
- **AI**: [DeepSeek API](https://platform.deepseek.com/)（兼容 OpenAI SDK）+ Function Calling
- **部署**: 阿里云轻量服务器（Docker Compose 部署）

### 用户系统
- **认证服务**: 自定义 JWT（自签发/验证）
- **能力**: 邮箱验证码登录、微信登录、支付宝登录
- **流程**: 用户输入邮箱 → 后端发送验证码 → 验证通过后签发 JWT
- **第三方登录**: 接入微信开放平台、支付宝开放平台 OAuth
- **用户数据**: 用户基础信息全部存储在本地 PostgreSQL

### 云环境
- **云服务器**: 阿里云轻量应用服务器（2核2G，Ubuntu）
- **数据库**: 服务器自建 PostgreSQL 17（Docker 部署）
- **静态托管**: 阿里云静态托管（OSS + CDN）
- **域名**: www.aixuan.vip → 阿里云 DNS

### CPS 联盟接入（直连官方 API）
- 淘宝/天猫 → 阿里妈妈 TOP API
- 京东 → 京东联盟 API
- 拼多多 → 多多客 API
- 抖音 → 抖客 / 精选联盟 API（待确认接入方式）


---

## 目录结构

```
aixuan/
├── CLAUDE.md                         # 本文件
│
├── frontend/                         # SolidJS 前端
│   ├── src/
│   │   ├── components/               # 通用组件
│   │   │   ├── ChatBox.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── GuideStep.tsx
│   │   │   └── UserLogin.tsx
│   │   ├── pages/                   # 页面
│   │   │   ├── Home.tsx
│   │   │   ├── Chat.tsx
│   │   │   ├── History.tsx
│   │   │   ├── Profile.tsx
│   │   │   └── Login.tsx
│   │   ├── stores/                   # 信号存储
│   │   ├── api/                      # 后端 API 调用
│   │   └── types/                    # 共享类型
│   │   └── index.tsx/                # 入口文件，集成Router和样式等
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                          # Node.js 后端
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                  # 入口
│       ├── config.ts                 # 配置
│       ├── auth/                     # 认证核心
│       │   └── jwt.ts                # JWT 签发/验证
│       ├── db/                       # 数据库
│       │   ├── migrate.ts            # 自动迁移
│       │   └── pool.ts               # PG 连接池
│       ├── agent/                    # Agent 核心
│       │   ├── agent.ts              # 对话管理
│       │   ├── tools.ts              # Function Call 定义
│       │   ├── prompts.ts            # 提示词
│       │   └── sessions.ts           # 会话管理
│       ├── cps/                      # CPS 适配器
│       │   ├── adapter.ts            # 抽象接口
│       │   ├── taobao.ts             # 淘宝
│       │   ├── jd.ts                 # 京东
│       │   ├── pdd.ts                # 拼多多
│       │   └── douyin.ts             # 抖音
│       ├── user/                     # 用户模块
│       │   ├── auth.ts               # 本地用户管理
│       │   ├── points.ts             # 积分管理
│       │   └── profile.ts            # 用户资料
│       ├── routes/                   # API 路由
│       │   ├── chat.ts
│       │   ├── auth.ts
│       │   ├── history.ts
│       │   └── user.ts
│       └── middleware/               # 中间件
│           └── auth.ts               # JWT 验证中间件
│
├── scripts/                          # 部署脚本
│   ├── init-server.sh                # 阿里云服务器初始化
│   └── dev.sh
│
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Actions 自动部署
│
└── README.md
```

---

## 数据模型

### PostgreSQL Schema

```sql
-- 用户表（所有用户信息存储在本地 PostgreSQL）
CREATE TABLE users (
  id            TEXT PRIMARY KEY,          -- UUID
  nickname      TEXT,
  avatar_url    TEXT,
  points        INTEGER DEFAULT 0,         -- 积分余额
  total_earned  REAL DEFAULT 0.0,          -- 累计返利(元)
  total_saved   REAL DEFAULT 0.0,          -- 累计帮用户省了多少钱
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- 导购会话
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id), -- NULL 允许未登录体验
  status        TEXT DEFAULT 'active',     -- 'active' | 'completed'
  summary       TEXT,                      -- 用户最终购买需求总结
  product_count INTEGER DEFAULT 0,         -- 推荐商品数
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- 对话消息
CREATE TABLE messages (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  role          TEXT NOT NULL,             -- 'user' | 'assistant' | 'tool'
  content       TEXT NOT NULL,             -- markdown / JSON
  msg_type      TEXT DEFAULT 'text',       -- 'text' | 'product_card' | 'guide'
  metadata      JSONB,                     -- 额外数据
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 推荐商品
CREATE TABLE products (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES sessions(id),
  platform        TEXT NOT NULL,             -- 'taobao' | 'jd' | 'pdd' | 'douyin'
  title           TEXT NOT NULL,
  price           REAL NOT NULL,
  original_price  REAL,
  image_url       TEXT,
  item_url        TEXT,                      -- 原始商品页
  coupon_url      TEXT,                      -- 优惠券链接
  commission_rate REAL,                      -- 佣金率
  commission_amount REAL,                    -- 预估佣金
  sales_count     INTEGER,
  shop_name       TEXT,
  rank            INTEGER,                   -- 推荐排序
  created_at      TIMESTAMP DEFAULT NOW()
);

-- 点击/转化追踪
CREATE TABLE clicks (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  product_id    TEXT NOT NULL REFERENCES products(id),
  platform      TEXT NOT NULL,
  click_url     TEXT NOT NULL,              -- 推广链接
  ip            TEXT,
  user_agent    TEXT,
  converted     INTEGER DEFAULT 0,          -- 是否已购买
  commission    REAL DEFAULT 0.0,           -- 佣金金额
  clicked_at    TIMESTAMP DEFAULT NOW(),
  converted_at  TIMESTAMP
);

-- 用户积分记录
CREATE TABLE point_transactions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  points        INTEGER NOT NULL,          -- 正=收入, 负=支出
  type          TEXT NOT NULL,             -- 'signin' | 'share' | 'purchase' | 'redeem'
  reference_id  TEXT,                      -- 关联的click/conversion ID
  note          TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_products_session ON products(session_id);
CREATE INDEX idx_clicks_user ON clicks(user_id);
CREATE INDEX idx_clicks_product ON clicks(product_id);
CREATE INDEX idx_points_user ON point_transactions(user_id);
```

---

## 认证系统

### 认证方式

| 方式 | 说明 | 状态 |
|------|------|------|
| 邮箱验证码 | 用户输入邮箱 → 后端发送验证码 → 验证通过签发 JWT | 待实现 |
| 微信登录 | 微信开放平台 OAuth 扫码登录 | 待实现 |
| 支付宝登录 | 支付宝开放平台 OAuth 登录 | 待实现 |

### JWT 设计

```typescript
// 后端签发 JWT，使用 jose 库
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env['JWT_SECRET']);

// 签发
async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

// 验证
async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET);
  return payload;
}
```

### 认证流程

```
客户端                         后端 (阿里云轻量服务器)
  │                                   │
  │ ① POST /api/auth/send-code        │
  │   { email }                       │  生成 6 位验证码，存入 Redis/内存
  │─────────────────────────────────> │  发送验证码邮件（阿里云邮件推送）
  │                                   │
  │ ② POST /api/auth/verify-code      │
  │   { email, code }                 │  验证码校验通过 → 签发 JWT
  │─────────────────────────────────> │
  │ ← { token, userId }               │
  │                                   │
  │ ③ 后续请求带 Bearer token         │
  │─────────────────────────────────> │  中间件验证 JWT → 获取 userId
  │ ← { ok: true, data: ... }         │
```

### 第三方 OAuth 流程

```
客户端                         后端
  │                                   │
  │ ① GET /api/auth/oauth/:platform   │  返回第三方 OAuth 授权 URL
  │─────────────────────────────────> │
  │ ← { redirectUrl }                 │
  │                                   │
  │ ② 用户跳转第三方授权页 → 授权后    │
  │   回调后端 /api/auth/oauth/callback│  用 code 换取 access_token
  │─────────────────────────────────> │  获取用户信息 → 创建/登录用户
  │ ← { token, userId }               │  签发 JWT 返回
```

### 后端验证 Token

```typescript
// middleware/auth.ts
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env['JWT_SECRET']);

export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, SECRET);
    c.set('userId', payload.sub as string);
    await next();
  } catch {
    return c.json({ ok: false, error: 'Invalid or expired token' }, 401);
  }
}
```

### 用户数据模型补充字段

```sql
-- users 表新增字段
ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN wechat_openid TEXT UNIQUE;
ALTER TABLE users ADD COLUMN alipay_user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN password_hash TEXT;  -- 可选：邮箱密码登录
```

---

## CPS 适配器设计

### 策略模式

所有 CPS 平台统一通过抽象接口调用，新增平台只需实现接口。

```typescript
// backend/src/cps/adapter.ts

interface CPSAdapter {
  readonly platform: 'taobao' | 'jd' | 'pdd' | 'douyin';
  search(params: SearchParams): Promise<SearchResult[]>;
  getDetail(itemId: string): Promise<ProductDetail>;
  generatePromotionLink(itemId: string, pid: string): Promise<string>;
  getCommission(itemId: string): Promise<CommissionInfo>;
}

interface SearchParams {
  keyword: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'sales_desc' | 'commission_desc';
  page?: number;
  pageSize?: number;
}

interface SearchResult {
  itemId: string;
  title: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  salesCount?: number;
  commissionRate: number;
  commissionAmount: number;
  shopName: string;
  itemUrl: string;
  platform: string;
}
```

### 平台接入要点

| 平台 | SDK/API | 认证方式 | 需准备 |
|------|---------|---------|--------|
| 淘宝 | taobao.tbk.dg.material.optional | OAuth 2.0 + 签名 | App Key, Secret, 推广位PID |
| 京东 | 京东联盟 Open API | Access Token | 联盟账号, API Key |
| 拼多多 | 多多客 API | Access Token | 多多进宝账号 |
| 抖音 | 抖客 API | 待调研 | 待调研 |

---

## Agent 对话设计

### 对话流程

```
用户: "我想买个耳机"
  ↓
Agent 引导 (澄清需求):
  ① 预算范围？       → "500以内"
  ② 使用场景？       → "通勤路上，需要降噪"
  ③ 连接方式？       → "蓝牙"
  ④ 还有没有其他偏好？ → "续航要好"
  ↓
需求明确 → Agent 调用 CPS 搜索
  ↓
Agent 综合推荐 (返回商品卡片列表):
  - 商品 A (¥399, 佣金¥12)
  - 商品 B (¥489, 佣金¥18)
  - 商品 C (¥299, 佣金¥8)
  ↓
用户点击某商品 → 跳转推广链接 → 记录点击
  ↓
用户后续:
  "苹果的现在多少钱？"
  → Agent 继续搜索该品牌,保持上下文
```

### Function Calling Tools 定义

```typescript
// backend/src/agent/tools.ts

const tools = [
  {
    name: "search_products",
    description: "根据用户需求搜索多个平台上的商品",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "搜索关键词" },
        minPrice: { type: "number" },
        maxPrice: { type: "number" },
        platforms: {
          type: "array",
          items: { type: "string", enum: ["taobao", "jd", "pdd", "douyin"] },
          description: "要搜索的平台，默认全平台"
        },
        sortBy: { type: "string", enum: ["price_asc", "price_desc", "sales_desc", "commission_desc"] }
      },
      required: ["keyword"]
    }
  },
  {
    name: "clarify_requirement",
    description: "向用户提出一个引导性问题，帮助明确购买需求",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: {
          type: "array",
          items: { type: "string" },
          description: "建议的选项，仅当问题适合用选择题形式"
        }
      },
      required: ["question"]
    }
  }
];
```

### Agent Prompt 核心要点

```text
你是一个专业的购物导购助手，名叫爱选助手。

你的核心工作流程：
1. 如果用户需求不明确，逐个抛出引导性问题（预算、场景、品牌偏好等）
2. 注意不要一次问太多问题，每次追问1-2个
3. 当需求明确后，调用 search_products 搜索
4. 从搜索结果中挑选 3-5 件推荐给用户
5. 推荐时说明推荐理由
6. 用户表示感兴趣后，自动生成推广链接+推荐理由

风格要求：
- 热情、专业、不强行推销
- 给出真实对比和建议
- 不说"根据我的训练数据"等 AI 套话

可用的平台：淘宝、京东、拼多多、抖音
默认优先全平台搜索，但根据用户需求可指定平台。
```

---

## 积分与返利体系

| 行为 | 积分 | 说明 |
|------|------|------|
| 每日签到 | +5 | 每天一次 |
| 完成一次导购会话 | +10 | 对话有 ≥3 条消息 |
| 分享导购报告 | +20 | 通过分享链接 |
| 通过链接购买（首次审核） | +商品佣金等值积分 | 确认收货后到账 |
| 邀请新用户 | +50 | 新用户完成首次导购 |
| 积分兑换 | -N | 提现/兑换礼品 |

---

## API 路由设计

```
# 认证（自定义 JWT）
POST   /api/auth/send-code             # 发送邮箱验证码
POST   /api/auth/verify-code           # 验证码登录(签发JWT)
POST   /api/auth/send-code?type=reset  # 发送重置密码验证码
POST   /api/auth/reset-password        # 重置密码
GET    /api/auth/oauth/:platform       # 第三方 OAuth 授权 URL
GET    /api/auth/oauth/callback        # OAuth 回调

# 聊天
POST   /api/chat/session             # 创建新会话
POST   /api/chat/session/:id         # 发送消息(SSE流式返回)
GET    /api/chat/session/:id         # 获取会话历史
GET    /api/chat/sessions            # 用户的所有会话

# CPS
POST   /api/cps/link                 # 生成推广链接(记录点击)
GET    /api/cps/platforms            # 支持的平台列表

# 用户（仅应用级数据）
GET    /api/user/profile             # 用户信息（积分数、导购次数等）
GET    /api/user/points              # 积分明细
POST   /api/user/signin              # 每日签到

# 数据
GET    /api/history                  # 导购历史
GET    /api/stats/click              # 点击统计
```

---

## 阿里云部署

### 架构概览

```
用户 → DNS
        ├── www.aixuan.vip (CNAME → OSS) ── 前端 SPA (SolidJS)
        │     ├── 阿里云静态托管
        │     ├── 自定义域名 + HTTPS
        │     └── CDN 加速
        │
        └── api.aixuan.vip (A → 47.99.65.147) ── 后端 API
              ├── Nginx 反向代理 (SSL termination)
              ├── Docker: backend (Node.js + Hono)
              ├── Docker: postgres:17-alpine
              └── 数据持久化卷
```

### 轻量服务器信息

| 资源 | 规格 |
|------|------|
| 服务器 | 阿里云轻量应用服务器 |
| 配置 | 2核2G（推荐） |
| 系统 | Ubuntu 22.04 LTS |
| 安全组 | 开放端口: 22(SSH), 80(HTTP), 443(HTTPS) |
| Docker | Docker Engine + Compose |

### Docker Compose 部署

```yaml
# docker-compose.yml (生产环境)
services:
  postgres:
    image: postgres:17-alpine
    container_name: aixuan-pg
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: aixuan
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    container_name: aixuan-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      HOSTNAME: 0.0.0.0
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/aixuan
      JWT_SECRET: ${JWT_SECRET}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
      CORS_ORIGIN: https://www.aixuan.vip
      # CPS 配置...
    depends_on:
      postgres:
        condition: service_healthy

  nginx:
    image: nginx:alpine
    container_name: aixuan-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend

volumes:
  pgdata:
```

### Nginx 配置

```nginx
# nginx.conf — api.aixuan.vip
server {
    listen 80;
    server_name api.aixuan.vip;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.aixuan.vip;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # API 反向代理
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }

    # 非 API 路径返回提示
    location / {
        return 200 "aiXuan API Server is running.\n";
        add_header Content-Type text/plain;
    }
}
```

### 核心要求

1. **监听 `0.0.0.0`** — 通过 `HOSTNAME=0.0.0.0` 环境变量
2. **端口 3000** — 后端容器端口
3. **健康检查端点** — `GET /api/health`
4. **自动重启** — `restart: unless-stopped`
5. **数据持久化** — Docker volume 存储 PostgreSQL 数据
6. **非 root 用户**运行容器

### 前端部署（阿里云静态托管）

前端构建产物（`frontend/dist/` 目录）部署到阿里云静态托管：

1. 构建：`cd frontend && pnpm build`
2. 上传到阿里云 OSS Bucket
3. 配置静态托管域名 `www.aixuan.vip`
4. 开启 CDN 加速
5. 配置 HTTPS 证书

### 首次部署步骤

```bash
# 1. SSH 登录服务器
ssh root@服务器IP

# 2. 安装 Docker
curl -fsSL https://get.docker.com | sh

# 3. 克隆代码 & 部署
git clone https://github.com/your-org/aixuan.git
cd aixuan
cp .env.production .env   # 编辑环境变量
docker compose up -d

# 4. 配置 SSL 证书（用于 api.aixuan.vip）
docker run -it --rm -v ./ssl:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d api.aixuan.vip

# 5. 重启 Nginx 加载证书
docker compose restart nginx
```

---

## 编码规范

### TypeScript
- `strict: true`
- 使用 `type` 而非 `interface`（项目一致即可，保持一致）
- 所有 API 返回格式统一：`{ ok: boolean, data?: T, error?: string }`
- 异步函数始终返回 Promise
- 错误使用自定义错误类，不 throw 裸字符串

### 命名
- 文件: kebab-case（`chat-box.tsx`）
- 变量/函数: camelCase
- 类型/类: PascalCase
- 常量: UPPER_SNAKE_CASE
- 数据库表: snake_case（兼容 SQL）

### 前端规范
- 组件文件使用 `.tsx`
- 纯逻辑/工具函数使用 `.ts`
- 使用 `<Show>` `<For>` `<Switch>` 条件渲染，不用三元/&&
- UnoCSS 类：按 布局 → 宽高 → 间距 → 颜色 → 字体 排序
- 所有用户输入先做 XSS 过滤（使用 DOMPurify）

### 样式约定
- 移动端优先，断点: sm(640), md(768), lg(1024), xl(1280)
- 颜色主题: 使用 UnoCSS 自定义主题色
- 主题色: #2563EB (blue-600) 为主色
- 商品卡片: 圆角、阴影、响应式网格

---

## AI 开发约定

### 对话管理（便于 AI 理解和调整）

```typescript
interface SessionState {
  requirements: {
    budget?: [number, number];   // [min, max]
    category?: string;
    scenario?: string;
    brand?: string[];
    features?: string[];
    platform?: string[];
  };
  clarificationStep: number;
  recommendedProducts: Product[];
  userSelected?: Product;
}
```

### 提示词优化原则
- Agent system prompt 按季度迭代
- 每个 prompt 更改记录在 `CLAUDE.md` 中维护
- prompt 中的关键约束要加粗标注
- 不要过度承诺，prompt 中不写"全网最低价"，写"为您精选"

### 开发流程
1. 在 `CLAUDE.md` 中先定义需求或补充说明
2. 再实现代码
3. 代码提交前检查类型
4. Schema 变更需写迁移脚本

### 其他约束
- 认证实现：使用 jose 库签发/验证 JWT，参考 `middleware/auth.ts` 中的 verifyToken
- 所有 API 返回统一格式：`{ ok: boolean, data?: T, error?: string }`
- Schema 变更需写迁移脚本

---

## 安全注意事项

- JWT Secret 必须使用强随机字符串，通过环境变量注入，不提交到代码库
- 邮箱验证码有效期 5 分钟，单 IP 每小时限制发送次数
- 所有需要鉴权的 API 统一通过 JWT 验证中间件
- 所有的 CPS API Keys 存环境变量，不提交
- 前端不要暴露任何平台的 App Key/Secret
- 推广链接跳转使用 302 重定向（服务端记录点击后跳转）
- 遵循各平台联盟的推广规范，避免封号
- 数据库中用户密码仅存 bcrypt hash，不存明文

---

## 项目路线图

### Phase 0 — 平台迁移（当前任务）
- [ ] 购买阿里云轻量服务器 + 静态托管
- [ ] 替换认证系统（自定义 JWT + 邮箱验证码）
- [ ] 实现自定义 JWT 签发/验证中间件
- [ ] 本地 docker-compose 部署验证
- [ ] 配置 Nginx 反向代理 + SSL
- [ ] 更新 GitHub Actions 部署流程
- [ ] 数据迁移 & DNS 切换

### Phase 1 — MVP (最小可行产品)
- [x] 基础后端框架搭建（Hono + PostgreSQL + TypeScript）
- [x] 邮箱验证码登录（JWT 自签发）
- [ ] 对话式 Agent（DeepSeek API + Function Calling）
- [ ] 淘宝客 CPS 接入（搜索 + 转链）
- [ ] 前端搭建（SolidJS + UnoCSS）
- [ ] 阿里云 Docker Compose 部署
- [ ] GitHub Actions 自动化部署

### Phase 2 — 扩展
- [ ] 微信登录 & 支付宝登录
- [ ] 京东联盟接入
- [ ] 拼多多多多客接入
- [ ] 商品卡片展示优化
- [ ] 积分签到功能
- [ ] 导购历史查看

### Phase 3 — 完善
- [ ] 抖音/抖客接入
- [ ] 分享导购报告功能
- [ ] 邀请裂变机制
- [ ] 点击/转化数据看板
- [ ] SEO 优化
