#!/usr/bin/env bash
# ===========================================
# aiXuan — Let's Encrypt SSL 自动续期（被 crontab 调用）
# ===========================================
set -euo pipefail

DEPLOY_DIR="/opt/aixuan"
DOMAIN="api.aixuan.vip"
LOG_FILE="$DEPLOY_DIR/certbot/renew.log"

exec >> "$LOG_FILE" 2>&1
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始续期检查..."

cd "$DEPLOY_DIR"

# 续期证书
docker run --rm \
  -v "$DEPLOY_DIR/certbot/www:/var/www/certbot" \
  -v "$DEPLOY_DIR/ssl:/etc/letsencrypt" \
  certbot/certbot renew --webroot -w /var/www/certbot

# 重启 Nginx 加载新证书
docker compose restart nginx

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 续期完成"