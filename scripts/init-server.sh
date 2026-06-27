#!/usr/bin/env bash
# ============================================================
# 阿里云轻量服务器初始化脚本
# 用法: ssh root@服务器IP 'bash -s' < init-server.sh
# ============================================================
set -euo pipefail

echo "========================================"
echo "  aiXuan 服务器初始化"
echo "========================================"

# ── 1. 系统更新 ──
echo "[1/7] 更新系统..."
apt update && apt upgrade -y

# ── 2. 安装 Docker ──
echo "[2/7] 安装 Docker..."
curl -fsSL https://get.docker.com | sh

# ── 3. 安装 Docker Compose 插件 ──
echo "[3/7] 安装 Docker Compose 插件..."
apt install -y docker-compose-plugin

# ── 4. 配置 UFW 防火墙 ──
echo "[4/7] 配置防火墙..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH'
ufw allow 80/tcp    comment 'HTTP'
ufw allow 443/tcp   comment 'HTTPS'
ufw --force enable
ufw status verbose

# ── 5. 创建部署目录 ──
echo "[5/7] 创建部署目录..."
mkdir -p /opt/aixuan/{ssl,data,backend}
chmod 755 /opt/aixuan

# ── 6. 验证安装 ──
echo "[6/7] 验证安装..."
docker --version
docker compose version

# ── 7. 输出信息 ──
echo "[7/7] 完成!"
echo ""
echo "========================================"
echo "  服务器信息"
echo "========================================"
echo "  IP:       $(curl -s ifconfig.me)"
echo "  Docker:   $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo "  Compose:  $(docker compose version | cut -d' ' -f4 | tr -d ',')"
echo "  UFW:      已启用 (22,80,443)"
echo ""
echo "  部署目录: /opt/aixuan/"
echo "  部署方式: docker compose up -d"
echo "========================================"