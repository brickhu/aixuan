# 爱选 (aiXuan) — AI 导购平台

## 项目概述

爱选是一个 **AI 驱动的商品导购平台**，用户通过自然语言对话描述购买需求，AI 逐步引导用户明确需求，最终生成带 CPS 推广链接的商品推荐。

- **域名**: www.aixuan.io
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
- **部署**: 腾讯云 CloudBase 云托管（静态网站）

### 后端
- **运行时**: Node.js 20 + TypeScript (strict)
- **框架**: [Hono](https://hono.dev)（轻量，支持 SSE 流式响应）
- **数据库**: [PostgreSQL 17](https://www.postgresql.org/)（腾讯云 TDSQL-C）
- **数据库驱动**: `pg` (node-postgres) + 连接池
- **AI**: [DeepSeek API](https://platform.deepseek.com/)（兼容 OpenAI SDK）+ Function Calling
- **部署**: 腾讯云 CloudBase 云托管（容器模式，Docker 部署）

### 用户系统
- **认证服务**: 腾讯云 CloudBase 内置身份认证
- **能力**: 自定义登录、匿名登录、微信扫码、手机验证码、邮箱密码
- **流程**: 后端签发 Ticket → 前端兑换 access_token → 后端验证 JWT
- **用户数据**: CloudBase Auth 托管用户基础信息，应用数据库仅存用户 ID 和应用级数据

### 云环境
- **CloudBase 环境 ID**: `aixuan-dev-d4gpc3d6p36f37a1e`
- **数据库实例 ID**: `postgres-6ypc3w9s`（TDSQL-C PostgreSQL 17.10）
- **域名**: www.aixuan.io → CloudBase 自定义域名

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
│   ├── scripts/
│   │   └── dev.sh
│   └── src/
│       ├── index.ts                  # 入口
│       ├── config.ts                 # 配置
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
│       │   ├── auth.ts               # CloudBase 认证
│       │   ├── points.ts             # 积分管理
│       │   └── profile.ts            # 用户资料
│       ├── routes/                   # API 路由
│       │   ├── chat.ts
│       │   ├── auth.ts
│       │   ├── history.ts
│       │   └── user.ts
│       └── middleware/               # 中间件
│           └── auth.ts               # CloudBase JWT 验证
│
├── scripts/                          # 开发/部署脚本
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
-- 用户表（基础信息由 CloudBase Auth 托管，本地仅存应用数据）
CREATE TABLE users (
  id            TEXT PRIMARY KEY,          -- 与 CloudBase Auth 的 UID 一致
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

## CloudBase 认证系统

### 认证流程

```
前端 (浏览器)                         后端 (CloudBase Cloud Run)
    │                                       │
    │  ① 调用后端 /api/auth/ticket          │
    │─────────────────────────────────────> │
    │  ← { ticket }                         │  后端使用 CloudBase SDK 签发 ticket
    │                                       │
    │  ② 用 ticket 调用 CloudBase Auth API  │
    │─────────────────────────────────>     │
    │  ← { access_token, refresh_token }     │  CloudBase Auth 返回 JWT
    │                                       │
    │  ③ 后续请求带 Bearer token            │
    │─────────────────────────────────────> │  后端验证 JWT → 获取 UID
    │  ← { ok: true, data: ... }            │
```

### 后端验证 Token

后端通过 JWT 解码验证 CloudBase Auth 签发的 access_token（无需额外网络请求）：

```typescript
// middleware/auth.ts
import { jwtVerify } from 'jose';

// CloudBase Auth 的 JWT 公钥端点
const JWKS_URI = `https://${ENV_ID}.api.tcloudbasegateway.com/auth/v1/jwks`;

export async function requireAuth(c: Context, next: Next) {
  const token = c.req.header('Authorization')?.slice(7);
  const payload = await verifyCloudBaseToken(token);
  if (!payload) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  c.set('userId', payload.sub);  // sub = CloudBase UID
  await next();
}
```

### 自定义登录（后端签发 Ticket）

```typescript
import cloudbase from '@cloudbase/node-sdk';

const app = cloudbase.init({
  env: 'aixuan-dev-d4gpc3d6p36f37a1e',
  credentials: require('./tcb_custom_login.json'),
});

const ticket = app.auth().createTicket('user-custom-id', {
  refresh: 3600 * 1000,      // access_token 刷新间隔
  expire: 24 * 3600 * 1000,  // ticket 过期时间
});
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
# 认证（CloudBase Auth 管理登录流程，后端签发 Ticket + 验证 Token）
POST   /api/auth/ticket              # 为当前用户签发自定义登录 Ticket

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

## CloudBase 云托管部署

### 环境信息

| 资源 | 值 |
|------|-----|
| CloudBase 环境 ID | `aixuan-dev-d4gpc3d6p36f37a1e` |
| 数据库实例 ID | `postgres-6ypc3w9s` (TDSQL-C PostgreSQL 17.10) |
| 数据库引擎 | PostgreSQL 17.10 |
| 默认端口 | 5432 |
| 部署方式 | 容器模式 (Docker) |

### 后端云托管

后端的 Dockerfile 位于 `backend/Dockerfile`。CloudBase 云托管会从代码仓库（或 CLI 上传）自动构建容器镜像并部署。

#### 核心要求

1. **监听 `0.0.0.0`**（通过 `HOSTNAME=0.0.0.0` 环境变量）
2. **端口 3000**（CloudBase 配置与此一致）
3. **健康检查端点**：`GET /api/health`
4. **非 root 用户**运行容器
5. **多阶段构建**以减小镜像体积

#### 环境变量配置

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek API 密钥 |
| `DEEPSEEK_BASE_URL` | 否 | `https://api.deepseek.com` | DeepSeek API 地址 |
| `DEEPSEEK_MODEL` | 否 | `deepseek-chat` | 模型名称 |
| `DATABASE_URL` | 是 | PostgreSQL 连接串（TDSQL-C 内网地址） |
| `CLOUDBASE_ENV_ID` | 是 | CloudBase 环境 ID |
| `CLOUDBASE_ACCESS_KEY` | 是 | CloudBase 自定义登录私钥文件路径 |
| `CORS_ORIGIN` | 否 | 前端地址，默认 `http://localhost:5173` |
| `CPS_TAOBAO_APP_KEY` | 否 | 淘宝客 App Key |
| `CPS_TAOBAO_APP_SECRET` | 否 | 淘宝客 App Secret |
| `CPS_TAOBAO_PID` | 否 | 淘宝客推广位 PID |
| `CPS_JD_API_KEY` | 否 | 京东联盟 API Key |
| `CPS_PDD_API_KEY` | 否 | 拼多多多多客 API Key |

#### 数据库连接

应用通过 `DATABASE_URL` 环境变量连接 TDSQL-C PostgreSQL：

```
postgresql://username:password@10.x.x.x:5432/aixuan?sslmode=disable
```

CloudBase Cloud Run 与 TDSQL-C 需在 **同一 VPC** 内。连接信息在 TDSQL-C 控制台 → 实例详情中获取（内网 IP、端口、用户名、密码）。

### 前端云托管

前端构建产物（`dist/` 目录）通过 CloudBase 托管为静态网站，绑定自定义域名 `www.aixuan.io`。

### GitHub Actions 自动部署

项目根目录的 `.github/workflows/deploy.yml` 配置了 CI/CD 流水线：

```yaml
name: Deploy to CloudBase

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        working-directory: ./backend
      - run: npm install -g @cloudbase/cli
      - run: |
          tcb login --apiKeyId ${{ secrets.TCB_SECRET_ID }} \
                    --apiKey ${{ secrets.TCB_SECRET_KEY }}
          tcb cloudrun deploy \
            -e ${{ secrets.TCB_ENV_ID }} \
            -s aixuan-backend \
            --port 3000 \
            --force
```

#### GitHub Secrets 配置

| Secret | 来源 |
|--------|------|
| `TCB_SECRET_ID` | 腾讯云 CAM → 访问管理 → API 密钥管理 |
| `TCB_SECRET_KEY` | 同上（创建时保存） |
| `TCB_ENV_ID` | CloudBase 控制台 → 环境概览 |

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
- You MUST identify the CloudBase scenario first, then read auth-tool / http-api / as appropriate before implementation.
- 登录 / 注册 / 认证配置：先读 auth-tool，再读平台实现 skill
- 先读 http-api，不要先走 Web SDK。

---

## 安全注意事项

- 用户认证由 CloudBase Auth 全权管理，后端不接触/存储密码
- 后端所有需要鉴权的 API 统一通过 CloudBase JWT Token 验证中间件
- 所有的 CPS API Keys 存环境变量，不提交
- 前端不要暴露任何平台的 App Key/Secret
- 推广链接跳转使用 302 重定向（服务端记录点击后跳转）
- 遵循各平台联盟的推广规范，避免封号

---

## 项目路线图

### Phase 1 — MVP (最小可行产品)
- [x] 基础后端框架搭建（Hono + PostgreSQL + TypeScript）
- [ ] CloudBase 认证配置与集成
- [ ] 对话式 Agent（Claude API + Function Calling）
- [ ] 淘宝客 CPS 接入（搜索 + 转链）
- [ ] 前端聊天界面（SolidJS + UnoCSS）
- [ ] CloudBase 云托管部署 + GitHub Actions 自动化
- [ ] TDSQL-C PostgreSQL 连接与迁移

### Phase 2 — 扩展
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
