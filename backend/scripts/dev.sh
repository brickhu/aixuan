#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# 检查 .env
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "[dev] 创建 .env 文件（请先编辑其中的密钥）"
    cp .env.example .env
    echo ""
    echo "======================================"
    echo "  首次运行前请完成以下步骤："
    echo "======================================"
    echo ""
    echo "  1. 编辑 .env 文件，填入 ANTHROPIC_API_KEY"
    echo ""
    echo "  2. 确保本地 PostgreSQL 已启动："
    echo "     docker compose up -d   # 启动 PostgreSQL 容器"
    echo "     # 或使用本机安装的 PostgreSQL"
    echo ""
    echo "  3. 创建数据库（如不存在）："
    echo "     docker compose exec postgres psql -U postgres -c 'CREATE DATABASE aixuan;'"
    echo ""
    echo "  4. 运行 pnpm dev 启动服务"
    echo "======================================"
    echo ""
    exit 1
  fi
fi

echo "[dev] 检查 PostgreSQL 连接..."
# 快速检测 PG 是否可连（不阻塞启动）
timeout 3 psql "${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/aixuan}" -c 'SELECT 1' > /dev/null 2>&1 && \
  echo "[dev] PostgreSQL 连接正常" || \
  echo "[dev] 警告: 无法连接 PostgreSQL，请确保数据库已启动"

echo "[dev] 启动开发服务器..."
exec pnpm dev
