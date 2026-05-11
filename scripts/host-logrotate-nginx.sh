#!/usr/bin/env bash
# Опционально: если логи Nginx проброшены на хост, установите фрагмент в /etc/logrotate.d/
# Для json-file драйвера Docker ротация уже задана в docker-compose (max-size / max-file).
set -euo pipefail
cat <<'EOF'
# Пример /etc/logrotate.d/itvip-nginx (пути подставьте свои bind-mount'ы)
# /var/log/itvip/nginx/*.log {
#   weekly
#   rotate 12
#   compress
#   delaycompress
#   missingok
#   notifempty
#   create 0640 root adm
#   sharedscripts
#   postrotate
#     docker kill --signal=USR1 itvipclient-nginx-1 2>/dev/null || true
#   endscript
# }
EOF
