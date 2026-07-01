# pyright: reportPrivateUsage=false

from unittest.mock import MagicMock, patch

from jobs.tenant_manager.manager import Organization, SchemaDataOperation, TenantManager
from jobs.tenant_manager.operations.encryption import (
    ENCRYPTION_TARGETS,
    EncryptionResult,
    EncryptionTarget,
    build_decrypt_config,
    build_encrypt_config,
    process_table_data_batch,
)
from jobs.tenant_manager.operations.search_index import manage_chat_message_search_index


def _chat_message_target() -> EncryptionTarget:
    return EncryptionTarget(
        table="chatMessage",
        plaintext_column="content",
        encrypted_column="contentEncrypted",
        plaintext_to_text_expr='target_table."content"::text',
    )


def test_process_table_data_batch_derives_key_from_org_id() -> None:
    engine = MagicMock()
    connection = MagicMock()
    engine.connect.return_value.__enter__.return_value = connection
    connection.execute.return_value.scalar.return_value = 1

    encryption_service = MagicMock()
    encryption_service.derive_org_key.return_value = "derived-key"
    target = _chat_message_target()

    with (
        patch("jobs.tenant_manager.operations.encryption.table_exists", return_value=True),
        patch("jobs.tenant_manager.operations.encryption.get_pk_or_unique_columns", return_value=["id"]),
    ):
        result = process_table_data_batch(
            engine=engine,
            schema="org_test_schema",
            org_id="org-123",
            target=target,
            encryption_service=encryption_service,
            batch_size=100,
            dry_run=True,
            config=build_encrypt_config(target, "org_test_schema"),
        )

    encryption_service.derive_org_key.assert_called_once_with("org-123")
    assert result == EncryptionResult(table="chatMessage", total_rows=1, processed_count=0, error_count=0)


def test_process_single_org_passes_org_id_to_operation() -> None:
    engine = MagicMock()
    manager = TenantManager(engine)
    org = Organization(id="org-123", name="Org 1", schema_name="org_test_schema")
    encryption_service = MagicMock()
    operation_results = {
        "chatMessage": EncryptionResult(table="chatMessage", total_rows=1, processed_count=1, error_count=0)
    }
    data_fn = MagicMock(return_value=operation_results)
    operation = SchemaDataOperation(
        label="encryption",
        infinitive="encrypt",
        past_tense="encrypted",
        summary_label="ENCRYPTION",
        data_fn=data_fn,
    )

    manager.validate_schema_name = MagicMock(return_value=True)
    manager.get_existing_tenant_schemas = MagicMock(return_value=[org.schema_name])

    _, results, _ = manager._process_single_org(org, encryption_service, 100, False, operation)

    assert results == operation_results
    data_fn.assert_called_once_with(
        engine=engine,
        org_id=org.id,
        schema=org.schema_name,
        encryption_service=encryption_service,
        batch_size=100,
        dry_run=False,
    )


def test_chat_attribute_value_encrypt_config_gates_on_attribute() -> None:
    target = next(t for t in ENCRYPTION_TARGETS if t.table == "chatAttributeValue")
    assert target.row_encrypt_predicate is not None

    config = build_encrypt_config(target, "org_test_schema")

    # Encryption-enabled rows are encrypted; the rest get plain UTF-8 bytes.
    assert "CASE WHEN" in config.encrypted_column_set_expr
    assert "pgp_sym_encrypt" in config.encrypted_column_set_expr
    assert "convert_to" in config.encrypted_column_set_expr
    assert 'FROM "org_test_schema"."attribute"' in config.encrypted_column_set_expr
    assert 'a."isEncryptionEnabled" = true' in config.encrypted_column_set_expr
    assert "CASE WHEN" in config.is_encrypted_set_expr


def test_always_encrypted_targets_encrypt_every_row() -> None:
    for table in ("chatMessage", "note"):
        target = next(t for t in ENCRYPTION_TARGETS if t.table == table)
        assert target.row_encrypt_predicate is None

        config = build_encrypt_config(target, "org_test_schema")
        assert "CASE WHEN" not in config.encrypted_column_set_expr
        assert "pgp_sym_encrypt" in config.encrypted_column_set_expr
        assert config.is_encrypted_set_expr == "true"


def _count_sql_for(target: EncryptionTarget, config) -> str:
    engine = MagicMock()
    connection = MagicMock()
    engine.connect.return_value.__enter__.return_value = connection
    connection.execute.return_value.scalar.return_value = 0

    encryption_service = MagicMock()
    encryption_service.derive_org_key.return_value = "derived-key"

    with (
        patch("jobs.tenant_manager.operations.encryption.table_exists", return_value=True),
        patch("jobs.tenant_manager.operations.encryption.get_pk_or_unique_columns", return_value=["id"]),
    ):
        process_table_data_batch(
            engine=engine,
            schema="org_test_schema",
            org_id="org-123",
            target=target,
            encryption_service=encryption_service,
            batch_size=100,
            dry_run=True,
            config=config,
        )
    return str(connection.execute.call_args_list[0].args[0])


def test_encrypt_selects_rows_needing_backfill() -> None:
    # Always-encrypted tables select isEncrypted = false (also re-catches the
    # plain-byte rows an old keyless writer leaves behind).
    chat_message = next(t for t in ENCRYPTION_TARGETS if t.table == "chatMessage")
    sql = _count_sql_for(chat_message, build_encrypt_config(chat_message, "org_test_schema"))
    assert '"isEncrypted" = false' in sql

    # Per-attribute tables select only rows whose encrypted column is still NULL.
    chat_attr = next(t for t in ENCRYPTION_TARGETS if t.table == "chatAttributeValue")
    sql = _count_sql_for(chat_attr, build_encrypt_config(chat_attr, "org_test_schema"))
    assert '"valueEncrypted" IS NULL' in sql


def test_decrypt_selects_populated_encrypted_columns() -> None:
    chat_attr = next(t for t in ENCRYPTION_TARGETS if t.table == "chatAttributeValue")
    sql = _count_sql_for(chat_attr, build_decrypt_config(chat_attr))
    assert '"valueEncrypted" IS NOT NULL' in sql


def test_manage_chat_message_search_index_derives_key_from_org_id() -> None:
    engine = MagicMock()
    connection = MagicMock()
    # The search-index build runs on an AUTOCOMMIT connection (CREATE INDEX CONCURRENTLY).
    engine.connect.return_value.execution_options.return_value.__enter__.return_value = connection
    connection.execute.return_value.scalar.return_value = None

    encryption_service = MagicMock()
    encryption_service.derive_org_key.return_value = "derived-key"

    with (
        patch("jobs.tenant_manager.operations.search_index.table_exists", return_value=True),
        patch("jobs.tenant_manager.operations.search_index._index_exists", return_value=False),
        patch("jobs.tenant_manager.operations.search_index._has_search_prerequisites", return_value=(True, None)),
        patch("jobs.tenant_manager.operations.search_index._count_searchable_rows", return_value=1),
    ):
        result = manage_chat_message_search_index(
            engine=engine,
            org_id="org-123",
            schema="org_test_schema",
            encryption_service=encryption_service,
            dry_run=False,
        )

    encryption_service.derive_org_key.assert_called_once_with("org-123")
    assert result.created is True
