# 爱选 (aiXuan) — AI 导购平台

爱选是一个 **AI 驱动的商品导购平台**，用户通过自然语言对话描述购买需求，AI 逐步引导用户明确需求，最终生成带 CPS 推广链接的商品推荐。

- **官网**: [www.aixuan.vip](https://www.aixuan.vip)
- **定位**: 通用导购系统，覆盖多电商平台的 CPS
- **盈利模式**: CPS 分佣 + 用户积分/返利体系
- **开发方式**: 全程 AI 驱动

## 技术栈

### 前端
- **框架**: [SolidJS](https://solidjs.com)（响应式，细粒度更新）
- **样式**: [TailwindCSS](https://tailwindcss.com)
- **构建**: [Vite](https://vitejs.dev)
- **路由**: solid-router
- **部署**: 腾讯云Cloudbase静态托管

### 后端
- **运行时**: Node.js + TypeScript（strict 模式）
- **框架**: Hono
- **数据库**: SQLite
- **AI**: Claude API + Function Calling

### 用户系统
- **认证**: 腾讯云 CIAM（微信扫码 / 手机验证码 / 邮箱密码 / 小程序授权）
- **数据**: CIAM 托管用户基础信息，应用数据库仅存用户 ID 和应用级数据

### CPS 联盟接入（直连官方 API）
| 平台 | API |
|------|-----|
| 淘宝/天猫 | 阿里妈妈 TOP API |
| 京东 | 京东联盟 API |
| 拼多多 | 多多客 API |
| 抖音 | 抖客 API（待确认） |

## 项目结构

```
aixuan/
├── frontend/              # SolidJS 前端
│   └── src/
│       ├── components/    # 通用组件
│       ├── routes/        # 页面
│       ├── stores/        # 信号存储
│       ├── api/           # 后端 API 调用
│       └── types/         # 共享类型
├── backend/               # Node.js 后端
│   └── src/
│       ├── agent/         # Agent 核心（对话管理、Function Calling、提示词）
│       ├── cps/           # CPS 适配器（策略模式，支持多平台）
│       ├── user/          # 用户模块（CIAM Token 验证、积分管理）
│       ├── routes/        # API 路由
│       └── middleware/    # 中间件
├── scripts/               # 开发/部署脚本
└── CLAUDE.md              # AI 开发约定与技术文档
```

## 快速开始

```bash
# 安装依赖
cd frontend && pnpm install
cd backend && pnpm install

# 启动开发环境
./scripts/dev.sh
```

## 积分与返利体系

| 行为 | 积分 | 说明 |
|------|------|------|
| 每日签到 | +5 | 每天一次 |
| 完成导购会话 | +10 | 对话 ≥3 条消息 |
| 分享导购报告 | +20 | 通过分享链接 |
| 通过链接购买 | 佣金等值积分 | 确认收货后到账 |
| 邀请新用户 | +50 | 新用户完成首次导购 |
| 积分兑换 | -N | 提现/兑换礼品 |

## 路线图

- **Phase 1 — MVP**: 基础后端框架、CIAM 集成、对话 Agent、淘宝客 CPS、前端聊天界面、腾讯云部署
- **Phase 2 — 扩展**: 京东/拼多多接入、商品卡片优化、积分签到、导购历史
- **Phase 3 — 完善**: 抖音接入、分享裂变、转化看板、SEO 优化

## License

MIT
