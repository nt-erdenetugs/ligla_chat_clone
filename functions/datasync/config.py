import enum
import traceback
from functools import lru_cache
from io import StringIO

import google.auth
from dotenv import load_dotenv
from google.cloud import secretmanager
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppENV(enum.Enum):
    LOCAL = "local"
    DEV = "dev"
    STG = "staging"
    PRD = "production"


def access_secret_version():
    client = secretmanager.SecretManagerServiceClient()

    _, project_id = google.auth.default()
    secret_id = "CHAT_ENV"
    version_id = "latest"

    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
    response = client.access_secret_version(request={"name": name})

    payload = StringIO(response.payload.data.decode("UTF-8"))
    load_dotenv(stream=payload, override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, env_file_encoding="utf-8")
    ENV: AppENV

    GCP_PROJECT_ID: str

    MEMBER_SYNC_SERVICE_URL: str | None = None

    GCS_EMULATOR_HOST: str | None = None

    # For DB
    DB_HOST: str
    DB_PORT: str = "5432"
    DB_USER: str
    DB_PASS: str
    DB_NAME: str
    CLOUD_SQL_CONNECTION_NAME: str


@lru_cache()
def get_settings():
    load_dotenv()
    settings = None
    try:
        access_secret_version()
        settings = Settings()
    except Exception:
        traceback.print_exc()
        settings = Settings(_env_file=".env")

    return settings


settings = get_settings()
