# pyright: reportPrivateUsage=false
"""
Backfill SQL contract: build_encrypt_config must render UPDATE statements
that write to the encrypted shadow column (contentEncrypted / noteValueEncrypted /
valueEncrypted), NOT the plaintext source column. A bug that swaps these would
silently corrupt prod data — old-BFF reads of `content` (JSONB) would see
encrypted bytes and fail with "String cannot represent value: Buffer".
"""

from unittest.mock import MagicMock, patch

import pytest

from jobs.tenant_manager.operations.encryption import (
    ENCRYPTION_TARGETS,
    EncryptionTarget,
    build_encrypt_config,
    process_table_data_batch,
)


@pytest.fixture
def encryption_targets_by_table() -> dict[str, EncryptionTarget]:
    return {target.table: target for target in ENCRYPTION_TARGETS}


def _captured_update_sql(target: EncryptionTarget, encryption_service, batch_size: int = 100) -> str:
    """Drive process_table_data_batch one batch deep with all DB interactions mocked,
    and return the UPDATE SQL string the function would have executed.
    """
    engine = MagicMock()
    executed: list[str] = []

    def capture_execute(stmt, *args, **kwargs):
        text_repr = stmt.text if hasattr(stmt, "text") else str(stmt)
        executed.append(text_repr)
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1
        mock_result.rowcount = 0
        return mock_result

    # engine.connect() is used as a context manager for the COUNT(*) probe.
    connect_conn = MagicMock()
    connect_conn.execute.side_effect = capture_execute
    connect_conn.__enter__ = MagicMock(return_value=connect_conn)
    connect_conn.__exit__ = MagicMock(return_value=False)
    engine.connect.return_value = connect_conn

    # engine.begin() is the transactional context for the UPDATE.
    transaction_conn = MagicMock()
    transaction_conn.execute.side_effect = capture_execute
    engine.begin.return_value.__enter__.return_value = transaction_conn
    engine.begin.return_value.__exit__ = MagicMock(return_value=False)

    config = build_encrypt_config(target, "org_test")

    with (
        patch("jobs.tenant_manager.operations.encryption.table_exists", return_value=True),
        patch(
            "jobs.tenant_manager.operations.encryption.get_pk_or_unique_columns",
            return_value=["id"],
        ),
    ):
        process_table_data_batch(
            engine=engine,
            schema="org_test",
            org_id="00000000-0000-0000-0000-000000000001",
            target=target,
            encryption_service=encryption_service,
            batch_size=batch_size,
            dry_run=False,
            config=config,
        )

    update_statements = [s for s in executed if "UPDATE " in s and "SET " in s]
    assert update_statements, f"No UPDATE captured. Executed: {executed!r}"
    return update_statements[0]


@pytest.mark.parametrize(
    "table_name, expected_encrypted_col, expected_plaintext_col",
    [
        ("chatMessage", "contentEncrypted", "content"),
        ("note", "noteValueEncrypted", "noteValue"),
        ("chatAttributeValue", "valueEncrypted", "value"),
    ],
)
def test_backfill_update_writes_to_encrypted_column_not_plaintext(
    encryption_targets_by_table: dict[str, EncryptionTarget],
    table_name: str,
    expected_encrypted_col: str,
    expected_plaintext_col: str,
) -> None:
    target = encryption_targets_by_table[table_name]
    encryption_service = MagicMock()
    encryption_service.derive_org_key.return_value = "derived-key"

    update_sql = _captured_update_sql(target, encryption_service)

    assert f'SET "{expected_encrypted_col}" = ' in update_sql, (
        f"Backfill UPDATE for {table_name} did NOT target {expected_encrypted_col}. "
        f"This is the bug class that corrupts prod data. SQL was:\n{update_sql}"
    )
    assert "pgp_sym_encrypt" in update_sql, (
        f"Backfill UPDATE for {table_name} is not using pgp_sym_encrypt. SQL:\n{update_sql}"
    )

    forbidden_set = f'SET "{expected_plaintext_col}" ='
    assert forbidden_set not in update_sql, (
        f"Backfill UPDATE for {table_name} writes to the plaintext column "
        f'"{expected_plaintext_col}" — this is the silent-corruption bug. SQL:\n{update_sql}'
    )

    # chatMessage / note: is_encrypted_set_expr is the literal "true".
    # chatAttributeValue: it's a CASE expression that evaluates to true/false per row.
    if target.row_encrypt_predicate is None:
        assert '"isEncrypted" = true' in update_sql, (
            f"Backfill UPDATE for {table_name} does not flip isEncrypted = true. SQL:\n{update_sql}"
        )
    else:
        assert '"isEncrypted" = CASE WHEN' in update_sql, (
            f"Backfill UPDATE for {table_name} does not set isEncrypted via per-row CASE. SQL:\n{update_sql}"
        )

    # WHERE filter on the working set:
    # - always-encrypted tables (chatMessage, note) filter on `isEncrypted = false`
    #   so the partial backfill index can serve the query.
    # - chatAttributeValue filters on `valueEncrypted IS NULL` because per-attribute
    #   rows that opt out remain isEncrypted=false forever and must not be revisited.
    if target.row_encrypt_predicate is None:
        assert '"isEncrypted" = false' in update_sql, (
            f"Backfill UPDATE for {table_name} does not filter on isEncrypted = false "
            f"— this would break the partial-index optimization. SQL:\n{update_sql}"
        )
    else:
        assert f'"{expected_encrypted_col}" IS NULL' in update_sql, (
            f"Backfill UPDATE for {table_name} (per-attribute) must select on "
            f'"{expected_encrypted_col}" IS NULL so populated rows are never revisited. '
            f"SQL:\n{update_sql}"
        )
