from typing import Any, override

from sqlalchemy.orm import Session
from crud.column_alias import ColumnSettingType, crud_column_alias_setting
from handlers.base import BaseHandler
from logger.logger import DataProcessingError, logger
from schemas.survey_feed_columns import SurveyFeedColumns
from utils.context_manager import advisory_lock
from utils.csv_utils import read_csv_from_bucket
from utils.file_validation import validate_file
import pandas as pd


class SurveyFeedColumnHandler(BaseHandler):
    entity_name: str = "survey_feed_columns"
    directory_name: str = "settings"
    filename_pattern: str = "-additions-"

    @override
    def validate_file(self, file_name: str):
        return validate_file(
            file_name=file_name,
            directory_name=self.directory_name,
            filename_pattern=self.filename_pattern,
        )

    @override
    def read_csv(self, bucket_name: str, file_name: str):
        return read_csv_from_bucket(
            file_name=file_name,
            bucket_name=bucket_name,
            dataType=SurveyFeedColumns,
            max_rows=1,
        )

    @override
    def clean_data(self, data: list[dict[str, Any]]):
        if not data:
            return data

        cleaned_data: list[dict[str, str | None]] = []

        issues_count = 0

        for row in data:
            cleaned_row: dict[str, str | None] = {}
            for key, value in row.items():
                try:
                    if value is None:
                        # Preserve explicit None to clear existing alias in settings
                        cleaned_row[key] = None
                        continue
                    if pd.isna(value):
                        # Preserve NaN as None to clear existing alias in settings
                        cleaned_row[key] = None
                        issues_count += 1
                        continue

                    if isinstance(value, str):
                        cleaned_value = value.strip()[:255] if value else None
                        # Only add non-None values to allow server defaults
                        if cleaned_value:
                            cleaned_row[key] = cleaned_value
                    else:
                        cleaned_row[key] = str(value) if value is not None else None
                        issues_count += 1
                except Exception:
                    # Skip exception cases to allow server defaults
                    issues_count += 1

            cleaned_data.append(cleaned_row)

        if issues_count > 0:
            logger.warning(
                f"Cleaned {issues_count} problematic values in {len(data)} rows"
            )

        return cleaned_data

    @override
    def process_batch(
        self,
        db: Session,
        org_name: str,
        rows: list[dict[str, Any]],
        required_fields: set[str] | None = None,
    ) -> None:
        cleaned_data = self.clean_data(rows)

        try:
            with advisory_lock(db, org_name):
                crud_column_alias_setting.upsert_data(
                    db, cleaned_data, ColumnSettingType.SURVEY
                )
                db.commit()
        except Exception as e:
            db.rollback()
            raise DataProcessingError(f"failed to process data: {str(e)}")

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
    def process_creates(
        self, db: Session, org_name: str, create_rows: list[dict[str, Any]]
    ):
        return

    @override
    def process_updates(
        self, db: Session, org_name: str, update_rows: list[dict[str, Any]]
    ):
        return

    @override
    def process_disables(self, db: Session, org_name: str, disable_ids: set[int]):
        return
