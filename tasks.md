# 云平台迁移实施计划: CloudBase → 阿里云

## 概述

将项目从腾讯云 CloudBase 迁移至阿里云，涉及认证系统重构、部署架构切换、CI/CD 更新。

---

## Step 1 — 阿里云基础设施采购 & 配置

### 1.1 购买轻量应用服务器

> 控制台: https://swas.console.aliyun.com/

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| 地域 | 华东1（杭州）或 华东2（上海） | 离用户近即可 |
| 镜像 | Ubuntu 22.04 | 稳定、社区活跃 |
| 套餐 | 2核2G / 3Mbps | ¥24/月 起，够用 |
| 数据盘 | 40GB SSD | 系统盘默认已含 |
| 时长 | 1个月（可续费） | 先买1个月测试 |

**购买步骤：**
1. 登录阿里云控制台 → 轻量应用服务器
2. 点击「创建实例」
3. 选择套餐 → 镜像（Ubuntu）→ 设置密码
4. 确认购买

**购买后获取：**
- 服务器公网 IP（记下来，后续所有配置需要）
- root 密码（或 SSH 密钥）
- 安全组规则（默认已开放 22、80、443）

### 1.2 购买 OSS（静态托管用）

> 控制台: https://oss.console.aliyun.com/

1. 创建 Bucket
   - Bucket 名称: `aixuan-static`（全局唯一）
   - 地域: 与服务器保持一致
   - 读写权限: **公共读**
2. 开通 OSS 资源包（可选，按量付费也很便宜）
3. 开通「静态网站托管」
   - Bucket 配置 → 静态页面 → 开启
   - 默认首页: `index.html`
   - 默认404页: `index.html`（SPA 路由需要）

### 1.3 服务器初始化（一键脚本）

首次 SSH 登录后，运行以下脚本完成初始化：

```bash
# 登录服务器
ssh root@你的服务器IP

# 复制粘贴以下全部内容到终端执行
set -e

echo "=== 1. 更新系统 ==="
apt update && apt upgrade -y

echo "=== 2. 安装 Docker ==="
curl -fsSL https://get.docker.com | sh

echo "=== 3. 安装 Docker Compose 插件 ==="
apt install -y docker-compose-plugin

echo "=== 4. 配置防火墙 (UFW) ==="
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

echo "=== 5. 验证 Docker ==="
docker --version
docker compose version

echo "=== 6. 创建部署目录 ==="
mkdir -p /opt/aixuan
mkdir -p /opt/aixuan/ssl
mkdir -p /opt/aixuan/data  # PostgreSQL 数据卷挂载点

echo "=== 7. 创建部署用户（可选）==="
adduser --system --group deployer || true
usermod -aG docker deployer

echo ""
echo "========== 初始化完成 =========="
echo "服务器 IP: $(curl -s ifconfig.me)"
echo "Docker: $(docker --version)"
echo "下一步: 在 /opt/aixuan/ 部署项目"
```

### 1.4 域名 DNS 配置

> 控制台: https://dns.console.aliyun.com/

假设你的域名 `www.aixuan.vip` 在阿里云 DNS 管理：

| 记录类型 | 主机记录 | 记录值 | 说明 |
|----------|----------|--------|------|
| CNAME | `www` | OSS Bucket 域名 | 前端静态托管 |
| A | `api` | `47.99.65.147` | 后端 API（Nginx 反向代理） |

如果域名不在阿里云，需要在当前 DNS 服务商处添加以上记录。

### 1.5 准备 SSL 证书

为 `api.aixuan.vip` 申请 SSL 证书（Nginx 需要）：

**方案一：阿里云免费证书（推荐，省心）**
> 控制台: https://yundun.console.aliyun.com/?p=cas
1. 进入 SSL 证书 → 免费证书 → 立即购买（0元）
2. 申请证书，绑定域名 `api.aixuan.vip`
3. 域名验证通过后下载证书（Nginx 格式）
4. 后续 Step 3 部署时使用

**方案二：Let's Encrypt（自动化）**
```bash
# 在服务器上执行（需先开放 80 端口）
docker run -it --rm -v /opt/aixuan/ssl:/etc/letsencrypt \
  -p 80:80 certbot/certbot certonly --standalone \
  -d api.aixuan.vip --non-interactive --agree-tos \
  -m your@email.com
```

---

## Step 2 — 认证系统重构 ✅ （已完成）

### 2.1 JWT 工具模块
- [x] 新增 `backend/src/auth/jwt.ts`
  - `signToken(userId)`: 签发 JWT（HS256，7天过期）
  - `verifyToken(token)`: 验证并解码 JWT
- [x] 使用 `jose` 库（项目已有依赖）

### 2.2 邮箱验证码模块
- [x] 内联实现，使用 Map 内存存储验证码
- [x] 开发环境打印到控制台，生产环境替换为阿里云邮件推送

### 2.3 中间件重构
- [x] 重写 `backend/src/middleware/auth.ts`
- [x] 移除 CloudBase JWKS 相关代码

### 2.4 认证路由重构
- [x] `POST /api/auth/send-code`: 发送邮箱验证码
- [x] `POST /api/auth/verify-code`: 验证码登录（签发 JWT）
- [x] `GET /api/auth/me`: 获取当前用户信息
- [ ] `GET /api/auth/oauth/:platform`: OAuth 占位路由（待完善）
- [ ] `GET /api/auth/oauth/callback`: OAuth 回调（待实现）

### 2.5 用户模块更新
- [x] `findOrCreateUserByEmail(email)`: 查找或创建用户
- [x] `findUserById(id)`: 通过 ID 查询用户
- [x] 移除 CloudBase 用户同步逻辑

### 2.6 数据库迁移
- [x] users 表新增 email, email_verified, wechat_openid, alipay_user_id 字段

### 2.7 配置更新
- [x] `backend/src/config.ts`: 移除 cloudbase，增加 jwtSecret
- [x] `backend/.env.example`: 移除 CLOUDBASE 相关变量

---

## Step 3 — 部署配置更新

### 3.1 生产环境 docker-compose
- [ ] 新增 `docker-compose.yml`（项目根目录）
  - postgres:17-alpine 服务
  - backend 服务（构建本地 Dockerfile）
  - nginx 服务（SSL termination + 反向代理）

### 3.2 Nginx 配置
- [ ] 新增 `nginx.conf`
  - HTTP → HTTPS 重定向
  - /api/ 反向代理到 backend:3000
  - SSE 支持（proxy_buffering off）
  - 静态资源重定向到阿里云静态托管

### 3.3 环境变量
- [ ] 新增 `backend/.env.production`
  - DATABASE_URL 指向 Docker 内网
  - JWT_SECRET 使用强随机字符串
  - CORS_ORIGIN 设为 `https://www.aixuan.vip`（前端域名）

---

## Step 4 — CI/CD 更新

### 4.1 GitHub Actions
- [ ] 重写 `.github/workflows/deploy.yml`
  - 移除 CloudBase CLI 步骤
  - 新增 SSH 连接到轻量服务器
  - 在服务器上执行 `docker compose pull && docker compose up -d --build`

### 4.2 GitHub Secrets
- [ ] 配置 `SERVER_SSH_KEY`: 服务器的 SSH 私钥
- [ ] 配置 `SERVER_HOST`: 服务器 IP
- [ ] 配置 `SERVER_USER`: SSH 用户名
- [ ] 配置 `JWT_SECRET` 等环境变量

### 4.3 前端部署 CI
- [ ] 前端构建流程（前端项目创建后启用）
- [ ] 自动上传到阿里云 OSS

---

## Step 5 — 部署 & 验证

### 5.1 本地验证
- [ ] 本地运行 `docker compose up` 验证完整链路
- [ ] 测试认证流程（发送验证码 → 验证 → 获取 JWT）
- [ ] 测试 API 健康检查

### 5.2 服务器部署
- [ ] 推送代码到 GitHub
- [ ] 手动 SSH 执行首次部署
- [ ] 验证 Docker 容器运行状态
- [ ] 验证 Nginx SSL 配置
- [ ] 验证 API 接口正常响应

### 5.3 DNS 切换（CNAME 到 OSS + A 记录到服务器）

**后端验证：**
- [ ] 添加 A 记录 `api.aixuan.vip → 47.99.65.147`
- [ ] 通过 `https://api.aixuan.vip/api/health` 验证 API

**前端验证（前端项目创建后）：**
- [ ] 添加 CNAME `www.aixuan.vip → OSS Bucket 域名`
- [ ] 通过 `https://www.aixuan.vip` 访问前端

### 5.4 最终验证
- [ ] 前端页面正常显示
- [ ] 前端请求 `https://api.aixuan.vip/api/*` 正常返回
- [ ] 测试完整登录流程
- [ ] 检查 GitHub Actions 自动部署是否正常

---

## 涉及文件清单

### 新增文件
| 文件 | 说明 | 状态 |
|------|------|------|
| `backend/src/auth/jwt.ts` | JWT 签发/验证工具 | ✅ 已完成 |
| `docker-compose.yml` | 生产环境 Docker 编排 | ⏳ Step 3 |
| `nginx.conf` | Nginx 反向代理配置 | ⏳ Step 3 |
| `backend/.env.production` | 生产环境变量 | ⏳ Step 3 |
| `scripts/init-server.sh` | 服务器初始化脚本 | ⏳ Step 1 |

### 修改文件
| 文件 | 说明 | 状态 |
|------|------|------|
| `backend/src/config.ts` | 移除 cloudbase，增加 jwtSecret | ✅ 已完成 |
| `backend/src/middleware/auth.ts` | 自定义 JWT 验证 | ✅ 已完成 |
| `backend/src/routes/auth.ts` | 邮箱验证码 + OAuth 路由 | ✅ 已完成 |
| `backend/src/user/auth.ts` | 本地用户管理 | ✅ 已完成 |
| `backend/.env.example` | 移除 CloudBase 变量 | ✅ 已完成 |
| `backend/src/db/migrate.ts` | 更新 users 表字段 | ✅ 已完成 |
| `.github/workflows/deploy.yml` | SSH Docker 部署 | ⏳ Step 4 |
| `CLAUDE.md` | 项目规则文件 | ✅ 已完成 |