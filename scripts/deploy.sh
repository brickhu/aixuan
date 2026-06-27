#!/usr/bin/env bash
# ============================================================
# aiXuan 一键部署脚本 — 在阿里云轻量服务器上运行
# 用法:
#   curl -fsSL https://raw.githubusercontent.com/fei/aixuan/main/scripts/deploy.sh | bash
#   或手动复制到服务器执行: bash scripts/deploy.sh
# ============================================================
set -euo pipefail

GIT_REPO="git@github.com:brickhu/aixuan.git"
DEPLOY_DIR="/opt/aixuan"
SECRETS_FILE="$DEPLOY_DIR/.secrets.env"

# ── 颜色 ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

echo "========================================"
echo "  aiXuan 一键部署"
echo "========================================"

# ── 1. 检查 root ──
if [ "$(id -u)" -ne 0 ]; then
  error "请以 root 用户运行"
  exit 1
fi

# ── 2. 安装 Docker ──
if ! command -v docker &>/dev/null; then
  echo ""
  echo "--- 安装 Docker ---"
  # 先尝试官方源，失败则换阿里云镜像
  curl -fsSL https://get.docker.com | sh && info "Docker 安装完成" || {
    warn "官方源下载失败，使用阿里云镜像..."
    apt update
    apt install -y ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  }
  info "Docker 安装完成: $(docker --version)"
else
  info "Docker 已安装: $(docker --version)"
fi

# ── 3. 安装 Docker Compose 插件 ──
if ! docker compose version &>/dev/null; then
  echo ""
  echo "--- 安装 Docker Compose ---"
  apt update && apt install -y docker-compose-plugin
fi
info "Docker Compose: $(docker compose version)"

# ── 4. 配置 SSH ──
echo ""
echo "--- 配置 SSH (GitHub) ---"
mkdir -p ~/.ssh
chmod 700 ~/.ssh

if [ ! -f ~/.ssh/deploy-key ]; then
  warn "deploy-key 不存在，正在生成..."
  ssh-keygen -t ed25519 -f ~/.ssh/deploy-key -N "" -C "aixuan-deploy"
  info "密钥已生成: ~/.ssh/deploy-key"
  echo ""
  echo "========== 请将以下公钥添加到 GitHub Deploy Keys =========="
  echo ""
  cat ~/.ssh/deploy-key.pub
  echo ""
  echo "仓库 Settings → Security → Deploy keys → Add deploy key"
  echo "勾选 Allow write access"
  echo "==========================================================="
  echo ""
  read -rp "添加完成后按 Enter 继续..."
else
  info "deploy-key 已存在"
fi

# 配置 SSH config
cat > ~/.ssh/config << 'SSHEOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/deploy-key
  StrictHostKeyChecking no
SSHEOF

# 添加 known_hosts
grep -q "github.com" ~/.ssh/known_hosts 2>/dev/null || \
  ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null
info "SSH 配置完成"

# ── 5. 克隆/拉取代码 ──
echo ""
echo "--- 获取代码 ---"
mkdir -p "$DEPLOY_DIR"

if [ ! -d "$DEPLOY_DIR/.git" ]; then
  info "首次部署，克隆仓库..."
  cd /opt
  rm -rf aixuan
  git clone "$GIT_REPO" aixuan
  info "克隆完成"
else
  info "拉取最新代码..."
  cd "$DEPLOY_DIR"
  git pull origin main
  info "拉取完成"
fi

cd "$DEPLOY_DIR"

# ── 6. 环境变量 ──
echo ""
echo "--- 环境变量配置 ---"

if [ -f "$SECRETS_FILE" ]; then
  source "$SECRETS_FILE"
  info "已从 $SECRETS_FILE 加载环境变量"
fi

# 逐个提示缺失的变量
prompt_if_missing() {
  local var_name=$1
  local default_val=$2
  local prompt_text=$3
  if [ -z "${!var_name:-}" ]; then
    echo -n "$prompt_text [${default_val:-留空}]: "
    read -r input
    export "$var_name=${input:-$default_val}"
  fi
}

prompt_if_missing "DB_PASSWORD" "" "PostgreSQL 密码"
prompt_if_missing "JWT_SECRET" "" "JWT 签名密钥 (留空自动生成)"
prompt_if_missing "DEEPSEEK_API_KEY" "" "DeepSeek API Key"
prompt_if_missing "DEEPSEEK_BASE_URL" "https://api.deepseek.com/anthropic" "DeepSeek API 地址"
prompt_if_missing "DEEPSEEK_MODEL" "deepseek-v4-flash" "DeepSeek 模型名"
prompt_if_missing "CORS_ORIGIN" "https://www.aixuan.io" "前端域名"

# 自动生成 JWT_SECRET
if [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  info "JWT_SECRET 已自动生成"
fi

# 保存到 secrets 文件（供后续部署复用）
cat > "$SECRETS_FILE" << EOF
DB_PASSWORD=${DB_PASSWORD:-}
JWT_SECRET=${JWT_SECRET:-}
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-}
DEEPSEEK_BASE_URL=${DEEPSEEK_BASE_URL:-}
DEEPSEEK_MODEL=${DEEPSEEK_MODEL:-}
CORS_ORIGIN=${CORS_ORIGIN:-}
EOF
chmod 600 "$SECRETS_FILE"
info "环境变量已保存到 $SECRETS_FILE"

# 生成 docker compose 用的 .env
cat > "$DEPLOY_DIR/.env" << EOF
DB_PASSWORD=${DB_PASSWORD:-}
JWT_SECRET=${JWT_SECRET:-}
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-}
DEEPSEEK_BASE_URL=${DEEPSEEK_BASE_URL:-}
DEEPSEEK_MODEL=${DEEPSEEK_MODEL:-}
CORS_ORIGIN=${CORS_ORIGIN:-}
EOF

# ── 7. 构建并启动 ──
echo ""
echo "--- 构建并启动服务 ---"
cd "$DEPLOY_DIR"
docker compose up -d --build
info "服务已启动"

# ── 8. 等待并验证 ──
echo ""
echo "--- 验证服务状态 ---"
sleep 5

if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
  info "后端 API 健康检查通过 ✅"
  curl -s http://localhost:3000/api/health | python3 -m json.tool 2>/dev/null || \
    curl -s http://localhost:3000/api/health
else
  warn "健康检查尚未通过，查看日志..."
  docker compose logs --tail=20 backend
fi

echo ""
echo "========================================"
echo "  容器状态"
echo "========================================"
docker compose ps

echo ""
echo "========================================"
echo "  ✅ aiXuan 部署完成!"
echo "========================================"
echo "  API:      http://47.99.65.147:3000/api/health"
echo "  目录:     $DEPLOY_DIR"
echo "  密钥:     $SECRETS_FILE"
echo "  日志:     docker compose logs -f"
echo "  重启:     docker compose restart"
echo "  更新:     cd $DEPLOY_DIR && git pull && docker compose up -d --build"
echo "========================================"