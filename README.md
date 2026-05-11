# itvipclient

Самохостящийся стек для приема и обработки лидов:

- `frontend` (Vite + Nginx) с формой заявки
- `backend` (FastAPI + psycopg)
- `postgres` (PostgreSQL 16)
- `pgadmin` (доступ через подпуть `/pgadmin/`)
- `registry` (приватный Docker Registry v2)
- `nginx` (единая точка входа, TLS, reverse proxy)
- `watchtower` (автообновление помеченных контейнеров)

## Архитектура

```text
Internet (80/443)
      |
    nginx (edge + app)
   /   |      |      \
  /    |      |       \
frontend  backend   pgadmin   registry (edge)
            |
         postgres (app internal only)
```

Ключевой момент безопасности: сеть `app` объявлена как `internal: true`, поэтому сервисы во внутреннем контуре не имеют прямого выхода в интернет.

## Структура проекта

```text
itvipclient/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── settings.py
│       ├── core/database.py
│       ├── models/
│       └── routes/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── index.html
│   ├── nginx.conf
│   └── src/
├── db/init/01_schema.sql
├── nginx/
│   ├── nginx.conf
│   ├── templates/default.conf.template
│   └── htpasswd/
├── registry/auth/
├── certs/
└── scripts/
    ├── bootstrap.sh
    ├── ufw-harden.sh
    └── host-logrotate-nginx.sh
```

## Быстрый старт

### 1) Подготовка `.env`

```bash
cp .env.example .env
chmod 600 .env
```

Заполните все `CHANGE_ME_*` значения.

### 2) Сгенерировать сертификат и htpasswd

```bash
./scripts/bootstrap.sh
```

Скрипт:

- создает self-signed TLS сертификат в `certs/`
- создает `registry/auth/htpasswd`
- создает `nginx/htpasswd/pgadmin.htpasswd`

### 3) Поднять стек

```bash
docker compose up -d --build
```

Если сеть медленная:

```bash
COMPOSE_HTTP_TIMEOUT=600 docker compose up -d --build
```

### 4) Проверка

```bash
docker compose ps
curl -k https://leads.local/api/v1/health
```

Ожидаемый ответ:

```json
{"status":"ok"}
```

## Доступы и URL

- Основной сайт: `https://<NGINX_MAIN_SERVER_NAME>/`
- API docs (Swagger): `https://<NGINX_MAIN_SERVER_NAME>/api/v1/docs`
- ReDoc: `https://<NGINX_MAIN_SERVER_NAME>/api/v1/redoc`
- pgAdmin: `https://<NGINX_MAIN_SERVER_NAME>/pgadmin/`
- Registry API: `https://<NGINX_REGISTRY_SERVER_NAME>/v2/`

## Переменные окружения

Основные переменные в `.env`:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `PGADMIN_EMAIL`
- `PGADMIN_PASSWORD`
- `PGADMIN_BASIC_USER`
- `PGADMIN_BASIC_PASSWORD`
- `NGINX_MAIN_SERVER_NAME`
- `NGINX_REGISTRY_SERVER_NAME`
- `REGISTRY_USER`
- `REGISTRY_PASSWORD`
- `TZ`
- `DOCKER_API_VERSION` (опционально, для watchtower)

`DATABASE_URL` вручную задавать не нужно — он собирается в `docker-compose.yml`.

## Backend API

Базовый префикс: `/api/v1`

### Applications

- `POST /applications` — создать заявку
- `GET /applications?limit=50&offset=0` — список заявок
- `GET /applications/{application_id}` — получить заявку
- `PATCH /applications/{application_id}` — обновить поля заявки
- `DELETE /applications/{application_id}` — удалить заявку

Обязательные поля при создании:

- `first_name`
- `last_name`
- `business_info`
- `budget`

### Behavior Metrics

- `POST /behavior-metrics` — создать метрики (1 запись на `application_id`)
- `GET /behavior-metrics?limit=50&offset=0` — список
- `GET /behavior-metrics/{application_id}` — получить
- `PATCH /behavior-metrics/{application_id}` — обновить
- `DELETE /behavior-metrics/{application_id}` — удалить

Особенности:

- `application_id` должен существовать
- повторный `POST` на тот же `application_id` вернет `409`
- размер JSON полей ограничен валидатором

### Admin Config

- `POST /admin-config` — создать конфигурацию сайта
- `GET /admin-config?limit=50&offset=0` — список
- `GET /admin-config/{config_id}` — получить
- `PATCH /admin-config/{config_id}` — обновить
- `DELETE /admin-config/{config_id}` — удалить

## База данных

Инициализация: `db/init/01_schema.sql`.

Создаются таблицы:

- `lead_applications`
- `lead_behavior_metrics`
- `site_admin_config`

Важно: в `01_schema.sql` есть `DROP TABLE IF EXISTS ...` перед `CREATE TABLE`. Это безопасно только для первичной инициализации пустого volume; для изменения схемы на рабочей БД используйте миграции.

## Frontend

Фронтенд собирается через `Vite` и отдается Nginx-контейнером.

Локальная разработка (только фронтенд):

```bash
cd frontend
npm ci
npm run dev
```

Сборка:

```bash
npm run build
```

Форма отправляет данные в `POST /api/v1/applications`.

## Registry

Авторизация в приватный registry:

```bash
docker login <NGINX_REGISTRY_SERVER_NAME>
```

Пуш:

```bash
docker tag myapp:latest <NGINX_REGISTRY_SERVER_NAME>/myapp:1.0.0
docker push <NGINX_REGISTRY_SERVER_NAME>/myapp:1.0.0
```

## Watchtower

Обновляет только сервисы с label:

```yaml
com.centurylinklabs.watchtower.enable=true
```

Обычно помечены: `backend`, `frontend`, `nginx`, `registry`.

## Полезные команды эксплуатации

```bash
docker compose up -d
docker compose down
docker compose logs -f nginx
docker compose logs -f backend
docker compose restart nginx
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```

## Бэкап PostgreSQL

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "backup-$(date +%F).sql.gz"
```

Восстановление:

```bash
gunzip -c backup-2026-05-11.sql.gz \
  | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

## Частые проблемы

- `context deadline exceeded` при первом запуске — увеличьте `COMPOSE_HTTP_TIMEOUT`.
- Watchtower ошибка `client version is too old` — задайте `DOCKER_API_VERSION` (например `1.44`).
- `500` на `/pgadmin/` — проверьте, что htpasswd с правами на чтение и не задан `SCRIPT_NAME`.
- `502` на API — проверьте состояние `backend` и соединение с `postgres`.

## Лицензия

Лицензия явно не задана. Добавьте файл `LICENSE`, если проект будет публиковаться.
