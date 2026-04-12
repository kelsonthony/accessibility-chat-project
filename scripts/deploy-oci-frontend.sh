#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:-opc@157.151.29.59}"
SSH_KEY="${SSH_KEY:-/Users/kelsonthony/Dev/projects/acesso-oracle-cloud/ssh-key-2026-04-03.key}"
REMOTE_DIR="${REMOTE_DIR:-/home/opc/accessibility-chat-project}"
REMOTE_IMAGE="${REMOTE_IMAGE:-local/accesschat-frontend:latest}"
NAMESPACE="${NAMESPACE:-accesschat}"
PUBLIC_API_URL="${PUBLIC_API_URL:-https://api-accesschat.157-151-29-59.sslip.io}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-978121972336-4fun2pbbhkmsp6jhuhig31sb1a7m1uoe.apps.googleusercontent.com}"

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
  "export REMOTE_DIR='${REMOTE_DIR}' REMOTE_IMAGE='${REMOTE_IMAGE}' NAMESPACE='${NAMESPACE}' PUBLIC_API_URL='${PUBLIC_API_URL}' GOOGLE_CLIENT_ID='${GOOGLE_CLIENT_ID}' && bash -s" <<'EOF'
set -euo pipefail

cd "$REMOTE_DIR"

docker build \
  -t "$REMOTE_IMAGE" \
  -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL="$PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  .

docker save "$REMOTE_IMAGE" | sudo /usr/local/bin/k3s ctr images import -

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/accesschat-frontend.yaml
kubectl rollout restart deployment/accesschat-frontend -n "$NAMESPACE"
kubectl rollout status deployment/accesschat-frontend -n "$NAMESPACE" --timeout=180s
kubectl get svc -n "$NAMESPACE" accesschat-frontend
kubectl get pods -n "$NAMESPACE" -o wide
EOF
