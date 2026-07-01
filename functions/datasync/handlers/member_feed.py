import re
from typing import Any, override
import requests
import google.auth.transport.requests
import google.oauth2.id_token

from sqlalchemy.orm import Session
from handlers.base import BaseHandler
from logger.logger import logger
from config import settings, AppENV
import pandas as pd


class MemberFeedHandler(BaseHandler):
    entity_name: str = "member_feed"
    directory_name: str = "client_users"
    filename_pattern: str = "client_user_data"

    @override
    def validate_file(self, file_name: str):
        if not (
            file_name.endswith(".csv")
            or file_name.endswith(".csv.gz")
            or file_name.endswith(".gzip")
        ):
            raise ValueError(
                "Member feed file must end with '.csv', '.csv.gz', or '.gzip'"
            )

        file_name = file_name.strip("/")
        parts = file_name.split("/")

        if len(parts) == 3 and parts[1] == "client_users":
            org_name = parts[0]
            filename = parts[2]

            # Validate filename pattern: organization_name-client_user_data-timestamp.csv[.gz]
            pattern = rf"^{re.escape(org_name)}-client_user_data-\d{{8}}_\d{{6}}\.csv(?:\.gz|\.gzip)?$"
            if not re.match(pattern, filename):
                raise ValueError(
                    f"Invalid filename pattern: {filename}. "
                    f"Expected format: {org_name}-client_user_data-YYYYMMDD_HHMMSS.csv.gz"
                )

            logger.info(f"Valid member feed file for organization: {org_name}")
            return org_name

        raise ValueError(
            f"Invalid member feed file format: {file_name}. ONLY accepted format: organization_name/client_users/filename"
        )

    @override
    def read_csv(self, bucket_name: str, file_name: str):
        return iter([])

    @override
    def clean_data(self, data: list[dict[str, Any]]):
        return data

    @override
    def get_dataframes(
        self, db: Session, org_name: str, mapped_rows: list[dict[str, Any]]
    ):
        return None

    @override
    def identify_changes(
        self, df_current: pd.DataFrame, df_incoming: pd.DataFrame
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[int]]:
        return [], [], []

    @override
    def process_updates(
        self, db: Session, org_name: str, update_rows: list[dict[str, Any]]
    ):
        pass

    @override
    def process_creates(
        self, db: Session, org_name: str, create_rows: list[dict[str, Any]]
    ):
        pass

    @override
    def process_disables(self, db: Session, org_name: str, disable_ids: set[int]):
        pass

    @override
    def process_batch(
        self,
        db: Session,
        org_name: str,
        rows: list[dict[str, Any]],
        required_fields: set[str] | None = None,
    ) -> None:
        """
        Route member feed file to Cloud Run service instead of processing locally.
        This is the main entry point for member feed processing.
        """
        pass

    def route_to_cloud_run(self, file_path: str) -> bool | None:
        """Route member feed files to the member-feed-sync Cloud Run service"""

        base_url = settings.MEMBER_SYNC_SERVICE_URL
        if not base_url:
            logger.error("MEMBER_SYNC_SERVICE_URL not configured")
            return None

        base_url = base_url.strip('"').strip("'")

        if base_url.endswith("/sync/file"):
            member_sync_url = base_url
            target_audience = base_url.split("/sync/file")[0]
        else:
            base_url = base_url.rstrip("/")
            member_sync_url = f"{base_url}/sync/file"
            target_audience = base_url

        try:
            payload = {"file_path": file_path}

            headers = {"Content-Type": "application/json"}

            if settings.ENV != AppENV.LOCAL:
                auth_req = google.auth.transport.requests.Request()
                id_token = google.oauth2.id_token.fetch_id_token(
                    auth_req, target_audience
                )
                headers["Authorization"] = f"Bearer {id_token}"

            logger.info(
                f"Routing member file to Cloud Run service: {file_path} -> {member_sync_url}"
            )

            response = requests.post(
                member_sync_url, json=payload, headers=headers, timeout=300
            )

            if response.status_code == 200:
                logger.info(
                    f"Successfully routed member file {file_path} to Cloud Run service"
                )
                return True
            else:
                logger.error(
                    f"Failed to route member file {file_path}: HTTP {response.status_code} - {response.text}"
                )
                return None

        except requests.exceptions.RequestException as e:
            logger.error(f"Network error routing member file {file_path}: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error routing member file {file_path}: {str(e)}")
            return None
