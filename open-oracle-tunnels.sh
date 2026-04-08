#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_SSH_KEY="$SCRIPT_DIR/infra/acesso-oracle-cloud/ssh-key-2026-04-03.key"
DEFAULT_WORKSPACE_SSH_KEY="/Users/kelsonthony/Dev/projects/acesso-oracle-cloud/ssh-key-2026-04-03.key"
if [[ -n "${SSH_KEY:-}" ]]; then
  SSH_KEY="$SSH_KEY"
elif [[ -f "$DEFAULT_REPO_SSH_KEY" ]]; then
  SSH_KEY="$DEFAULT_REPO_SSH_KEY"
else
  SSH_KEY="$DEFAULT_WORKSPACE_SSH_KEY"
fi
REMOTE_HOST="${REMOTE_HOST:-opc@157.151.29.59}"
PID_FILE="${PID_FILE:-$SCRIPT_DIR/.oracle-cloud-tunnels.pid}"
LOG_FILE="${LOG_FILE:-$SCRIPT_DIR/.oracle-cloud-tunnels.log}"
CONTROL_SOCKET="${CONTROL_SOCKET:-$SCRIPT_DIR/.oracle-cloud-tunnels.sock}"

LOCAL_POSTGRES_PORT="${LOCAL_POSTGRES_PORT:-15432}"
LOCAL_REDIS_PORT="${LOCAL_REDIS_PORT:-16379}"
LOCAL_MONGO_PORT="${LOCAL_MONGO_PORT:-27017}"
LOCAL_SONAR_DB_PORT="${LOCAL_SONAR_DB_PORT:-15433}"
LOCAL_MINIO_S3_PORT="${LOCAL_MINIO_S3_PORT:-19000}"
LOCAL_MINIO_CONSOLE_PORT="${LOCAL_MINIO_CONSOLE_PORT:-19001}"
LOCAL_API_PORT="${LOCAL_API_PORT:-8080}"
LOCAL_JENKINS_PORT="${LOCAL_JENKINS_PORT:-8081}"

usage() {
  cat <<EOF
Uso:
  ./open-oracle-tunnels.sh start
  ./open-oracle-tunnels.sh stop
  ./open-oracle-tunnels.sh restart
  ./open-oracle-tunnels.sh status

Tuneis locais:
  Postgres kelsontocompile: 127.0.0.1:${LOCAL_POSTGRES_PORT}   -> 10.43.193.153:5432
  Redis:              127.0.0.1:${LOCAL_REDIS_PORT}      -> 10.43.101.58:6379
  Mongo:              127.0.0.1:${LOCAL_MONGO_PORT}      -> 10.43.230.29:27017
  Postgres SonarQube: 127.0.0.1:${LOCAL_SONAR_DB_PORT}   -> 10.43.73.227:5432
  MinIO S3:           127.0.0.1:${LOCAL_MINIO_S3_PORT}   -> 10.43.30.181:9000
  MinIO Console:      127.0.0.1:${LOCAL_MINIO_CONSOLE_PORT} -> 10.43.30.181:9001
  API:                127.0.0.1:${LOCAL_API_PORT}        -> 127.0.0.1:31385
  Jenkins:            127.0.0.1:${LOCAL_JENKINS_PORT}    -> 127.0.0.1:8081
EOF
}

is_running() {
  [[ -S "$CONTROL_SOCKET" ]] && ssh -S "$CONTROL_SOCKET" -O check "$REMOTE_HOST" >/dev/null 2>&1
}

require_free_port() {
  local port="$1"
  if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Porta local ${port} ja esta em uso. Pare o processo atual antes de abrir os tuneis." >&2
    exit 1
  fi
}

start_tunnels() {
  if is_running; then
    echo "Tuneis ja estao abertos com PID $(cat "$PID_FILE")."
    return 0
  fi

  require_free_port "$LOCAL_POSTGRES_PORT"
  require_free_port "$LOCAL_REDIS_PORT"
  require_free_port "$LOCAL_MONGO_PORT"
  require_free_port "$LOCAL_SONAR_DB_PORT"
  require_free_port "$LOCAL_MINIO_S3_PORT"
  require_free_port "$LOCAL_MINIO_CONSOLE_PORT"
  require_free_port "$LOCAL_API_PORT"
  require_free_port "$LOCAL_JENKINS_PORT"

  rm -f "$CONTROL_SOCKET"

  ssh \
    -f \
    -N \
    -M \
    -S "$CONTROL_SOCKET" \
    -i "$SSH_KEY" \
    -o ExitOnForwardFailure=yes \
    -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=60 \
    -o ServerAliveCountMax=3 \
    -L "${LOCAL_POSTGRES_PORT}:10.43.193.153:5432" \
    -L "${LOCAL_REDIS_PORT}:10.43.101.58:6379" \
    -L "${LOCAL_MONGO_PORT}:10.43.230.29:27017" \
    -L "${LOCAL_SONAR_DB_PORT}:10.43.73.227:5432" \
    -L "${LOCAL_MINIO_S3_PORT}:10.43.30.181:9000" \
    -L "${LOCAL_MINIO_CONSOLE_PORT}:10.43.30.181:9001" \
    -L "${LOCAL_API_PORT}:127.0.0.1:31385" \
    -L "${LOCAL_JENKINS_PORT}:127.0.0.1:8081" \
    "$REMOTE_HOST" \
    >"$LOG_FILE" 2>&1

  sleep 1

  if is_running; then
    pgrep -f "ssh.*$CONTROL_SOCKET" | head -n 1 >"$PID_FILE" || true
    echo "Tuneis Oracle Cloud abertos."
    status_tunnels
    return 0
  fi

  echo "Falha ao abrir tuneis. Verifique $LOG_FILE." >&2
  exit 1
}

stop_tunnels() {
  if is_running; then
    ssh -S "$CONTROL_SOCKET" -O exit "$REMOTE_HOST" >/dev/null 2>&1 || true
    echo "Tuneis encerrados."
  else
    echo "Tuneis ja estavam inativos."
  fi

  rm -f "$PID_FILE"
  rm -f "$CONTROL_SOCKET"
}

status_tunnels() {
  if is_running; then
    local pid_text=""
    if [[ -f "$PID_FILE" ]]; then
      pid_text=" com PID $(cat "$PID_FILE")"
    fi
    echo "Tuneis ativos${pid_text}."
  else
    echo "Tuneis inativos."
  fi

  echo "Postgres kelsontocompile: 127.0.0.1:${LOCAL_POSTGRES_PORT}"
  echo "Redis:              127.0.0.1:${LOCAL_REDIS_PORT}"
  echo "Mongo:              127.0.0.1:${LOCAL_MONGO_PORT}"
  echo "Postgres SonarQube: 127.0.0.1:${LOCAL_SONAR_DB_PORT}"
  echo "MinIO S3:           127.0.0.1:${LOCAL_MINIO_S3_PORT}"
  echo "MinIO Console:      127.0.0.1:${LOCAL_MINIO_CONSOLE_PORT}"
  echo "API:                127.0.0.1:${LOCAL_API_PORT}"
  echo "Jenkins:            127.0.0.1:${LOCAL_JENKINS_PORT}"
}

case "${1:-start}" in
  start)
    start_tunnels
    ;;
  stop)
    stop_tunnels
    ;;
  restart)
    stop_tunnels
    start_tunnels
    ;;
  status)
    status_tunnels
    ;;
  *)
    usage
    exit 1
    ;;
esac
