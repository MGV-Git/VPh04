# itvipclient — Lead Capture Stack

Самохостящийся стек для приёма заявок (лидов) с веб-формы, с приватным Docker Registry, pgAdmin и автообновлением контейнеров через Watchtower. Всё крутится за единым Nginx-ingress с TLS, а данные клиентов **никогда не покидают сервер**.

---

## Содержание

1. [Что это и для чего](#что-это-и-для-чего)
2. [Архитектура](#архитектура)
3. [Структура репозитория](#структура-репозитория)
4. [Поток данных при отправке заявки](#поток-данных-при-отправке-заявки)
5. [Сервисы стека](#сервисы-стека)
6. [Сети и изоляция](#сети-и-изоляция)
7. [Безопасность](#безопасность)
8. [Быстрый старт](#быстрый-старт)
9. [Переменные окружения](#переменные-окружения)
10. [API](#api)
11. [База данных](#база-данных)
12. [Docker Registry — публикация образов](#docker-registry--публикация-образов)
13. [pgAdmin](#pgadmin)
14. [Watchtower — автообновление](#watchtower--автообновление)
15. [Логи и ротация](#логи-и-ротация)
16. [Бэкапы](#бэкапы)
17. [Эксплуатация](#эксплуатация)
18. [Траблшутинг](#траблшутинг)

---

## Что это и для чего

Маленький, но «промышленный» стек:

- **Фронт** — статичная HTML-форма (без SPA-фреймворков). Имя, email, телефон, сообщение + UTM/технические метрики (язык, экран, часовой пояс, referrer, user-agent).
- **Бэк** — FastAPI, единственный POST-эндпоинт `/api/v1/leads`, пишет JSON-пейлоад в Postgres (поле `JSONB`).
- **БД** — PostgreSQL 16, schema поднимается через `docker-entrypoint-initdb.d`.
- **pgAdmin** — для ручной работы с БД, выставлен наружу по подпути `/pgadmin/` с двумя слоями аутентификации (Basic Auth на Nginx + логин внутри pgAdmin).
- **Registry** — приватный Docker Registry v2 на отдельном хосте (`registry.<домен>`), под htpasswd.
- **Nginx** — единая точка входа: TLS-терминация, rate limiting, WAF-lite, проксирование во все сервисы.
- **Watchtower** — следит за лейблами `com.centurylinklabs.watchtower.enable=true` и тихо обновляет помеченные контейнеры.

Целевая модель: один VPS, один `docker compose up -d`, никаких внешних SaaS для приёма данных.

---

## Архитектура

```
                       ┌────────────────────────┐
   Internet (443) ───► │       Nginx (edge)     │
                       │  TLS / WAF-lite / RL   │
                       └────────────┬───────────┘
                                    │
        ┌───────────────────────────┼─────────────────────────────┐
        │                           │                             │
        ▼                           ▼                             ▼
  leads.local                 leads.local                 registry.leads.local
  /        → frontend         /api/    → backend          /        → registry:5000
  /pgadmin → pgadmin
        │                           │                             │
        ▼                           ▼                             │
   ┌──────────┐               ┌──────────┐                        │
   │ frontend │               │ backend  │                        │
   │ nginx:80 │               │ FastAPI  │                        │
   └──────────┘               │   :8000  │                        │
                              └────┬─────┘                        │
                                   │ asyncpg                      │
                                   ▼                              │
                              ┌──────────┐                        │
                              │ postgres │  ← pgAdmin (read/write)│
                              └──────────┘                        │
                                                                  ▼
                                                            ┌──────────┐
                                                            │ registry │
                                                            │   :5000  │
                                                            └──────────┘

Сети:
  edge  (bridge)   — nginx ↔ registry, наружу через :80/:443
  app   (internal) — nginx ↔ frontend/backend/pgadmin ↔ postgres
                     ❗ Без выхода в интернет (internal: true)
```

Особенность: **сеть `app` помечена `internal: true`** — у backend, postgres и pgAdmin **нет** исходящего интернета. Любой исходящий трафик возможен только из контейнеров, привязанных к сети `edge` (nginx, registry, watchtower).

---

## Структура репозитория

```
itvipclient/
├── docker-compose.yml          # Единый стек: 7 сервисов, 2 сети, 4 volume
├── .env.example                # Шаблон переменных окружения
├── .env                        # Реальные секреты (chmod 600, в .gitignore)
├── .gitignore
│
├── backend/                    # FastAPI приложение
│   ├── Dockerfile              # python:3.12-slim, uvicorn
│   ├── .dockerignore
│   ├── requirements.txt        # fastapi, uvicorn, pydantic, psycopg, email-validator
│   └── app/
│       ├── __init__.py
│       ├── main.py             # Эндпоинты /api/v1/leads и /api/v1/health
│       └── settings.py         # Pydantic-Settings (читает DATABASE_URL)
│
├── frontend/                   # Статичная веб-форма
│   ├── Dockerfile              # nginx:1.27-alpine + статика
│   ├── .dockerignore
│   ├── nginx.conf              # Внутренний конфиг (try_files → index.html)
│   ├── index.html              # Форма «Оставить заявку»
│   ├── app.js                  # Сбор UTM/метрик, POST /api/v1/leads
│   └── styles.css
│
├── db/
│   └── init/
│       └── 01_schema.sql       # Авто-инициализация при первом запуске postgres
│
├── nginx/                      # Ingress-Nginx (TLS, прокси, WAF, RL)
│   ├── nginx.conf              # Глобальный: rate-limit zones, WAF-lite maps
│   ├── templates/
│   │   └── default.conf.template   # Подставляются env-переменные (envsubst)
│   └── htpasswd/
│       ├── .gitkeep
│       └── pgadmin.htpasswd    # Basic Auth для /pgadmin/ (создаёт bootstrap.sh)
│
├── certs/                      # TLS-сертификаты (создаёт bootstrap.sh: self-signed)
│   ├── fullchain.pem
│   └── privkey.pem
│
├── registry/
│   └── auth/
│       ├── .gitkeep
│       └── htpasswd            # Для docker login (создаёт bootstrap.sh)
│
└── scripts/
    ├── bootstrap.sh            # Создаёт TLS-сертификаты и htpasswd-файлы
    ├── ufw-harden.sh           # UFW: 22/80/443
    └── host-logrotate-nginx.sh # Шаблон logrotate для bind-mount логов
```

---

## Поток данных при отправке заявки

```
Browser                       Nginx                    Backend                Postgres
   │                            │                         │                      │
   │  GET /  (HTTPS)            │                         │                      │
   ├───────────────────────────►│                         │                      │
   │                            │  proxy → frontend:80    │                      │
   │  index.html + app.js + css │                         │                      │
   │◄───────────────────────────│                         │                      │
   │                            │                         │                      │
   │  POST /api/v1/leads        │                         │                      │
   │  Body: {name,email,phone,  │  limit_req zone=api_rl  │                      │
   │         message,utm,       │  X-Forwarded-For        │                      │
   │         metrics,technical} │  X-Forwarded-Proto=https│                      │
   ├───────────────────────────►│────────────────────────►│                      │
   │                            │                         │  INSERT INTO leads   │
   │                            │                         │  (payload::jsonb,    │
   │                            │                         │   client_ip::inet,   │
   │                            │                         │   user_agent,        │
   │                            │                         │   normalized_email)  │
   │                            │                         ├─────────────────────►│
   │                            │                         │  RETURNING id, ts    │
   │                            │                         │◄─────────────────────│
   │  201 {"id":N,"created_at"} │                         │                      │
   │◄───────────────────────────│◄────────────────────────│                      │
```

Что собирает фронт:

| Категория | Поля |
|---|---|
| Введённые пользователем | `name`, `email`, `phone`, `message` |
| UTM | `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` |
| Метрики | `language`, `platform`, `cookie_enabled`, `screen_*`, `viewport_*`, `timezone`, `referrer` |
| Технические | `page_url` (без `#hash`), `user_agent` |

Сервер дополнительно фиксирует:
- `client_ip` — из `X-Forwarded-For` (первый), валидируется через `ipaddress.ip_address()`.
- `user_agent` — заголовок, обрезан до 2000 символов.
- `normalized_email` — `lower().strip()`, используется в индексе.

Валидация на бэкенде (Pydantic):
- `name` — 1..200 символов;
- `email` — `EmailStr` (RFC + проверка домена);
- `phone` — до 40 символов;
- `message` — до 4000 символов;
- `utm`/`metrics`/`technical` — каждый словарь не больше **32 КБ** в сериализованном виде (защита от мусора в payload).

---

## Сервисы стека

| Сервис | Образ | Сеть(и) | Порты | Назначение |
|---|---|---|---|---|
| `nginx` | `nginx:1.27-alpine` | `edge`, `app` | `80`, `443` | Ingress, TLS, WAF, rate-limit |
| `frontend` | build `./frontend` | `app` | expose `80` | Статичная форма (nginx + html/js/css) |
| `backend` | build `./backend` | `app` | expose `8000` | FastAPI + uvicorn |
| `postgres` | `postgres:16-alpine` | `app` | — | БД лидов |
| `pgadmin` | `dpage/pgadmin4:8` | `app` | expose `80` | Веб-GUI для PostgreSQL |
| `registry` | `registry:2` | `edge` | expose `5000` | Приватный Docker Registry |
| `watchtower` | `containrrr/watchtower:1.7.1` | — (host socket) | — | Автообновление контейнеров |

---

## Сети и изоляция

- **`edge`** — обычная bridge-сеть. В ней живут `nginx`, `registry`. Через неё идёт весь внешний трафик.
- **`app`** — `internal: true`. Без шлюза наружу. В ней `frontend`, `backend`, `postgres`, `pgadmin`. И nginx — он сидит **в обеих**, чтобы быть мостом из интернета во внутрянку.

Это значит: даже если кто-то получит RCE в backend — у него **нет** прямого исходящего интернета (ни DNS, ни TCP), только обратные соединения через nginx наружу не открываются.

---

## Безопасность

### TLS
- Сертификат self-signed (RSA 4096, 825 дней), SAN включает оба домена: `NGINX_MAIN_SERVER_NAME` и `NGINX_REGISTRY_SERVER_NAME`.
- В проде замените на Let's Encrypt (например, `certbot --webroot` или DNS-challenge).
- Только `TLSv1.2` и `TLSv1.3`. Кэш сессий 10 МБ.

### Rate limiting (Nginx)
- `zone=api_rl` — 10 r/s, burst 20, на `/api/`.
- `zone=api_burst` — 30 r/s, burst 50, на `/`.
- Ответ при превышении — `429 Too Many Requests`.

### WAF-lite (Nginx maps)
- Блок 403 при подозрительном `User-Agent` (sqlmap, nikto, nmap, masscan, acunetix, nessus, openvas, w3af, dirbuster, gobuster).
- Блок 403 при типовых SQLi/path-traversal паттернах в URI (`union select`, `information_schema`, `sleep(`, `load_file(`, `into outfile`, `../../../`).

### Лимиты тела
- `client_max_body_size 2m` глобально (хватает с запасом для JSON лида + метрик).
- Registry — `client_max_body_size 0` (никаких лимитов для push образов).

### Защита pgAdmin (двойная)
1. **Nginx Basic Auth** на `/pgadmin/` — htpasswd-файл `nginx/htpasswd/pgadmin.htpasswd`, bcrypt.
2. **Логин внутри pgAdmin** — `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD`.

### FastAPI
- `docs_url=None`, `redoc_url=None`, `openapi_url=None` — Swagger/Redoc/openapi.json **выключены** (никаких внешних точек интроспекции).
- Email и PII никогда не возвращаются в логи и ответы (в логах только `id` и `created_at`).

### UFW (опционально)
```bash
sudo ./scripts/ufw-harden.sh
```
Открывает только 22/80/443, всё остальное deny.

---

## Быстрый старт

### Требования
- Linux-сервер с Docker Engine **≥ 20.10** (API ≥ 1.44 — для Watchtower) и Docker Compose v2.
- `openssl`, `htpasswd` (`apache2-utils`) — опционально, иначе `bootstrap.sh` использует контейнер `httpd:2.4-alpine`.
- Открытые порты 80/443 наружу.
- DNS-записи или `/etc/hosts` на обоих доменах.

### Шаги

```bash
# 1. Конфиг
cp .env.example .env
chmod 600 .env
# Откройте .env и замените все CHANGE_ME_* на стойкие пароли.

# 2. Сертификаты + htpasswd-файлы
./scripts/bootstrap.sh

# 3. Запуск
docker compose up -d --build

# 4. Проверка
docker compose ps
curl -k https://leads.local/api/v1/health     # {"status":"ok"}
```

Откройте в браузере:
- `https://leads.local/` — форма заявки.
- `https://leads.local/pgadmin/` — pgAdmin (две формы логина).
- `https://registry.leads.local/v2/` — Docker Registry (через `docker login`).

Если первый pull медленный, дайте Compose больше времени:

```bash
COMPOSE_HTTP_TIMEOUT=600 docker compose up -d --build
```

---

## Переменные окружения

| Переменная | Где используется | Пример | Комментарий |
|---|---|---|---|
| `POSTGRES_USER` | postgres, backend | `leads` | Владелец БД |
| `POSTGRES_PASSWORD` | postgres, backend | `***` | **Заменить!** |
| `POSTGRES_DB` | postgres, backend | `leads` | Имя БД |
| `PGADMIN_EMAIL` | pgadmin | `admin@example.com` | Логин внутри pgAdmin |
| `PGADMIN_PASSWORD` | pgadmin | `***` | Пароль внутри pgAdmin |
| `PGADMIN_BASIC_USER` | bootstrap → nginx htpasswd | `pgadmin` | Логин Basic Auth |
| `PGADMIN_BASIC_PASSWORD` | bootstrap → nginx htpasswd | `***` | Пароль Basic Auth |
| `NGINX_MAIN_SERVER_NAME` | nginx, bootstrap (SAN) | `leads.local` | Основной домен |
| `NGINX_REGISTRY_SERVER_NAME` | nginx, bootstrap (SAN) | `registry.leads.local` | Должен **отличаться** от основного |
| `REGISTRY_USER` | bootstrap → registry htpasswd | `registryuser` | Логин `docker login` |
| `REGISTRY_PASSWORD` | bootstrap → registry htpasswd | `***` | Пароль `docker login` |
| `TZ` | watchtower | `UTC` | Таймзона логов |
| `DOCKER_API_VERSION` | watchtower | `1.44` | При ошибке «client version too old» |

Важно про `DATABASE_URL`: он **не задаётся** напрямую — Compose собирает его из `POSTGRES_*`:

```
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
```

---

## API

### `POST /api/v1/leads`

Принимает JSON, возвращает идентификатор записи.

**Request:**

```http
POST /api/v1/leads HTTP/1.1
Content-Type: application/json

{
  "name": "Иван",
  "email": "ivan@example.com",
  "phone": "+7 999 000-00-00",
  "message": "Перезвоните",
  "utm": {
    "utm_source": "yandex",
    "utm_campaign": "spring"
  },
  "metrics": {
    "language": "ru-RU",
    "timezone": "Europe/Moscow",
    "screen_width": 1920,
    "screen_height": 1080
  },
  "technical": {
    "page_url": "https://leads.local/",
    "user_agent": "Mozilla/5.0 ..."
  }
}
```

**Response 201:**

```json
{ "id": 42, "created_at": "2026-05-11T08:30:00.123456+00:00" }
```

**Возможные ошибки:**

| Код | Когда |
|---|---|
| `422` | Pydantic-валидация: email невалидный, поле длиннее лимита, json-секция > 32 КБ |
| `429` | Превышен rate-limit Nginx |
| `503` | Backend не смог подключиться к Postgres |
| `403` | Сработал WAF-lite (плохой UA или подозрительный URI) |

### `GET /api/v1/health`

Простой пинг: проверяет соединение с БД (`SELECT 1`).

```json
{ "status": "ok" }
```

При проблеме — `503` и `{"status": "down"}`.

---

## База данных

Схема создаётся автоматически при первом запуске Postgres (volume `pgdata` пустой → выполняется `db/init/01_schema.sql`).

```sql
CREATE TABLE IF NOT EXISTS leads (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload         JSONB NOT NULL,
    client_ip       INET,
    user_agent      TEXT,
    normalized_email TEXT
);

CREATE INDEX idx_leads_created ON leads (created_at DESC);
CREATE INDEX idx_leads_email   ON leads (normalized_email);
```

Полезные запросы (через pgAdmin или `docker compose exec postgres psql`):

```sql
-- Последние 50 заявок
SELECT id, created_at, normalized_email, client_ip
FROM leads ORDER BY created_at DESC LIMIT 50;

-- Заявки по UTM-источнику
SELECT payload->'utm'->>'utm_source' AS src, count(*)
FROM leads
GROUP BY 1 ORDER BY 2 DESC;

-- Поиск по email
SELECT id, created_at, payload
FROM leads WHERE normalized_email = 'ivan@example.com';
```

> **Если меняете схему позже** — добавляйте новые `*.sql` файлы в `db/init/` (выполняются один раз, при первой инициализации). Для уже работающей БД пишите миграции вручную или через инструмент (alembic, sqitch и т. п.).

---

## Docker Registry — публикация образов

Регистр живёт по адресу `https://registry.leads.local/`, аутентификация — htpasswd (bcrypt).

```bash
docker login registry.leads.local
# username: REGISTRY_USER из .env
# password: REGISTRY_PASSWORD из .env

docker tag myapp:latest registry.leads.local/myapp:1.0.0
docker push registry.leads.local/myapp:1.0.0

docker pull registry.leads.local/myapp:1.0.0
```

> **Self-signed cert**: на клиентах добавьте `fullchain.pem` в доверенные либо настройте `insecure-registries` в `/etc/docker/daemon.json` (только для тестов).

---

## pgAdmin

Доступ: `https://leads.local/pgadmin/`

1. Браузер спросит Basic Auth — введите `PGADMIN_BASIC_USER` / `PGADMIN_BASIC_PASSWORD`.
2. Дальше форма pgAdmin — введите `PGADMIN_EMAIL` / `PGADMIN_PASSWORD`.
3. Add Server → Connection:
   - Host: `postgres`
   - Port: `5432`
   - Username/Password/DB: `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`.

**Тонкости конфига pgAdmin за reverse proxy** (уже учтены в compose):
- `PGADMIN_CONFIG_SERVER_MODE=True`.
- `PGADMIN_CONFIG_ENHANCED_COOKIE_PROTECTION=False` — иначе ломается через proxy.
- `PGADMIN_CONFIG_WTF_CSRF_CHECK_ENABLED=False` — иначе CSRF не проходит на подпути.
- `PGADMIN_CONFIG_PROXY_X_PROTO_COUNT=1`, `PROXY_X_HOST_COUNT=1` — доверяем одному прокси.
- В Nginx прокинуты `X-Script-Name: /pgadmin` и `X-Scheme: https` (pgAdmin узнаёт о подпути и TLS).
- **Не задавайте `SCRIPT_NAME`** в env pgAdmin: тогда Gunicorn ждёт префикс в URL, а Nginx с `proxy_pass http://pgadmin/;` его обрезает → 500.

---

## Watchtower — автообновление

Включён режим **по лейблу** (`WATCHTOWER_LABEL_ENABLE=true`). Обновляются только контейнеры с лейблом:

```yaml
labels:
  - com.centurylinklabs.watchtower.enable=true
```

Так помечены: `backend`, `frontend`, `nginx`, `registry`.
**Не** помечены: `postgres`, `pgadmin`, `watchtower` (их нельзя обновлять «на лету» без миграции/бэкапа).

Параметры:
- `WATCHTOWER_CLEANUP=true` — удалять старые образы после апдейта.
- `WATCHTOWER_ROLLING_RESTART=true` — перезапуск контейнеров по одному.
- `WATCHTOWER_INCLUDE_RESTARTING=true` — учитывать перезапускающиеся.
- `DOCKER_API_VERSION` — если ругается на старый клиент API, поставьте `1.44`+.

Чтобы временно отключить автообновление конкретного сервиса — поменяйте лейбл на `false` и `docker compose up -d`.

---

## Логи и ротация

Все сервисы используют `json-file` драйвер с заданными лимитами в `docker-compose.yml`:

| Сервис | max-size | max-file |
|---|---|---|
| `nginx` | 50 МБ | 10 |
| `backend` | 10 МБ | 7 |
| `pgadmin` | 10 МБ | 5 |
| `registry` | 20 МБ | 5 |
| `frontend` | 5 МБ | 5 |

Просмотр в реальном времени:

```bash
docker compose logs -f nginx
docker compose logs -f backend
docker compose logs --since=1h backend
```

Если хотите ротировать **сырые** access/error логи Nginx через `logrotate` хоста — посмотрите `scripts/host-logrotate-nginx.sh` (он печатает шаблон для `/etc/logrotate.d/`).

---

## Бэкапы

PostgreSQL volume `pgdata` — основной актив. Минимальный сценарий:

```bash
# Дамп БД
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "backup-$(date +%F).sql.gz"

# Восстановление
gunzip -c backup-2026-05-11.sql.gz \
  | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Положите эту команду в cron + копируйте результат на внешнее хранилище (rsync/restic/borg).

Аналогично — `pgadmin_data` (настройки серверов pgAdmin) и `registry_data` (образы Docker).

---

## Эксплуатация

```bash
# Старт/стоп
docker compose up -d
docker compose down                # ВНИМАНИЕ: без -v volume сохранятся, с -v — БД будет удалена
docker compose restart nginx

# Просмотр состояния
docker compose ps
docker compose top
docker stats

# Принудительный пересбор одного сервиса
docker compose build --no-cache backend
docker compose up -d backend

# Обновить только nginx-конфиг без пересборки
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```

### Смена пароля Registry / pgAdmin

1. Поменяйте значение в `.env`.
2. Запустите снова: `./scripts/bootstrap.sh` — он перегенерирует соответствующий htpasswd.
3. `docker compose up -d nginx registry` — чтобы перечитать файлы.

### Замена self-signed на Let's Encrypt

1. Получите сертификат любым удобным способом (например, `certbot certonly --standalone` на временно остановленном Nginx).
2. Положите итоговые файлы в `./certs/fullchain.pem` и `./certs/privkey.pem`.
3. `docker compose exec nginx nginx -s reload`.

---

## Траблшутинг

### `DeadlineExceeded` / `context deadline exceeded` при первом `up -d --build`
Медленный pull. Решения:
```bash
COMPOSE_HTTP_TIMEOUT=600 docker compose up -d --build
# или предзагрузить:
docker pull nginx:1.27-alpine python:3.12-slim-bookworm postgres:16-alpine
```

### Backend падает на `TLS handshake timeout` / `failed to fetch anonymous token`
Сеть до Docker Hub нестабильна. Варианты:
- повторить позже;
- вручную `docker pull python:3.12-slim-bookworm`;
- в `/etc/docker/daemon.json` указать `registry-mirrors`;
- залогиниться в свой приватный registry и поменять `FROM` в `backend/Dockerfile`.

### Watchtower: `client version 1.25 is too old`
Поставьте в `.env`:
```
DOCKER_API_VERSION=1.44
```
Точную версию узнайте: `docker version --format '{{.Server.APIVersion}}'`.

### pgAdmin 500 на `/pgadmin/`
- Проверьте, что **не** задана переменная `SCRIPT_NAME` (она ломает Gunicorn при `proxy_pass .../`).
- Проверьте, что `nginx/htpasswd/pgadmin.htpasswd` имеет права `0644` (читаемо процессу nginx в контейнере).

### `502 Bad Gateway` на `/api/`
- `docker compose ps` — backend жив?
- `docker compose logs backend` — есть ошибки коннекта к postgres?
- Проверьте `DATABASE_URL` (собирается из `POSTGRES_*`).

### Не работает `https://registry.leads.local/`
- Имя должно **отличаться** от `NGINX_MAIN_SERVER_NAME` — иначе второй `server`-блок в Nginx игнорируется.
- На клиенте — добавьте `certs/fullchain.pem` в доверенные, иначе `x509: certificate signed by unknown authority`.

### «Too many changes detected» в Cursor/VSCode Source Control
Воркспейс открыт слишком высоко (например, на `~/` вместо `~/itvipclient`). Откройте именно папку `itvipclient`.

---

## Лицензия

Внутренний проект — лицензия по умолчанию не указана. Перед публикацией добавьте `LICENSE`.
