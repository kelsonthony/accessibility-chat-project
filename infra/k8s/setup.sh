#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_MANAGER_VERSION="v1.17.2"

echo "==> [1/5] Instalando cert-manager ${CERT_MANAGER_VERSION}..."
kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml"

echo "==> Aguardando cert-manager ficar pronto..."
kubectl rollout status deployment/cert-manager -n cert-manager --timeout=120s
kubectl rollout status deployment/cert-manager-webhook -n cert-manager --timeout=120s
kubectl rollout status deployment/cert-manager-cainjector -n cert-manager --timeout=120s
echo "    cert-manager pronto."

echo "==> [2/5] Criando service do Traefik (porta 80 e 443)..."
kubectl apply -f "${SCRIPT_DIR}/traefik-service.yaml"

echo "==> [3/5] Criando middleware HTTP → HTTPS..."
kubectl apply -f "${SCRIPT_DIR}/redirect-middleware.yaml"

echo "==> [4/5] Criando ClusterIssuers Let's Encrypt..."
# Aguarda o webhook do cert-manager estar disponível
sleep 10
kubectl apply -f "${SCRIPT_DIR}/cert-manager-issuer.yaml"

echo "==> [5/5] Aplicando Ingress de todos os serviços..."
kubectl apply -f "${SCRIPT_DIR}/ingress/accesschat.yaml"
kubectl apply -f "${SCRIPT_DIR}/ingress/tokusatsu.yaml"
kubectl apply -f "${SCRIPT_DIR}/ingress/kelsontocompile.yaml"

echo ""
echo "✓ Setup concluído!"
echo ""
echo "Serviços disponíveis em:"
echo "  https://accesschat.157-151-29-59.sslip.io"
echo "  https://api-accesschat.157-151-29-59.sslip.io"
echo "  https://jenkins.157-151-29-59.sslip.io"
echo "  https://grafana.157-151-29-59.sslip.io"
echo "  https://sonar.157-151-29-59.sslip.io"
echo "  https://minio.157-151-29-59.sslip.io"
echo "  https://prometheus.157-151-29-59.sslip.io"
echo "  https://vod.157-151-29-59.sslip.io"
echo "  https://tokusatsu.157-151-29-59.sslip.io"
echo "  https://kcomp.157-151-29-59.sslip.io"
echo "  https://api-kcomp.157-151-29-59.sslip.io"
echo ""
echo "Certificados SSL sendo emitidos pelo Let's Encrypt (pode levar 1-2 min)."
echo "Verifique com: kubectl get certificate --all-namespaces"
