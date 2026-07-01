from abc import ABC, abstractmethod
from collections.abc import Generator
from typing import Any
from sqlalchemy.orm import Session
from logger.logger import DataProcessingError, ProcessingStatus, logger
import pandas as pd
from utils.context_manager import log_operation, safe_database_operation


class BaseHandler(ABC):
    entity_name: str
    directory_name: str
    filename_pattern: str

    @abstractmethod
    def validate_file(self, file_name: str) -> str:
        pass

    @abstractmethod
    def read_csv(
        self, bucket_name: str, file_name: str
    ) -> Generator[dict[str, Any], None, None]:
        pass

    @abstractmethod
    def clean_data(self, data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        pass

    @abstractmethod
    def get_dataframes(
        self, db: Session, org_name: str, mapped_rows: list[dict[str, Any]]
    ) -> tuple[pd.DataFrame, pd.DataFrame] | None:
        pass

    @abstractmethod
    def identify_changes(
        self, df_current: pd.DataFrame, df_incoming: pd.DataFrame
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[int]]:
        pass

    @abstractmethod
    def process_updates(
        self, db: Session, org_name: str, update_rows: list[dict[str, Any]]
    ):
        pass

    @abstractmethod
    def process_creates(
        self, db: Session, org_name: str, create_rows: list[dict[str, Any]]
    ):
        pass

    @abstractmethod
    def process_disables(self, db: Session, org_name: str, disable_ids: set[int]):
        pass

    def process_batch(
        self,
        db: Session,
        org_name: str,
        rows: list[dict[str, Any]],
        required_fields: set[str] | None = None,
    ) -> None:
        if not rows:
            return

        for i, row in enumerate(rows[:5]):
            if not required_fields:
                continue
            missing_fields = required_fields - set(row.keys())
            if missing_fields:
                raise DataProcessingError(
                    f"Missing required fields {missing_fields} in row {i}"
                )

        mapped_rows = self.clean_data(
            [{**row, "liglaStoreId": row["id"]} for row in rows]
        )

        status = ProcessingStatus()
        status.total_rows = len(mapped_rows)

        dfs = self.get_dataframes(db, org_name, mapped_rows)
        if not dfs:
            return None

        df_current, df_incoming = dfs

        update_rows, create_rows, disable_rows = self.identify_changes(
            df_current, df_incoming
        )

        if disable_rows:
            with log_operation("store disabling", len(disable_rows)):
                self.process_disables(db, org_name, set(disable_rows))
                status.update(len(disable_rows))

        if update_rows:
            with safe_database_operation(
                "store updates", update_rows, status, self.clean_data
            ) as cleaned_data:
                self.process_updates(db, org_name, cleaned_data)

        if create_rows:
            with safe_database_operation(
                "store inserts", create_rows, status, self.clean_data
            ) as cleaned_data:
                self.process_creates(db, org_name, cleaned_data)

        logger.info(f"{self.entity_name} processing status: {status.get_progress()}")
