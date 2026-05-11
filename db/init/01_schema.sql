-- Данные только в контуре сервера. Доступ к БД — через backend.

DROP TABLE IF EXISTS lead_behavior_metrics;
DROP TABLE IF EXISTS lead_applications;
DROP TABLE IF EXISTS site_admin_config;
DROP TABLE IF EXISTS leads;

CREATE TABLE lead_applications (
    id                          BIGSERIAL PRIMARY KEY,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    first_name                  TEXT NOT NULL,
    last_name                   TEXT NOT NULL,
    patronymic                  TEXT,
    email                       TEXT,
    phone                       TEXT,
    business_info               TEXT NOT NULL DEFAULT '',
    business_niche              TEXT,
    company_size                TEXT,
    task_volume                 TEXT,
    role_in_company             TEXT,
    business_size               TEXT,
    need_volume                 TEXT,
    result_deadline             TEXT,
    task_type                   TEXT,
    product_of_interest         TEXT,
    budget                      TEXT NOT NULL DEFAULT '',
    preferred_contact_method    TEXT,
    convenient_contact_time     TEXT,
    comments                    TEXT
);

CREATE INDEX idx_lead_applications_created ON lead_applications (created_at DESC);

CREATE TABLE lead_behavior_metrics (
    application_id          BIGINT PRIMARY KEY
        REFERENCES lead_applications(id) ON DELETE CASCADE,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    time_on_page_seconds      DOUBLE PRECISION,
    button_clicks             JSONB NOT NULL DEFAULT '{}'::jsonb,
    cursor_hover_zones        JSONB NOT NULL DEFAULT '{}'::jsonb,
    return_visit_count        INTEGER NOT NULL DEFAULT 0,
    extra                     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE site_admin_config (
    id                    BIGSERIAL PRIMARY KEY,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    services_offered      JSONB NOT NULL DEFAULT '[]'::jsonb,
    budget_slider_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
    ui_options            JSONB NOT NULL DEFAULT '{}'::jsonb
);
