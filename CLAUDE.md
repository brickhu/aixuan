# 爱选 (aiXuan) — AI 导购平台

## 项目概述

爱选是一个 AI 驱动的商品导购平台，用户通过自然语言对话描述购买需求，AI 逐步引导用户明确需求，最终生成带 CPS 推广链接的商品推荐。

- **域名**: www.aixuan.io
- **定位**: 通用导购系统，覆盖多电商平台的 CPS
- **盈利模式**: CPS 分佣 + 用户积分/返利体系
- **开发方式**: 全程 AI 驱动

---

## 技术栈

### 前端
- **框架**: SolidJS（响应式，细粒度更新）
- **样式**: TailwindCSS
- **构建**: Vite
- **状态管理**: SolidJS 内置信号机制（无需额外状态库）
- **路由**: solid-router
- **部署**: 腾讯云静态网站托管 / COS + CDN
- **域名**: www.aixuan.io → 腾讯云 CDN

### 用户系统
- **认证服务**: 腾讯云 CIAM（Customer Identity and Access Management，身份管理服务）
- **能力**: 微信扫码/手机验证码/邮箱密码/小程序授权 等多种登录方式
- **集成**: 后端验证 CIAM 签发的 JWT Token，不自行管理密码
- **用户数据**: 用户基础信息由 CIAM 托管，应用数据库只存用户 ID 和应用级数据（积分、导购历史等）

### CPS 联盟接入（直连官方 API）
- 淘宝/天猫 → 阿里妈妈 TOP API
- 京东 → 京东联盟 API
- 拼多多 → 多多客 API
- 抖音 → 抖客 / 精选联盟 API（待确认接入方式）

---

## 目录结构

```
aixuan/
├── CLAUDE.md            # 本文件
│
├── frontend/                # SolidJS 前端
│   ├── src/
│   │   ├── components/      # 通用组件
│   │   │   ├── ChatBox.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── GuideStep.tsx
│   │   │   └── UserLogin.tsx
│   │   ├── routes/          # 页面
│   │   │   ├── Home.tsx
│   │   │   ├── Chat.tsx
│   │   │   ├── History.tsx
│   │   │   ├── Profile.tsx
│   │   │   └── Login.tsx
│   │   ├── stores/          # 信号存储
│   │   ├── api/             # 后端 API 调用
│   │   └── types/           # 共享类型
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                 # Node.js 后端
│   ├── src/
│   │   ├── index.ts         # 入口
│   │   ├── config.ts        # 配置
│   │   ├── db/              # 数据库
│   │   │   ├── schema.sql
│   │   │   └── index.ts
│   │   ├── agent/           # Agent 核心
│   │   │   ├── agent.ts     # 对话管理
│   │   │   ├── tools.ts     # Function Call 定义
│   │   │   ├── prompts.ts   # 提示词
│   │   │   └── sessions.ts  # 会话管理
│   │   ├── cps/             # CPS 适配器
│   │   │   ├── adapter.ts   # 抽象接口
│   │   │   ├── taobao.ts    # 淘宝
│   │   │   ├── jd.ts        # 京东
│   │   │   ├── pdd.ts       # 拼多多
│   │   │   └── douyin.ts    # 抖音
│   │   ├── user/            # 用户模块（CIAM 托管认证，此处仅应用数据）
│   │   │   ├── ciam.ts      # CIAM Token 验证与用户同步
│   │   │   ├── points.ts    # 积分管理
│   │   │   └── profile.ts   # 用户资料
│   │   ├── routes/          # API 路由
│   │   │   ├── chat.ts
│   │   │   ├── auth.ts
│   │   │   ├── history.ts
│   │   │   └── user.ts
│   │   └── middleware/      # 中间件
│   │       └── auth.ts
│   ├── package.json
│   └── tsconfig.json
│
├── scripts/                 # 开发/部署脚本
│   ├── dev.sh
│   └── deploy.sh
│
└── README.md
```

---

## 数据模型

### SQLite Schema

```sql
-- 用户表（基础信息由腾讯云 CIAM 托管，本地仅存应用数据）
CREATE TABLE users (
  id            TEXT PRIMARY KEY,          -- 与 CIAM 的 User ID 一致
  nickname      TEXT,
  avatar_url    TEXT,
  points        INTEGER DEFAULT 0,         -- 积分余额
  total_earned  REAL DEFAULT 0.0,          -- 累计返利(元)
  total_saved   REAL DEFAULT 0.0,          -- 累计帮用户省了多少钱
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- 第三方登录绑定
CREATE TABLE user_oauths (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  provider      TEXT NOT NULL,             -- 'wechat' | 'github' | ...
  provider_uid  TEXT NOT NULL,
  UNIQUE(provider, provider_uid)
);

-- 导购会话
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id), -- NULL 允许未登录体验
  status        TEXT DEFAULT 'active',     -- 'active' | 'completed'
  summary       TEXT,                      -- 用户最终购买需求总结
  product_count INTEGER DEFAULT 0,        -- 推荐商品数
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- 对话消息
CREATE TABLE messages (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  role          TEXT NOT NULL,             -- 'user' | 'assistant' | 'tool'
  content       TEXT NOT NULL,             -- markdown / JSON
  msg_type      TEXT DEFAULT 'text',       -- 'text' | 'product_card' | 'guide'
  metadata      TEXT,                      -- JSON, 额外数据
  created_at    TEXT DEFAULT (datetime('now'))
);

-- 推荐商品
CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  platform      TEXT NOT NULL,             -- 'taobao' | 'jd' | 'pdd' | 'douyin'
  title         TEXT NOT NULL,
  price         REAL NOT NULL,
  original_price REAL,
  image_url     TEXT,
  item_url      TEXT,                      -- 原始商品页
  coupon_url    TEXT,                      -- 优惠券链接
  commission_rate REAL,                    -- 佣金率
  commission_amount REAL,                  -- 预估佣金
  sales_count   INTEGER,
  shop_name     TEXT,
  rank          INTEGER,                   -- 推荐排序
  created_at    TEXT DEFAULT (datetime('now'))
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
  clicked_at    TEXT DEFAULT (datetime('now')),
  converted_at  TEXT
);

-- 用户积分记录
CREATE TABLE point_transactions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  points        INTEGER NOT NULL,          -- 正=收入, 负=支出
  type          TEXT NOT NULL,             -- 'signin' | 'share' | 'purchase' | 'redeem'
  reference_id  TEXT,                      -- 关联的click/conversion ID
  note          TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
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

## CPS 适配器设计

### 策略模式

所有 CPS 平台统一通过抽象接口调用，新增平台只需实现接口。

```typescript
// packages/backend/src/cps/adapter.ts

interface CPSAdapter {
  /** 平台标识 */
  readonly platform: 'taobao' | 'jd' | 'pdd' | 'douyin';

  /** 搜索商品 */
  search(params: SearchParams): Promise<SearchResult[]>;

  /** 根据商品ID获取详情 */
  getDetail(itemId: string): Promise<ProductDetail>;

  /** 生成推广链接 */
  generatePromotionLink(itemId: string, pid: string): Promise<string>;

  /** 获取佣金信息 */
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
// packages/backend/src/agent/tools.ts

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
6. 用户表示感兴趣后，主动询问是否需要生成推广链接

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
# 认证（腾讯云 CIAM 处理前端登录流程，后端只验证 Token）
POST   /api/auth/ciam-callback     # CIAM 登录后，前端传 Token 给后端换取应用 Session
POST   /api/auth/refresh           # 刷新 CIAM Token
DELETE /api/auth/logout            # 登出

# 聊天
POST   /api/chat/session           # 创建新会话
POST   /api/chat/session/:id       # 发送消息(SSE流式返回)
GET    /api/chat/session/:id       # 获取会话历史
GET    /api/chat/sessions          # 用户的所有会话

# CPS
POST   /api/cps/link               # 生成推广链接(记录点击)
GET    /api/cps/platforms          # 支持的平台列表

# 用户（仅应用级数据）
GET    /api/user/profile           # 用户信息（积分数、导购次数等）
GET    /api/user/points            # 积分明细
POST   /api/user/signin            # 每日签到

# 数据
GET    /api/history                # 导购历史
GET    /api/stats/click            # 点击统计
```

---

## 腾讯云部署

### 前端
- 静态网站托管/腾讯云 COS + CDN
- 自定义域名 www.aixuan.io 绑定 CDN
- HTTPS 证书（腾讯云免费 SSL）
- 构建产物输出到 dist/，上传至 COS

### 后端
- 方案 A: 腾讯云 SCF（云函数） + API 网关
- 方案 B: 轻量云服务器 CVM + PM2
- SQLite 数据库文件存在云硬盘 (CBS) 或 SCF 层中
- 环境变量管理敏感信息（API Keys, Secrets）

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
- TailwindCSS 类：按 布局 → 宽高 → 间距 → 颜色 → 字体 排序
- 所有用户输入先做 XSS 过滤（使用 DOMPurify）

### 样式约定
- 移动端优先，断点: sm(640), md(768), lg(1024), xl(1280)
- 颜色主题: 使用 TailwindCSS 自定义主题色
- 主题色: #2563EB (blue-600) 为主色
- 商品卡片: 圆角、阴影、响应式网格

---

## AI 开发约定

### 对话管理（便于 AI 理解和调整）

```typescript
interface SessionState {
  // 当前会话中已收集的用户需求
  requirements: {
    budget?: [number, number];   // [min, max]
    category?: string;
    scenario?: string;
    brand?: string[];
    features?: string[];
    platform?: string[];
  };
  // 需求收集状态
  clarificationStep: number;
  // 已推荐商品
  recommendedProducts: Product[];
  // 用户选择的商品
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
4. SQLite schema 变更需写迁移脚本

---

## 安全注意事项

- 用户认证由腾讯云 CIAM 全权管理，后端不接触/存储密码
- 后端所有需要鉴权的 API 统一通过 CIAM JWT Token 验证中间件
- 所有的 CPS API Keys 存环境变量，不提交
- 前端不要暴露任何平台的 App Key/Secret
- 推广链接跳转使用 302 重定向（服务端记录点击后跳转）
- 遵循各平台联盟的推广规范，避免封号

---

## 项目路线图

### Phase 1 — MVP (最小可行产品)
- [ ] 基础后端框架搭建（Hono + SQLite + TypeScript）
- [ ] 腾讯云 CIAM 配置与集成（前端登录页 + 后端 Token 验证中间件）
- [ ] 对话式 Agent（Claude API + Function Calling）
- [ ] 淘宝客 CPS 接入（搜索 + 转链）
- [ ] 前端聊天界面（SolidJS + TailwindCSS）
- [ ] 腾讯云部署（前端 COS+CDN / 后端 CVM）

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
