import enum
import logging
import os
from functools import lru_cache
from io import StringIO
from urllib.parse import quote

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
    model_config = SettingsConfigDict(
        case_sensitive=True, env_file_encoding="utf-8", extra="ignore"
    )
    ENV: AppENV | None = AppENV.LOCAL

    GCP_PROJECT_ID: str | None = None

    GCP_STORAGE_CHAT_DATA_BUCKET: str | None = None
    CLOUD_SQL_CONNECTION_NAME: str = ""

    # Direct access to GCS bucket - use GCP_STORAGE_CHAT_DATA_BUCKET directly
    # Deprecated property removed - use direct attribute access

    DB_HOST: str | None = None
    DB_PORT: str = "5432"
    DB_USER: str | None = None
    DB_PASS: str | None = None
    DB_NAME: str | None = None

    def get_database_url(self) -> str:
        if not all(
            [
                self.DB_HOST,
                self.DB_USER,
                self.DB_PASS,
                self.DB_NAME,
            ]
        ):
            raise ValueError(
                "Database configuration incomplete. Required: DB_HOST, DB_USER, DB_PASS, DB_NAME, CLOUD_SQL_CONNECTION_NAME"
            )

        # URL encode the password to handle special characters
        encoded_password = quote(self.DB_PASS, safe="")

        query_param = (f"?host=/cloudsql/{self.CLOUD_SQL_CONNECTION_NAME}"
            if os.getenv("ENV", "").lower() == AppENV.LOCAL else ""
        )

        return (
            f"postgresql://{self.DB_USER}:{encoded_password}@{self.DB_HOST}:"
            f"{self.DB_PORT}/{self.DB_NAME}{query_param}"
        )

    MAX_FILE_SIZE_GB: float = 4.0
    IMPORT_TIMEOUT_MINUTES: int = 30

    GCS_EMULATOR_HOST: str | None = None

    # Direct access to storage emulator host - use GCS_EMULATOR_HOST directly
    # Deprecated method removed - use direct attribute access


@lru_cache()
def get_settings():
    load_dotenv()

    env_mode = os.getenv("ENV", "").lower()

    if env_mode == AppENV.LOCAL:
        # For local development, load from .env files directly
        settings = Settings(_env_file=".env")
    else:
        settings = None
        try:
            access_secret_version()
            settings = Settings()
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.warning(
                f"Failed to access secrets, falling back to environment variables: {type(e).__name__}"
            )
            settings = Settings()

    return settings


settings = get_settings()
