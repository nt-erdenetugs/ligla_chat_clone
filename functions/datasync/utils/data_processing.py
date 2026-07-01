from __future__ import annotations

from typing import Any, Callable

from sqlalchemy.orm import Session

from constants import DEFAULT_MAX_BATCH_SIZE
from logger.logger import logger


def process_large_dataset(
    db: Session,
    org_name: str,
    csv_rows: list[dict[str, Any]],
    process_batch_fn: Callable[[Session, str, list[dict[str, Any]]], None],
    max_batch_size: int = DEFAULT_MAX_BATCH_SIZE,
) -> None:
    total_rows = len(csv_rows)

    if total_rows <= max_batch_size:
        process_batch_fn(db, org_name, csv_rows)
        return

    logger.info(
        f"Processing large dataset of {total_rows} rows in batches of {max_batch_size}"
    )

    for i in range(0, total_rows, max_batch_size):
        batch = csv_rows[i : i + max_batch_size]
        batch_num = (i // max_batch_size) + 1
        total_batches = (total_rows + max_batch_size - 1) // max_batch_size

        logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} rows)")
        process_batch_fn(db, org_name, batch)
