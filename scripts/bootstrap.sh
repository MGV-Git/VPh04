#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Создайте файл: cp .env.example .env и заполните пароли."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

: "${NGINX_MAIN_SERVER_NAME:?Задайте NGINX_MAIN_SERVER_NAME в .env}"

mkdir -p certs nginx/htpasswd registry/auth

if [[ ! -f certs/fullchain.pem || ! -f certs/privkey.pem ]]; then
  echo "TLS: самоподписанный сертификат (SAN только для основного сайта). В проде замените на Let's Encrypt."
  SAN="DNS:${NGINX_MAIN_SERVER_NAME}"
  openssl req -x509 -nodes -newkey rsa:4096 \
    -keyout certs/privkey.pem \
    -out certs/fullchain.pem \
    -days 825 \
    -subj "/CN=${NGINX_MAIN_SERVER_NAME}" \
    -addext "subjectAltName=${SAN}"
  chmod 600 certs/privkey.pem
fi

htpasswd_bc() {
  local file=$1 user=$2 pass=$3
  if command -v htpasswd >/dev/null 2>&1; then
    htpasswd -Bbc "$file" "$user" "$pass"
  elif command -v docker >/dev/null 2>&1; then
    local dir
    dir="$(cd "$(dirname "$file")" && pwd)"
    local base
    base="$(basename "$file")"
    docker run --rm -v "${dir}:/auth" httpd:2.4-alpine \
      htpasswd -Bbc "/auth/${base}" "$user" "$pass"
  else
    echo "Нужны htpasswd (apache2-utils) или Docker для генерации bcrypt."
    exit 1
  fi
}

# Опционально: htpasswd для приватного Registry (если вернёте сервис registry в compose)
if [[ -n "${REGISTRY_USER:-}" && -n "${REGISTRY_PASSWORD:-}" ]]; then
  htpasswd_bc registry/auth/htpasswd "${REGISTRY_USER}" "${REGISTRY_PASSWORD}"
  chmod 640 registry/auth/htpasswd
else
  echo "Пропуск registry/auth/htpasswd (не заданы REGISTRY_USER / REGISTRY_PASSWORD)."
fi

# Опционально: Basic Auth для pgAdmin (если вернёте pgadmin за Nginx)
if [[ -n "${PGADMIN_BASIC_PASSWORD:-}" ]]; then
  PGADMIN_BASIC_USER="${PGADMIN_BASIC_USER:-pgadmin}"
  htpasswd_bc nginx/htpasswd/pgadmin.htpasswd "${PGADMIN_BASIC_USER}" "${PGADMIN_BASIC_PASSWORD}"
  chmod 644 nginx/htpasswd/pgadmin.htpasswd
else
  echo "Пропуск nginx/htpasswd/pgadmin.htpasswd (не задан PGADMIN_BASIC_PASSWORD)."
fi

chmod 600 .env

echo "Готово. Запуск: docker compose up -d --build"
