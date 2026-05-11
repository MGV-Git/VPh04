from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str = "change_me_super_secret_jwt_key"
    jwt_expire_minutes: int = 60 * 12
    # Список хостов (без схемы), с которых разрешён POST /api/behavior-metrics/. Пусто = взять nginx_main_server_name; оба пусты = не проверять.
    behavior_metrics_trusted_hosts: str = ""
    nginx_main_server_name: str = ""


settings = Settings()
