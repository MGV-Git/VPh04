-- Однократно для уже существующей БД (init из docker-entrypoint-initdb.d выполняется только при пустом volume).
CREATE TABLE IF NOT EXISTS page_behavior_telemetry (
    id                      BIGSERIAL PRIMARY KEY,
    received_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    application_id          BIGINT NOT NULL DEFAULT 0,
    time_on_page_seconds      DOUBLE PRECISION NOT NULL DEFAULT 0,
    buttons_clicked           TEXT NOT NULL DEFAULT '',
    cursor_positions          TEXT NOT NULL DEFAULT '',
    return_frequency          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_page_behavior_telemetry_received
    ON page_behavior_telemetry (received_at DESC);
