#!/usr/bin/env bash
# 测试认证流程
set -euo pipefail

API="http://localhost:3000"
EMAIL="test@example.com"

echo "=== 1. 发送验证码 ==="
curl -s -X POST "$API/api/auth/send-code" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\"}" | python3 -m json.tool

echo ""
echo "=== 2. 查看后端日志获取验证码 ==="
echo "   请先查看终端日志中的 [EMAIL CODE] 值"
echo "   然后运行: export CODE=XXXXXX"
echo "   再重新运行此脚本的后半部分"

# 以下部分需要先设置 CODE 环境变量
if [ -n "${CODE:-}" ]; then
  echo ""
  echo "=== 3. 验证码登录 ==="
  RESPONSE=$(curl -s -X POST "$API/api/auth/verify-code" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}")
  echo "$RESPONSE" | python3 -m json.tool

  TOKEN=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['token'] if data.get('ok') else 'ERROR: ' + data.get('error', 'unknown'))
  ")

  echo ""
  echo "=== 4. JWT Token (前50字符) ==="
  echo "${TOKEN:0:50}..."

  echo ""
  echo "=== 5. GET /me (带 token) ==="
  curl -s "$API/api/auth/me" \
    -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

  echo ""
  echo "=== 6. GET /me (无 token) ==="
  curl -s "$API/api/auth/me" | python3 -m json.tool

  echo ""
  echo "=== 7. 错误验证码测试 ==="
  curl -s -X POST "$API/api/auth/verify-code" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"code\":\"000000\"}" | python3 -m json.tool

  echo ""
  echo "=== 8. 无效邮箱测试 ==="
  curl -s -X POST "$API/api/auth/send-code" \
    -H 'Content-Type: application/json' \
    -d '{"email":"not-an-email"}' | python3 -m json.tool
fi