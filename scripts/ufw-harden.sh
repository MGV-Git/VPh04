#!/usr/bin/env bash
# Пример жёсткого UFW: только 22, 80, 443 (и при необходимости измените под ваш SSH-порт).
set -euo pipefail
if ! command -v ufw >/dev/null 2>&1; then
  echo "ufw не установлен."
  exit 1
fi
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "Включение UFW (y):"
ufw enable || true
ufw status verbose
