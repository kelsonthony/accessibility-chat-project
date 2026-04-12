#!/usr/bin/env bash
# Deploy Prometheus + Grafana + Node Exporter no cluster K3s
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Aplicando ConfigMap do Prometheus..."
kubectl apply -f "$SCRIPT_DIR/prometheus-config.yaml"

echo "==> Aplicando Prometheus + Node Exporter..."
kubectl apply -f "$SCRIPT_DIR/prometheus.yaml"

echo "==> Aplicando Grafana..."
kubectl apply -f "$SCRIPT_DIR/grafana.yaml"

echo "==> Aplicando Ingress do Grafana..."
kubectl apply -f "$SCRIPT_DIR/grafana-ingress.yaml"

echo ""
echo "==> Aguardando pods ficarem prontos..."
kubectl rollout status deployment/prometheus -n accesschat --timeout=120s
kubectl rollout status deployment/grafana -n accesschat --timeout=120s

echo ""
echo "==> Monitoramento disponível em:"
echo "    Prometheus: http://prometheus.accesschat.svc.cluster.local:9090 (cluster-interno)"
echo "    Grafana:    https://grafana-accesschat.157-151-29-59.sslip.io"
echo ""
echo "IMPORTANTE: Altere a senha admin do Grafana em infra/k8s/monitoring/grafana.yaml"
echo "            antes de aplicar em produção."
