# itvipclient

Монорепозиторий **самохостящегося стека** для приёма лидов с лендинга, админ-панели, телеметрии поведения на форме и настройки контента сайта. Сборка рассчитана на **Docker Compose**: один вход через **Nginx** (TLS), внутренняя сеть приложений без выхода в интернет.

## Возможности

- **Публичная форма заявки** (`/`) — отправка в API, валидация, анимации интерфейса.
- **Сбор метрик с формы** — раз в секунда: время на странице, счётчики кликов по кнопкам, выборка позиции курсора (`pageX`/`pageY`). Отправка на **`POST /api/behavior-metrics/`** (без JWT).
- **Админ-панель** (`/admin`) — JWT, заявки (CRUD), статистика с пагинацией и **heatmap** курсора по текущей странице таблицы, настройки сайта (услуги, бюджет, UI), список администраторов.
- **REST API** (FastAPI) — заявки, метрики по заявке, телеметрия страницы, конфиг сайта, авторизация админов.
- **PostgreSQL 16** — единственное хранилище данных; доступ из контейнеров сети `app`.
- **Watchtower** — обновление только контейнеров с нужной меткой.

Сервисы **pgAdmin** и **Docker Registry** из стека по умолчанию **убраны**. Backend слушает **только** порт `8000` во внутренней сети Docker (на хост не пробрасывается); снаружи доступен только **Nginx** (`80`/`443`). Публичные **Swagger / ReDoc / OpenAPI** отключены в Nginx и по умолчанию в контейнере backend (`SHOW_API_DOCS=false`).

## Архитектура

```text
                    Internet :80 / :443
                              |
                         nginx (edge + app)
                    /         \
                   /           \
            frontend         backend
                                |
                          postgres (только сеть app, internal)
```

- Сеть **`app`** объявлена как **`internal: true`**: PostgreSQL и сервисы приложения не имеют прямого исходящего доступа в интернет.
- Сеть **`edge`**: только Nginx публикует порты на хост; backend и frontend не имеют `ports:`.

## Структура репозитория

```text
itvipclient/
├── docker-compose.yml      # Сервисы, сети, тома
├── .env.example            # Шаблон переменных окружения
├── README.md
├── backend/                # FastAPI, uvicorn, psycopg (async)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── settings.py
│       ├── core/
│       ├── models/
│       └── routes/
├── frontend/               # Vite, SPA, статика в Nginx
│   ├── Dockerfile
│   ├── package.json
│   ├── index.html
│   ├── nginx.conf
│   ├── public/             # form-heatmap-bg.svg и опционально .png
│   └── src/                # main.js, behaviorMetrics.js, cursorHeatmap.js, styles.css
├── db/
│   ├── init/
│   │   └── 01_schema.sql   # Первичная схема (том Postgres пустой)
│   └── migrations/
│       └── 002_page_behavior_telemetry.sql  # Для уже существующей БД
├── nginx/
│   ├── nginx.conf
│   └── templates/default.conf.template
├── registry/auth/          # опционально: htpasswd для Registry (bootstrap, если заданы REGISTRY_*)
├── nginx/htpasswd/         # опционально: Basic Auth для pgAdmin (bootstrap, если задан PGADMIN_BASIC_PASSWORD)
├── certs/                  # TLS (bootstrap)
└── scripts/
    ├── bootstrap.sh        # Сертификаты + htpasswd
    ├── ufw-harden.sh
    └── host-logrotate-nginx.sh
```

## Требования

- **Docker** и **Docker Compose** v2.
- Для TLS в `bootstrap.sh` — **OpenSSL**.
- Для продакшена: DNS или запись в `/etc/hosts` на **`NGINX_MAIN_SERVER_NAME`**.

## Быстрый старт

### 1. Переменные окружения

```bash
cp .env.example .env
chmod 600 .env
```

Замените все значения вида `CHANGE_ME_*` и при необходимости задайте **`BEHAVIOR_METRICS_TRUSTED_HOSTS`** (см. ниже).

### 2. Сертификат и файлы паролей

```bash
./scripts/bootstrap.sh
```

Скрипт создаёт self-signed сертификат в `certs/` (SAN только для **`NGINX_MAIN_SERVER_NAME`**). Опционально: `registry/auth/htpasswd` и `nginx/htpasswd/pgadmin.htpasswd`, если в `.env` заданы соответствующие переменные (см. `.env.example`).

### 3. Запуск стека

```bash
docker compose up -d --build
```

При медленной сети или первом скачивании образов:

```bash
COMPOSE_HTTP_TIMEOUT=600 docker compose up -d --build
```

### 4. Проверка

```bash
docker compose ps
curl -k "https://${NGINX_MAIN_SERVER_NAME}/api/v1/health"
```

Ожидаемый ответ при живой БД: `{"status":"ok"}`. Если пул к БД недоступен — `503` и `"status":"down"`.

### 5. Первый администратор

Откройте `https://<NGINX_MAIN_SERVER_NAME>/admin`. Если в базе ещё нет админов, доступна регистрация первого пользователя (`/api/v1/auth/register`); иначе — только вход.

## URL и доступы

| Назначение | URL |
|------------|-----|
| Сайт (форма + ссылки в админку) | `https://<NGINX_MAIN_SERVER_NAME>/` |
| Админ-панель | `https://<NGINX_MAIN_SERVER_NAME>/admin` |
| REST API (через Nginx) | `https://<NGINX_MAIN_SERVER_NAME>/api/...` |

Пути **`/api/v1/docs`**, **`/api/v1/redoc`**, **`/api/v1/openapi.json`** снаружи **недоступны** (ответ `404`). В контейнере backend документация OpenAPI по умолчанию выключена (`SHOW_API_DOCS=false`); для локального `uvicorn` без этой переменной Swagger снова включён.

Имя хоста в **`.env`** (**`NGINX_MAIN_SERVER_NAME`**) должно совпадать с тем, по которому вы открываете сайт в браузере (иначе TLS-предупреждение и возможные проблемы с cookies).

## Переменные окружения

Файл **`.env.example`** — эталон. Основные ключи:

| Переменная | Назначение |
|------------|------------|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Учётные данные и имя БД PostgreSQL |
| `NGINX_MAIN_SERVER_NAME` | `server_name` для сайта и API; также используется для проверки хоста метрик, если задан список доверенных хостов |
| `BEHAVIOR_METRICS_TRUSTED_HOSTS` | Опционально: через запятую хосты (без схемы), с которых разрешён **`POST /api/behavior-metrics/`**. Пусто вместе с пустым `NGINX_MAIN_SERVER_NAME` в списке — проверка **отключена** (удобно для локальной отладки). Для доступа по IP добавьте IP, например `91.217.80.218` |
| `SHOW_API_DOCS` | В Docker Compose по умолчанию `false` — без Swagger/ReDoc в процессе backend. Задайте `true`, если нужно включить в контейнере (Nginx по-прежнему может отдавать 404 на `/api/v1/docs` — см. шаблон). |
| `TZ` | Часовой пояс логов Watchtower |
| `DOCKER_API_VERSION` | При ошибке Watchtower про версию API Docker (часто `1.44`) |

`DATABASE_URL` для backend задаётся в **`docker-compose.yml`** из переменных Postgres, вручную в `.env` дублировать не нужно.

Дополнительно для backend (через расширение `docker-compose` или env-файл образа) можно задать **`JWT_SECRET`**, **`JWT_EXPIRE_MINUTES`** — см. `backend/app/settings.py`. В compose по умолчанию не пробрасывается; для продакшена задайте сильный секрет.

## Backend API

Префикс версии: **`/api/v1`** (кроме публичной телеметрии, см. ниже). Запросы с браузера идут на тот же хост через **Nginx** → `backend:8000` во внутренней сети; порт API **не** проброшен на хост.

Описание эндпоинтов в продакшене смотрите в коде маршрутов (`backend/app/routes/`) или временно включите `SHOW_API_DOCS=true` и уберите блоки `location = /api/v1/docs` в шаблоне Nginx (не рекомендуется для публичного доступа).

### Здоровье

- `GET /api/v1/health` — проверка API и подключения к БД.

### Заявки (лиды)

Префикс маршрута: **`/api/v1/applications`**.

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/applications` | Создать заявку (публично) |
| `GET` | `/applications?limit=&offset=` | Список (только админ, JWT) |
| `GET` | `/applications/{id}` | Одна заявка (админ) |
| `PATCH` | `/applications/{id}` | Обновление полей (админ) |
| `DELETE` | `/applications/{id}` | Удаление (админ) |

Обязательные поля при создании: **`first_name`**, **`last_name`**, **`business_info`**, **`budget`** (остальные — по схеме Pydantic в `applications.py`).

### Метрики по заявке (привязка к `lead_applications`)

Префикс: **`/api/v1/behavior-metrics`**. Все методы — **только с JWT**.

| Метод | Описание |
|-------|----------|
| `POST` | Создать запись для `application_id` (дубликат — `409`) |
| `GET` | Список с пагинацией |
| `GET` / `PATCH` / `DELETE` | По `application_id` |

Модель данных — JSONB для кликов/зон курсора (см. таблицу `lead_behavior_metrics`). Отдельно от **публичной** телеметрии страницы.

### Публичная телеметрия страницы (лендинг)

- **`POST /api/behavior-metrics/`** — без JWT; тело JSON: `application_id`, `time_on_page`, `buttons_clicked`, `cursor_positions`, `return_frequency`.
- Ограничение по хосту: если задан непустой список из **`BEHAVIOR_METRICS_TRUSTED_HOSTS`** и **`NGINX_MAIN_SERVER_NAME`** (разбор через запятую), запрос должен приходить с разрешённого **Host** / **Origin** / **Referer**.

Данные пишутся в **`page_behavior_telemetry`**. Таблица создаётся в **`db/init/01_schema.sql`** при первом старте тома; для **уже существующей** БД выполните **`db/migrations/002_page_behavior_telemetry.sql`**.

### Телеметрия в админке

- **`GET /api/v1/page-behavior-telemetry?limit=&offset=`** — список снимков (JWT). При отсутствии таблицы — `503` с текстом-подсказкой про миграцию.

### Конфигурация сайта

Префикс: **`/api/v1/admin-config`** (JWT). CRUD для `site_admin_config` (услуги, слайдер бюджета, `ui_options`). В списке поддерживаются параметры сортировки (например `sort=desc`).

### Администраторы и авторизация

- `GET /api/v1/auth/bootstrap` — есть ли хотя бы один админ.
- `POST /api/v1/auth/register` — первый админ (если политика сервера разрешает).
- `POST /api/v1/auth/login` — JWT.
- **`/api/v1/admins`** — управление пользователями (JWT).

## База данных

### Таблицы (актуально по `db/init/01_schema.sql`)

| Таблица | Назначение |
|---------|------------|
| `lead_applications` | Заявки с формы |
| `lead_behavior_metrics` | Метрики, привязанные к `application_id` |
| `page_behavior_telemetry` | Публичные снимки с главной (время, клики, курсор) |
| `site_admin_config` | Настройки контента/каталога |
| `admin_users` | Логины и хеши паролей админов |

**Важно:** в `01_schema.sql` перед `CREATE` стоят **`DROP TABLE IF EXISTS`**. Это безопасно только при **первой** инициализации пустого volume Postgres. На работающей БД схему меняйте **миграциями**, а не повторным прогоном всего `01_schema.sql`.

### Миграции

- **`db/migrations/002_page_behavior_telemetry.sql`** — `CREATE TABLE IF NOT EXISTS` для `page_behavior_telemetry` и индекс (идемпотентно для существующего инстанса).

Пример применения:

```bash
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f - < db/migrations/002_page_behavior_telemetry.sql
```

## Frontend

- **Сборка:** Vite → статика в образе Nginx (`frontend/Dockerfile`, `COPY public`, `npm run build`).
- **Локальная разработка** (только UI; API нужно проксировать или открыть тот же origin):

```bash
cd frontend
npm ci
npm run dev
```

- **Продакшен-сборка:** `npm run build` — артефакты в `frontend/dist/`.

Публичная форма шлёт заявки на **`POST /api/v1/applications`**. Метрики — на **`POST /api/behavior-metrics/`** (обратите внимание: префикс **`/api`**, не **`/api/v1`**).

Статика heatmap: **`/form-heatmap-bg.svg`** (и опционально **`/form-heatmap-bg.png`** в `frontend/public/`). В админке для heatmap подгружается живая главная страница в iframe при успешном измерении размера документа.

## Watchtower

Обновляет только сервисы с меткой:

```yaml
com.centurylinklabs.watchtower.enable: "true"
```

Обычно это `backend`, `frontend`, `nginx`. `postgres` и сам Watchtower помечены как `false`.

## Скрипты хоста

| Скрипт | Назначение |
|--------|------------|
| `scripts/bootstrap.sh` | TLS (SAN для основного сайта); опционально htpasswd для Registry/pgAdmin, если заданы переменные в `.env` |
| `scripts/ufw-harden.sh` | Пример жёсткой настройки UFW (запускать осознанно) |
| `scripts/host-logrotate-nginx.sh` | Ротация логов Nginx на хосте |

## Эксплуатация

```bash
docker compose up -d
docker compose down
docker compose logs -f nginx
docker compose logs -f backend
docker compose restart nginx
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
```

### Резервное копирование PostgreSQL

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

| Симптом | Что проверить |
|---------|----------------|
| `context deadline exceeded` при `compose up` | Увеличить `COMPOSE_HTTP_TIMEOUT`, заранее `docker pull` базовых образов |
| Watchtower: client version too old | Задать `DOCKER_API_VERSION` (например `1.44`) |
| Ошибки pull `python` / TLS к Docker Hub | Повторить позже, зеркало registry, VPN |
| `502` на API | Логи `backend`, здоровье `postgres`, `DATABASE_URL` |
| `404` на `/api/v1/docs` | Ожидаемо: документация закрыта снаружи |
| `403` на **`POST /api/behavior-metrics/`** | Хост запроса не в списке: добавьте IP или домен в `BEHAVIOR_METRICS_TRUSTED_HOSTS` / проверьте `NGINX_MAIN_SERVER_NAME` |
| `503` на **`/api/v1/page-behavior-telemetry`** | Выполнить миграцию `002_page_behavior_telemetry.sql` |
| Статика формы / heatmap 404 | Пересобрать frontend, проверить `try_files` и наличие файлов в `dist/` / `public/` |

## Безопасность (кратко)

- Не коммитьте **`.env`** и секреты; права на `.env` — минимально необходимые.
- Смените **дефолтный `JWT_SECRET`** в продакшене.
- Self-signed TLS — только для внутренних/тестовых контуров; для публичного сайта используйте Let's Encrypt или корпоративный CA.

## Лицензия

В репозитории файл лицензии не зафиксирован. При публикации добавьте `LICENSE` по выбранной модели.
