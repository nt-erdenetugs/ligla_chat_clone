from logger.logger import DataProcessingError, logger
import pandas as pd
from typing import Any, override
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from schemas.store import Store, StoreCSVData
from crud.store import crud_store
from handlers.base import BaseHandler
from utils.csv_utils import read_csv_from_bucket
from utils.context_manager import advisory_lock


def _norm_name(s: str | None) -> str | None:
    if s is None:
        return None
    return s.strip().lower() or None


class StoreHandler(BaseHandler):
    entity_name: str = "stores"
    directory_name: str = "stores"
    filename_pattern: str = "-store_data-"

    @override
    def validate_file(self, file_name: str) -> str:
        from utils.file_validation import validate_file

        return validate_file(file_name, self.directory_name, self.filename_pattern)

    @override
    def read_csv(self, bucket_name: str, file_name: str):
        return read_csv_from_bucket(bucket_name, file_name, StoreCSVData)

    @override
    def clean_data(self, data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not data:
            return data

        cleaned_data: list[dict[str, Any]] = []
        issues_count = 0

        timestamp_fields = {"startsAt", "endsAt", "createdAt", "updatedAt"}
        string_fields = {"name", "typeName", "areaName", "note"}
        numeric_fields = {"liglaStoreId", "id"}

        for row in data:
            cleaned_row: dict[str, Any] = {}
            for key, value in row.items():
                try:
                    if value is None:
                        cleaned_row[key] = None
                        continue
                    if pd.isna(value):
                        cleaned_row[key] = None
                        issues_count += 1
                        continue
                    if key in timestamp_fields:
                        if isinstance(value, str) and value.strip() in {
                            "",
                            "NaT",
                            "None",
                            "null",
                        }:
                            cleaned_row[key] = None
                            issues_count += 1
                        else:
                            cleaned_row[key] = value
                    elif key in string_fields:
                        if isinstance(value, str):
                            cleaned_value = value.strip()[:255] if value else None
                            cleaned_row[key] = cleaned_value if cleaned_value else None
                        else:
                            cleaned_row[key] = str(value) if value is not None else None
                    elif key in numeric_fields:
                        # CRITICAL SAFETY: Strict numeric validation with detailed error reporting
                        numeric_value, error_msg = self._safe_numeric_conversion(
                            value, key
                        )
                        if error_msg:
                            # Log detailed error instead of silent failure
                            logger.warning(
                                f"❌ Invalid {key} value '{value}' in row {len(cleaned_data) + 1}: {error_msg}"
                            )
                            self._log_data_quality_issue(row, key, value, error_msg)
                            issues_count += 1

                        cleaned_row[key] = numeric_value
                    else:
                        cleaned_row[key] = value
                except Exception:
                    cleaned_row[key] = None
                    issues_count += 1
            cleaned_data.append(cleaned_row)

        if issues_count > 0:
            logger.warning(
                f"Cleaned {issues_count} problematic values in {len(data)} rows"
            )

        return cleaned_data

    @override
    def get_dataframes(
        self, db: Session, org_name: str, mapped_rows: list[dict[str, Any]]
    ):
        current_stores = crud_store.get_stores_by_organization(db)
        comparison_fields = Store.get_comparison_fields()

        df_current = (
            pd.DataFrame([store.dict() for store in current_stores])
            if current_stores
            else pd.DataFrame(columns=comparison_fields)
        )
        df_incoming = pd.DataFrame(mapped_rows)

        for df in [df_current, df_incoming]:
            for col in comparison_fields:
                if col not in df.columns:
                    df[col] = None

        for df in [df_current, df_incoming]:
            if "liglaStoreId" not in df.columns and "id" in df.columns:
                df["liglaStoreId"] = df["id"]
            if "liglaStoreId" in df.columns:
                df["liglaStoreId"] = (
                    pd.to_numeric(df["liglaStoreId"], errors="coerce")
                    .fillna(0)
                    .astype(int)
                )
                df.set_index("liglaStoreId", inplace=True)
            else:
                df.set_index(pd.Index([], name="liglaStoreId"), inplace=True)

        return df_current, df_incoming

    @override
    def identify_changes(
        self, df_current: pd.DataFrame, df_incoming: pd.DataFrame
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[int]]:
        if df_current.empty:
            return [], df_incoming.reset_index().to_dict("records"), []

        current_ids = set(df_current.index)
        incoming_ids = set(df_incoming.index)

        stores_to_create = incoming_ids - current_ids
        stores_to_disable = list(current_ids - incoming_ids)

        create_rows = (
            df_incoming.loc[list(stores_to_create)].reset_index().to_dict("records")
            if stores_to_create
            else []
        )

        shared_columns = set(df_incoming.columns) & set(df_current.columns)
        df_merged = pd.merge(
            df_current.reset_index(),
            df_incoming.reset_index(),
            on="liglaStoreId",
            how="inner",
            suffixes=("_cur", "_new"),
        )

        diff_mask = pd.Series(False, index=df_merged.index)
        for col in shared_columns:
            if col != "liglaStoreId":
                cur_col = f"{col}_cur"
                new_col = f"{col}_new"
                diff_mask |= df_merged[cur_col] != df_merged[new_col]

        update_columns = ["liglaStoreId"] + [
            f"{col}_new" for col in shared_columns if col != "liglaStoreId"
        ]
        rename_map = {
            f"{col}_new": col for col in shared_columns if col != "liglaStoreId"
        }
        update_rows = (
            df_merged[diff_mask][update_columns]
            .rename(columns=rename_map)
            .to_dict("records")
        )

        return update_rows, create_rows, stores_to_disable

    @override
    def process_batch(
        self,
        db: Session,
        org_name: str,
        rows: list[dict[str, Any]],
        required_fields: set[str] | None = None,
    ) -> None:
        required_fields = {"id", "name"}

        # Track processing outcomes
        stats = {
            "total_rows": len(rows),
            "invalid_id_skipped": 0,
            "blank_name_skipped": 0,
            "duplicate_id_skipped": 0,
            "duplicate_name_skipped": 0,
            "valid_after_dedup": 0,
        }

        # CSV-level validation + dedup: keep first occurrence
        seen_ids: set[int] = set()
        seen_names: set[str] = set()
        deduped: list[dict[str, Any]] = []
        for r in rows:
            # Validate id
            try:
                store_id = int(r["id"])
            except (ValueError, TypeError):
                logger.error(f"Invalid store id (skipped): {r.get('id')}")
                stats["invalid_id_skipped"] += 1
                continue
            if store_id <= 0:
                logger.error(f"Non-positive store id (skipped): {store_id}")
                stats["invalid_id_skipped"] += 1
                continue

            # Validate name
            name_norm = _norm_name(r.get("name"))
            if not name_norm:
                logger.error(f"Blank store name (skipped). id={store_id}")
                stats["blank_name_skipped"] += 1
                continue

            # Dedup
            if store_id in seen_ids:
                logger.error(f"Duplicate store id in CSV (skipped): {store_id}")
                stats["duplicate_id_skipped"] += 1
                continue
            if name_norm in seen_names:
                logger.error(f"Duplicate store name in CSV (skipped): {r.get('name')}")
                stats["duplicate_name_skipped"] += 1
                continue

            seen_ids.add(store_id)
            seen_names.add(name_norm)
            deduped.append(r)

        stats["valid_after_dedup"] = len(deduped)

        try:
            with advisory_lock(db, org_name):
                # Do NOT open a nested transaction here; Session already auto-begins
                super().process_batch(db, org_name, deduped, required_fields)
                db.commit()

                # Log final summary with counts
                logger.info(
                    f"Store import summary for {org_name}: "
                    f"total_rows={stats['total_rows']}, "
                    f"invalid/skipped={stats['invalid_id_skipped'] + stats['blank_name_skipped'] + stats['duplicate_id_skipped'] + stats['duplicate_name_skipped']}, "
                    f"processed={stats['valid_after_dedup']}"
                )
        except Exception as e:
            db.rollback()
            raise DataProcessingError(f"failed to process data: {str(e)}")

    @override
    def process_disables(
        self, db: Session, org_name: str, disable_ids: set[int]
    ) -> None:
        store_status_map = crud_store.get_stores_status(db, disable_ids)
        active_stores = {
            store_id
            for store_id, is_active in store_status_map.items()
            if bool(is_active)
        }
        if active_stores:
            crud_store.soft_delete_stores(db, active_stores)
            logger.info(
                f"Soft deleted these [{len(active_stores)}] stores: {list(active_stores)}"
            )

    @override
    def process_creates(
        self, db: Session, org_name: str, create_rows: list[dict[str, Any]]
    ):
        if not create_rows:
            return

        existing = crud_store.get_all_stores_by_organization(db)
        by_id = {int(r["liglaStoreId"]): r for r in existing}
        by_name_norm = {}
        for r in existing:
            name_norm = _norm_name(r["name"])
            if name_norm is not None:
                by_name_norm[name_norm] = int(r["liglaStoreId"])

        for row in create_rows:
            sid = int(row["liglaStoreId"])
            name_norm = _norm_name(row.get("name"))
            if not name_norm:
                logger.error(f"Create skipped: blank name. id={sid}")
                continue

            # id collision
            if sid in by_id:
                if not by_id[sid]["isActive"]:
                    # Check if reactivation would violate name uniqueness
                    if name_norm in by_name_norm and by_name_norm[name_norm] != sid:
                        logger.error(
                            f"Reactivation would violate unique name (name exists with different id), skipping: id={sid}, name='{row.get('name')}'"
                        )
                        continue
                    try:
                        crud_store.reactivate_store(db, row)
                        logger.info(f"Reactivated inactive store id={sid}")
                    except SQLAlchemyError as e:
                        logger.error(f"Database error reactivating store {sid}: {e}")
                        continue
                    except Exception as e:
                        logger.error(f"Unexpected error reactivating store {sid}: {e}")
                        continue
                    continue
                logger.error(
                    f"Store id already exists (active), skipping create: {sid}"
                )
                continue

            # name collision with different id
            if name_norm in by_name_norm and by_name_norm[name_norm] != sid:
                logger.error(
                    f"Store name already exists with different id, skipping create: name='{row.get('name')}'"
                )
                continue

            try:
                crud_store.create_store(db, row)
            except SQLAlchemyError as e:
                logger.error(f"Database error creating store {sid}: {e}")
                continue
            except Exception as e:
                logger.error(f"Unexpected error creating store {sid}: {e}")
                continue

    def _safe_numeric_conversion(
        self, value: Any, field_name: str
    ) -> tuple[Any, str | None]:
        try:
            if value is None or (
                pd.isna(value) if hasattr(pd, "isna") and callable(pd.isna) else False
            ):
                return (0 if field_name == "liglaStoreId" else None, None)

            if isinstance(value, float) and (
                value == float("inf") or value == float("-inf")
            ):
                return (
                    0 if field_name == "liglaStoreId" else None,
                    "Infinity value not allowed",
                )

            if isinstance(value, (int, float)):
                if field_name == "liglaStoreId":
                    if not isinstance(value, int) or value < 0:
                        return (
                            0,
                            f"liglaStoreId must be non-negative integer, got {value}",
                        )
                    return (int(value), None)
                return (value, None)

            if isinstance(value, str):
                stripped = value.strip()
                if not stripped:
                    return (
                        0 if field_name == "liglaStoreId" else None,
                        "Empty string not allowed",
                    )

                try:
                    int_value = int(float(stripped))
                    if field_name == "liglaStoreId" and int_value < 0:
                        return (
                            0,
                            f"liglaStoreId must be non-negative, got {int_value}",
                        )
                    return (
                        int_value if field_name == "liglaStoreId" else float(stripped),
                        None,
                    )
                except ValueError:
                    return (
                        0 if field_name == "liglaStoreId" else None,
                        f"Cannot convert '{stripped}' to number",
                    )

            try:
                numeric_value = float(value)
                if field_name == "liglaStoreId":
                    int_value = int(numeric_value)
                    if int_value < 0:
                        return (
                            0,
                            f"liglaStoreId must be non-negative, got {int_value}",
                        )
                    return (int_value, None)
                return (numeric_value, None)
            except (ValueError, TypeError, OverflowError):
                return (
                    0 if field_name == "liglaStoreId" else None,
                    f"Cannot convert {type(value).__name__} '{value}' to number",
                )

        except Exception as e:
            return (
                0 if field_name == "liglaStoreId" else None,
                f"Unexpected error during conversion: {str(e)}",
            )

    def _log_data_quality_issue(
        self, row: dict[str, Any], field_name: str, value: Any, error_msg: str
    ) -> None:
        """
        Log detailed information about data quality issues for debugging and monitoring.
        """
        try:
            # Extract row identifier for traceability
            row_id = row.get("id", row.get("liglaStoreId", "unknown"))

            logger.warning(
                f"📊 Data Quality Issue - Row {row_id}, Field '{field_name}':"
            )
            logger.warning(
                f"   Raw Value: {repr(value)} (type: {type(value).__name__})"
            )
            logger.warning(f"   Error: {error_msg}")
            logger.warning(
                f"   Row Context: {dict(list(row.items())[:3])}..."
            )  # First 3 fields for context

            # Could send to monitoring system here
            # self._report_to_monitoring(row_id, field_name, value, error_msg)

        except Exception as log_error:
            logger.error(f"Failed to log data quality issue: {str(log_error)}")

    @override
    def process_updates(
        self, db: Session, org_name: str, update_rows: list[dict[str, Any]]
    ):
        if not update_rows:
            return

        existing = crud_store.get_all_stores_by_organization(db)
        by_name_norm_to_id = {}
        for r in existing:
            name_norm = _norm_name(r["name"])
            if name_norm is not None:
                by_name_norm_to_id[name_norm] = int(r["liglaStoreId"])

        filtered: list[dict[str, Any]] = []
        for row in update_rows:
            sid = int(row["liglaStoreId"])
            name_norm = _norm_name(row.get("name"))
            if not name_norm:
                logger.error(f"Update skipped due to blank name. id={sid}")
                continue
            if name_norm in by_name_norm_to_id and by_name_norm_to_id[name_norm] != sid:
                logger.error(
                    f"Update would violate unique name; skipping: id={sid}, name='{row.get('name')}'"
                )
                continue
            filtered.append(row)

        if filtered:
            crud_store.update_stores(db, filtered)
