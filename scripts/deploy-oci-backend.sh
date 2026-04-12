#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:-opc@157.151.29.59}"
SSH_KEY="${SSH_KEY:-/Users/kelsonthony/Dev/projects/acesso-oracle-cloud/ssh-key-2026-04-03.key}"
REMOTE_DIR="${REMOTE_DIR:-/home/opc/accessibility-chat-project}"
REMOTE_IMAGE="${REMOTE_IMAGE:-local/accesschat-backend:latest}"
NAMESPACE="${NAMESPACE:-accesschat}"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo ".env not found at $ROOT_DIR/.env" >&2
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ -z "$line" || "$line" == \#* ]]; then
    continue
  fi

  key="${line%%=*}"
  value="${line#*=}"
  export "$key=$value"
done < "$ROOT_DIR/.env"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required in .env" >&2
  exit 1
fi

REMOTE_DATABASE_URL="${DATABASE_URL/127.0.0.1:15432/kelsontocompile-postgres.kelsontocompile.svc.cluster.local:5432}"

tar \
  --exclude=".git" \
  --exclude="node_modules" \
  --exclude="frontend/.next" \
  --exclude="frontend/.next-dev" \
  --exclude="backend/dist" \
  --exclude=".oracle-cloud-tunnels.log" \
  --exclude=".oracle-cloud-tunnels.pid" \
  --exclude=".oracle-cloud-tunnels.sock" \
  -czf - \
  -C "$ROOT_DIR" . \
  | ssh -i "$SSH_KEY" "$REMOTE_HOST" "rm -rf '$REMOTE_DIR' && mkdir -p '$REMOTE_DIR' && tar -xzf - -C '$REMOTE_DIR'"

ssh -i "$SSH_KEY" "$REMOTE_HOST" \
  "export REMOTE_DIR='${REMOTE_DIR}' \
    REMOTE_IMAGE='${REMOTE_IMAGE}' \
    NAMESPACE='${NAMESPACE}' \
    DATABASE_URL='${REMOTE_DATABASE_URL}' \
    JWT_KEY_ID='${JWT_KEY_ID:-}' \
    JWT_PRIVATE_KEY_BASE64='${JWT_PRIVATE_KEY_BASE64:-}' \
    JWT_PUBLIC_KEY_BASE64='${JWT_PUBLIC_KEY_BASE64:-}' \
    GOOGLE_CLIENT_ID='${GOOGLE_CLIENT_ID:-}' \
    GOOGLE_CLIENT_SECRET='${GOOGLE_CLIENT_SECRET:-}' \
    LLM_API_URL='${LLM_API_URL:-}' \
    LLM_API_KEY='${LLM_API_KEY:-}' \
    LLM_MODEL='${LLM_MODEL:-}' \
    LLM_TIMEOUT_MS='${LLM_TIMEOUT_MS:-15000}' \
    LLM_PROMPT_VERSION='${LLM_PROMPT_VERSION:-v1-grounded-sources}' \
    EMAIL_DELIVERY_MODE='${EMAIL_DELIVERY_MODE:-console}' \
    EMAIL_API_URL='${EMAIL_API_URL:-}' \
    EMAIL_API_KEY='${EMAIL_API_KEY:-}' \
    EMAIL_FROM_ADDRESS='${EMAIL_FROM_ADDRESS:-}' \
    EMAIL_FROM_NAME='${EMAIL_FROM_NAME:-Access Chat}' \
    EMAIL_FAILOVER_TO_CONSOLE='${EMAIL_FAILOVER_TO_CONSOLE:-true}' \
    SIGNUP_CODE_TTL_MS='${SIGNUP_CODE_TTL_MS:-60000}' \
    PASSWORD_RESET_CODE_TTL_MS='${PASSWORD_RESET_CODE_TTL_MS:-600000}' \
    CAPTCHA_TTL_MS='${CAPTCHA_TTL_MS:-300000}' \
    WHATSAPP_API_BASE_URL='${WHATSAPP_API_BASE_URL:-https://api.twilio.com}' \
    WHATSAPP_ACCOUNT_SID='${WHATSAPP_ACCOUNT_SID:-}' \
    WHATSAPP_AUTH_TOKEN='${WHATSAPP_AUTH_TOKEN:-}' \
    WHATSAPP_FROM_NUMBER='${WHATSAPP_FROM_NUMBER:-whatsapp:+14155238886}' \
    WHATSAPP_WEBHOOK_AUTH_TOKEN='${WHATSAPP_WEBHOOK_AUTH_TOKEN:-}' \
    && bash -s" <<'EOF'
set -euo pipefail

cd "$REMOTE_DIR"

docker build -t "$REMOTE_IMAGE" -f backend/Dockerfile .
docker save "$REMOTE_IMAGE" | sudo /usr/local/bin/k3s ctr images import -

kubectl apply -f k8s/namespace.yaml

kubectl create secret generic accesschat-backend-secrets \
  -n "$NAMESPACE" \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=JWT_KEY_ID="$JWT_KEY_ID" \
  --from-literal=JWT_PRIVATE_KEY_BASE64="$JWT_PRIVATE_KEY_BASE64" \
  --from-literal=JWT_PUBLIC_KEY_BASE64="$JWT_PUBLIC_KEY_BASE64" \
  --from-literal=GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  --from-literal=GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
  --from-literal=LLM_API_URL="$LLM_API_URL" \
  --from-literal=LLM_API_KEY="$LLM_API_KEY" \
  --from-literal=LLM_MODEL="$LLM_MODEL" \
  --from-literal=LLM_TIMEOUT_MS="$LLM_TIMEOUT_MS" \
  --from-literal=LLM_PROMPT_VERSION="$LLM_PROMPT_VERSION" \
  --from-literal=EMAIL_DELIVERY_MODE="$EMAIL_DELIVERY_MODE" \
  --from-literal=EMAIL_API_URL="$EMAIL_API_URL" \
  --from-literal=EMAIL_API_KEY="$EMAIL_API_KEY" \
  --from-literal=EMAIL_FROM_ADDRESS="$EMAIL_FROM_ADDRESS" \
  --from-literal=EMAIL_FROM_NAME="$EMAIL_FROM_NAME" \
  --from-literal=EMAIL_FAILOVER_TO_CONSOLE="$EMAIL_FAILOVER_TO_CONSOLE" \
  --from-literal=SIGNUP_CODE_TTL_MS="$SIGNUP_CODE_TTL_MS" \
  --from-literal=PASSWORD_RESET_CODE_TTL_MS="$PASSWORD_RESET_CODE_TTL_MS" \
  --from-literal=CAPTCHA_TTL_MS="$CAPTCHA_TTL_MS" \
  --from-literal=WHATSAPP_API_BASE_URL="$WHATSAPP_API_BASE_URL" \
  --from-literal=WHATSAPP_ACCOUNT_SID="$WHATSAPP_ACCOUNT_SID" \
  --from-literal=WHATSAPP_AUTH_TOKEN="$WHATSAPP_AUTH_TOKEN" \
  --from-literal=WHATSAPP_FROM_NUMBER="$WHATSAPP_FROM_NUMBER" \
  --from-literal=WHATSAPP_WEBHOOK_AUTH_TOKEN="$WHATSAPP_WEBHOOK_AUTH_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f k8s/accesschat-backend.yaml
kubectl rollout restart deployment/accesschat-backend -n "$NAMESPACE"
kubectl rollout status deployment/accesschat-backend -n "$NAMESPACE" --timeout=180s
kubectl get svc -n "$NAMESPACE" accesschat-backend
kubectl get pods -n "$NAMESPACE" -o wide
EOF
