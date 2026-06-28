#!/usr/bin/env bash
# ===========================================
# aiXuan — Let's Encrypt SSL 首次申请 + 自动续期配置
# 用法: ssh root@47.99.65.147 'bash -s' < scripts/ssl-setup.sh
# ===========================================
set -euo pipefail

DEPLOY_DIR="/opt/aixuan"
DOMAIN="api.aixuan.vip"
EMAIL="admin@aixuan.vip"

cd "$DEPLOY_DIR"

echo ""
echo "=== 1. 创建 certbot 工作目录 ==="
mkdir -p certbot/www

echo ""
echo "=== 2. 申请证书（webroot 模式，无需停服务） ==="
docker run --rm \
  -v "$DEPLOY_DIR/certbot/www:/var/www/certbot" \
  -v "$DEPLOY_DIR/ssl:/etc/letsencrypt" \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --non-interactive --agree-tos \
  -m "$EMAIL"

echo ""
echo "=== 3. 创建证书软链接（nginx 通过 ssl/ 目录读取） ==="
ln -sf /etc/letsencrypt/live/$DOMAIN/fullchain.pem "$DEPLOY_DIR/ssl/fullchain.pem"
ln -sf /etc/letsencrypt/live/$DOMAIN/privkey.pem "$DEPLOY_DIR/ssl/privkey.pem"

echo ""
echo "=== 4. 重启 Nginx 加载证书 ==="
docker compose restart nginx

echo ""
echo "=== 5. 添加 crontab 自动续期（每月 1 号凌晨 3 点） ==="
RENEW_SCRIPT="$DEPLOY_DIR/scripts/ssl-renew.sh"
if [ -f "$RENEW_SCRIPT" ]; then
  CRON_JOB="0 3 1 * * $RENEW_SCRIPT >> $DEPLOY_DIR/certbot/renew.log 2>&1"
  if ! crontab -l 2>/dev/null | grep -Fq "$RENEW_SCRIPT"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "   crontab 已添加"
  else
    echo "   crontab 已存在，跳过"
  fi
fi

echo ""
echo "=== ✅ SSL 配置完成 ==="
echo "   证书路径: $DEPLOY_DIR/ssl/fullchain.pem"
echo "   私钥路径: $DEPLOY_DIR/ssl/privkey.pem"
echo "   测试: https://$DOMAIN/api/health"
echo ""
echo "   自动续期: 每月 1 号凌晨 3 点执行，日志: $DEPLOY_DIR/certbot/renew.log"