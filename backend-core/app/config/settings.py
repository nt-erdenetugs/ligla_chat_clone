import enum
import os
from functools import lru_cache
from io import StringIO
from pathlib import Path
from typing import cast

from dotenv import load_dotenv
from google import auth

try:
    from google.cloud import secretmanager  # type: ignore
except Exception:  # pragma: no cover
    secretmanager = None  # type: ignore

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppENV(enum.StrEnum):
    LOCAL = "local"
    DEV = "dev"
    STG = "staging"
    PRD = "production"


GCP_SECRET_ID = "CHAT_ENV"

# backend-core project root (parent of app/)
PROJECT_ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_INI_PATH = PROJECT_ROOT / "alembic.ini"


def access_secret_version() -> None:
    if secretmanager is None:
        raise RuntimeError("google-cloud-secret-manager is not installed")

    client = secretmanager.SecretManagerServiceClient()  # type: ignore[attr-defined]

    _creds, project_id_any = auth.default()  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
    project_id = cast(str, project_id_any)
    secret_id = GCP_SECRET_ID
    version_id = "latest"

    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
    response = client.access_secret_version(request={"name": name})  # type: ignore[no-untyped-call]

    payload_bytes: bytes = response.payload.data  # type: ignore[union-attr]
    payload = StringIO(payload_bytes.decode("UTF-8"))
    load_dotenv(stream=payload, override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, env_file_encoding="utf-8", extra="allow")

    ENV: AppENV = AppENV.LOCAL
    PROJECT_NAME: str = ""
    API_V1_STR: str = "/api/v1"
    OPENAPI_URL: str = f"{API_V1_STR}/openapi.json"
    BACKEND_CORS_ORIGINS: list[AnyHttpUrl] = []

    LIGLA_MESSAGE_BASE_URL: str
    LIGLA_MESSAGE_CLOSE_ENDPOINT_PATH: str = "/apis/chat/close"

    # GCP Settings
    GCP_PROJECT_ID: str
    BFF_URL_RECEIVE_CHAT: str

    RECEIVE_MESSAGE_TOPIC_NAME: str
    RECEIVE_MESSAGE_TOPIC_SUBSCRIPTION_NAME: str
    RECEIVE_MESSAGE_DLQ_TOPIC_NAME: str
    RECEIVE_MESSAGE_DLQ_TOPIC_SUBSCRIPTION_NAME: str
    RECEIVE_MESSAGE_PUSH_ENDPOINT: str

    PUBSUB_EMULATOR_HOST: str = "pubsub-emulator:8085"

    # Storage Settings
    GCS_EMULATOR_HOST: str | None = None
    GCP_STORAGE_CHAT_DATA_BUCKET: str
    GCP_STORAGE_CHAT_PUBLIC_DATA_BUCKET: str

    JWT_SECRET: str = "ligla_secret"
    ENCRYPTION_MASTER_KEY: str = ""

    DB_HOST: str = "postgres"
    DB_PORT: str = "5432"
    DB_USER: str = "ligla_user"
    DB_PASS: str = "ligla_password"
    DB_NAME: str = "ligla_db"
    DATABASE_URL: str | None = None
    CLOUD_SQL_CONNECTION_NAME: str
    DB_SYNC_NOTIFY_CHANNEL: str = "sync_channel"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return []


@lru_cache
def get_settings() -> Settings:
    load_dotenv()
    env = os.getenv("ENV")
    is_local = env in (None, "local")

    if not is_local:
        access_secret_version()

    if is_local:
        return Settings(_env_file=".env")
    return Settings()


settings = get_settings()
