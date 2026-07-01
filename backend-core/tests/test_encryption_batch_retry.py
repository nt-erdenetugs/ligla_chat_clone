# pyright: reportPrivateUsage=false
"""
Backfill batch loop contract: _run_one_batch must

  - take the transaction-scoped advisory lock first and, when another worker
    already holds it, return contended=True WITHOUT touching any rows;
  - retry transient DB errors (OperationalError / connection drops) with
    backoff, up to BATCH_RETRY_MAX_ATTEMPTS;
  - NOT retry non-transient errors;

and process_table_data_batch must surface those outcomes correctly — a fully
contended table as error="locked-by-other-worker", an exhausted-retry batch as
a populated error with error_count incremented.
"""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from jobs.tenant_manager.operations.encryption import (
    BATCH_RETRY_MAX_ATTEMPTS,
    ENCRYPTION_TARGETS,
    EncryptionTarget,
    _BatchOutcome,
    _run_one_batch,
    build_encrypt_config,
    process_table_data_batch,
)

LOCK_MARKER = "pg_try_advisory_xact_lock"
UPDATE_MARKER = "backfill_marker"


_UNSET = object()


def _result(*, scalar=_UNSET, rowcount=None, first=None) -> MagicMock:
    """A mock SQLAlchemy Result with the accessors _run_one_batch reads."""
    r = MagicMock()
    if scalar is not _UNSET:
        r.scalar.return_value = scalar
    if rowcount is not None:
        r.rowcount = rowcount
    if first is not None:
        r.first.return_value = first
    else:
        r.first.return_value = None
    return r


def _scripted_engine(execute_fn):
    """An engine whose begin() transaction yields a conn driven by execute_fn.

    Returns (engine, conn) so tests can assert on conn.execute calls and on
    engine.begin.call_count (one call per batch attempt).
    """
    engine = MagicMock()
    conn = MagicMock()
    conn.execute.side_effect = execute_fn
    engine.begin.return_value.__enter__.return_value = conn
    engine.begin.return_value.__exit__ = MagicMock(return_value=False)
    return engine, conn


def _transient_error() -> OperationalError:
    return OperationalError("UPDATE backfill_marker", {}, Exception("connection reset by peer"))


def _call_run_one_batch(engine):
    return _run_one_batch(
        engine=engine,
        lock_name="tenant-encryption:org_test:chatMessage:encrypted",
        organization_key="derived-key",
        update_sql=text("UPDATE backfill_marker SET x = 1"),
        params={"batch_size": 100, "last_id": "00000000-0000-0000-0000-000000000000"},
        progress_label="encrypted",
        schema="org_test",
        table="chatMessage",
    )


# --------------------------------------------------------------------------
# _run_one_batch
# --------------------------------------------------------------------------


def test_run_one_batch_contended_returns_early_without_touching_rows() -> None:
    """Lock held by another worker -> contended=True, and SET org key / UPDATE
    are never executed."""

    def execute(stmt, params=None):
        # The lock query is the only statement that should run.
        assert LOCK_MARKER in getattr(stmt, "text", ""), f"unexpected statement before lock: {stmt!r}"
        return _result(scalar=False)

    engine, conn = _scripted_engine(execute)

    outcome = _call_run_one_batch(engine)

    assert outcome.contended is True
    assert outcome.updated_rows == 0
    assert outcome.error is None
    # Only the advisory-lock probe ran; no SET org key, no UPDATE.
    assert conn.execute.call_count == 1
    assert engine.begin.call_count == 1


def test_run_one_batch_happy_path_runs_lock_set_and_update() -> None:
    """Lock acquired -> lock + SET org key + UPDATE all run, (updated, max_id) returned."""

    def execute(stmt, params=None):
        t = getattr(stmt, "text", "")
        if LOCK_MARKER in t:
            return _result(scalar=True)
        if UPDATE_MARKER in t:
            return _result(first=(5, "11111111-1111-1111-1111-111111111111"))
        return _result()  # SET org key

    engine, conn = _scripted_engine(execute)

    outcome = _call_run_one_batch(engine)

    assert outcome.contended is False
    assert outcome.error is None
    assert outcome.updated_rows == 5
    assert outcome.last_id == "11111111-1111-1111-1111-111111111111"
    assert conn.execute.call_count == 3  # lock, SET, UPDATE
    assert engine.begin.call_count == 1


def test_run_one_batch_retries_transient_error_then_succeeds() -> None:
    """A transient OperationalError on the first attempt is retried; the second
    attempt commits and its rowcount is returned."""
    state = {"update_attempts": 0}

    def execute(stmt, params=None):
        t = getattr(stmt, "text", "")
        if LOCK_MARKER in t:
            return _result(scalar=True)
        if UPDATE_MARKER in t:
            state["update_attempts"] += 1
            if state["update_attempts"] == 1:
                raise _transient_error()
            return _result(first=(7, "22222222-2222-2222-2222-222222222222"))
        return _result()

    engine, _ = _scripted_engine(execute)

    with patch("jobs.tenant_manager.operations.encryption.time.sleep") as mock_sleep:
        outcome = _call_run_one_batch(engine)

    assert outcome.contended is False
    assert outcome.error is None
    assert outcome.updated_rows == 7
    assert engine.begin.call_count == 2  # one failed attempt + one success
    assert mock_sleep.call_count == 1  # backoff slept once before the retry


def test_run_one_batch_transient_error_exhausts_retries() -> None:
    """Every attempt hits a transient error -> outcome carries the last error,
    after exactly BATCH_RETRY_MAX_ATTEMPTS attempts."""

    def execute(stmt, params=None):
        t = getattr(stmt, "text", "")
        if LOCK_MARKER in t:
            return _result(scalar=True)
        if UPDATE_MARKER in t:
            raise _transient_error()
        return _result()

    engine, _ = _scripted_engine(execute)

    with patch("jobs.tenant_manager.operations.encryption.time.sleep") as mock_sleep:
        outcome = _call_run_one_batch(engine)

    assert outcome.contended is False
    assert outcome.updated_rows == 0
    assert isinstance(outcome.error, OperationalError)
    assert engine.begin.call_count == BATCH_RETRY_MAX_ATTEMPTS
    # Slept before every retry but not after the final failed attempt.
    assert mock_sleep.call_count == BATCH_RETRY_MAX_ATTEMPTS - 1


def test_run_one_batch_non_transient_error_is_not_retried() -> None:
    """A non-transient error returns immediately, with no retry and no sleep."""

    def execute(stmt, params=None):
        t = getattr(stmt, "text", "")
        if LOCK_MARKER in t:
            return _result(scalar=True)
        if UPDATE_MARKER in t:
            raise RuntimeError("relation does not exist")
        return _result()

    engine, _ = _scripted_engine(execute)

    with patch("jobs.tenant_manager.operations.encryption.time.sleep") as mock_sleep:
        outcome = _call_run_one_batch(engine)

    assert outcome.contended is False
    assert outcome.updated_rows == 0
    assert isinstance(outcome.error, RuntimeError)
    assert engine.begin.call_count == 1  # no retry
    assert mock_sleep.call_count == 0


# --------------------------------------------------------------------------
# process_table_data_batch — loop + error handling
# --------------------------------------------------------------------------


@pytest.fixture
def chat_message_target() -> EncryptionTarget:
    return next(t for t in ENCRYPTION_TARGETS if t.table == "chatMessage")


def _process_engine(batch_execute_fn, total_rows: int = 10, remaining_after_job: int | None = None) -> MagicMock:
    """Engine for process_table_data_batch: connect() answers the pk-type and
    COUNT(*) probes, begin() answers each batch transaction via batch_execute_fn."""
    engine = MagicMock()

    def connect_execute(stmt, params=None):
        t = getattr(stmt, "text", "")
        if "information_schema.columns" in t:
            return _result(scalar="uuid")
        if "LIMIT 1" in t and "count" not in t.lower():
            return _result(scalar=remaining_after_job)
        return _result(scalar=total_rows)

    count_conn = MagicMock()
    count_conn.execute.side_effect = connect_execute
    count_conn.__enter__ = MagicMock(return_value=count_conn)
    count_conn.__exit__ = MagicMock(return_value=False)
    engine.connect.return_value = count_conn

    batch_conn = MagicMock()
    batch_conn.execute.side_effect = batch_execute_fn
    engine.begin.return_value.__enter__.return_value = batch_conn
    engine.begin.return_value.__exit__ = MagicMock(return_value=False)
    return engine


def _run_process(engine, target: EncryptionTarget):
    encryption_service = MagicMock()
    encryption_service.derive_org_key.return_value = "derived-key"
    with (
        patch("jobs.tenant_manager.operations.encryption.table_exists", return_value=True),
        patch("jobs.tenant_manager.operations.encryption.get_pk_or_unique_columns", return_value=["id"]),
        patch("jobs.tenant_manager.operations.encryption.time.sleep"),
    ):
        return process_table_data_batch(
            engine=engine,
            schema="org_test",
            org_id="00000000-0000-0000-0000-000000000001",
            target=target,
            encryption_service=encryption_service,
            batch_size=100,
            dry_run=False,
            config=build_encrypt_config(target, "org_test"),
        )


def test_process_table_data_batch_fully_contended_reports_locked(chat_message_target: EncryptionTarget) -> None:
    """When the first batch is contended and nothing was processed, the table
    result is error='locked-by-other-worker'."""

    def batch_execute(stmt, params=None):
        # Lock is always denied -> _run_one_batch returns contended immediately.
        return _result(scalar=False)

    result = _run_process(_process_engine(batch_execute), chat_message_target)

    assert result.error == "locked-by-other-worker"
    assert result.processed_count == 0
    assert result.error_count == 0
    assert result.total_rows == 10
    assert result.is_success is False


def test_process_table_data_batch_contended_after_progress_is_not_success(
    chat_message_target: EncryptionTarget,
) -> None:
    """Contention that hits mid-table — after batches have already committed —
    still leaves rows unencrypted, so the table result must be a failure even
    though processed_count > 0. A success signal here would make the job exit 0
    with work remaining."""
    outcomes = [
        _BatchOutcome(updated_rows=100, error=None, contended=False, last_id="aaaa0001-0000-0000-0000-000000000000"),
        _BatchOutcome(updated_rows=100, error=None, contended=False, last_id="aaaa0002-0000-0000-0000-000000000000"),
        _BatchOutcome(updated_rows=100, error=None, contended=False, last_id="aaaa0003-0000-0000-0000-000000000000"),
        _BatchOutcome(updated_rows=0, error=None, contended=True),
    ]

    engine = _process_engine(lambda *a, **k: _result(), total_rows=1000)

    with patch(
        "jobs.tenant_manager.operations.encryption._run_one_batch",
        side_effect=outcomes,
    ):
        result = _run_process(engine, chat_message_target)

    assert result.error == "locked-by-other-worker"
    assert result.processed_count == 300
    assert result.total_rows == 1000
    assert result.is_success is False


def test_process_table_data_batch_surfaces_exhausted_retry_error(chat_message_target: EncryptionTarget) -> None:
    """A batch whose retries are exhausted surfaces as a populated error with
    error_count incremented, and the loop stops."""

    def batch_execute(stmt, params=None):
        t = getattr(stmt, "text", "")
        if LOCK_MARKER in t:
            return _result(scalar=True)
        if "UPDATE " in t:
            raise _transient_error()
        return _result()  # SET org key

    result = _run_process(_process_engine(batch_execute), chat_message_target)

    assert result.error is not None
    assert "connection reset by peer" in result.error
    assert result.error_count == 1
    assert result.processed_count == 0
    assert result.total_rows == 10
    assert result.is_success is False


def test_process_table_data_batch_keyset_advances_last_id_until_exhausted(
    chat_message_target: EncryptionTarget,
) -> None:
    """Keyset walks last_id forward and stops when the cursor yields no rows."""
    keyset_outcomes = [
        _BatchOutcome(updated_rows=100, error=None, contended=False, last_id="aaaa0001-0000-0000-0000-000000000000"),
        _BatchOutcome(updated_rows=100, error=None, contended=False, last_id="aaaa0002-0000-0000-0000-000000000000"),
        _BatchOutcome(updated_rows=0, error=None, contended=False, last_id=None),
    ]
    sweep_outcome = _BatchOutcome(updated_rows=0, error=None, contended=False, last_id=None)

    seen_last_ids: list[object] = []

    def fake_run_one_batch(*, params, **kwargs):
        seen_last_ids.append(params.get("last_id"))
        if "last_id" in params:
            return keyset_outcomes.pop(0)
        return sweep_outcome

    engine = _process_engine(lambda *a, **k: _result(), total_rows=200)

    with patch(
        "jobs.tenant_manager.operations.encryption._run_one_batch",
        side_effect=fake_run_one_batch,
    ):
        result = _run_process(engine, chat_message_target)

    assert seen_last_ids[0] == "00000000-0000-0000-0000-000000000000"
    assert seen_last_ids[1] == "aaaa0001-0000-0000-0000-000000000000"
    assert seen_last_ids[2] == "aaaa0002-0000-0000-0000-000000000000"
    assert result.is_success is True
    assert result.processed_count == 200


def test_process_table_data_batch_keyset_advances_past_fully_locked_window(
    chat_message_target: EncryptionTarget,
) -> None:
    """Locked window (updated_rows=0, last_id non-null) must advance cursor,
    not terminate the keyset pass."""
    outcomes = [
        _BatchOutcome(updated_rows=100, error=None, contended=False, last_id="aaaa0001-0000-0000-0000-000000000000"),
        _BatchOutcome(updated_rows=0, error=None, contended=False, last_id="aaaa0002-0000-0000-0000-000000000000"),
        _BatchOutcome(updated_rows=50, error=None, contended=False, last_id="aaaa0003-0000-0000-0000-000000000000"),
        _BatchOutcome(updated_rows=0, error=None, contended=False, last_id=None),
        _BatchOutcome(updated_rows=0, error=None, contended=False, last_id=None),
    ]

    seen_last_ids: list[object] = []

    def fake_run_one_batch(*, params, **kwargs):
        seen_last_ids.append(params.get("last_id"))
        return outcomes.pop(0)

    engine = _process_engine(lambda *a, **k: _result(), total_rows=250)

    with patch(
        "jobs.tenant_manager.operations.encryption._run_one_batch",
        side_effect=fake_run_one_batch,
    ):
        result = _run_process(engine, chat_message_target)

    assert seen_last_ids[1] == "aaaa0001-0000-0000-0000-000000000000"
    assert seen_last_ids[2] == "aaaa0002-0000-0000-0000-000000000000"
    assert seen_last_ids[3] == "aaaa0003-0000-0000-0000-000000000000"
    assert result.processed_count == 150
    assert result.is_success is True


def test_process_table_data_batch_sweep_mops_up_skipped_rows(
    chat_message_target: EncryptionTarget,
) -> None:
    """Rows the keyset pass skipped via FOR UPDATE SKIP LOCKED are picked up by
    the sweep pass once the holder releases them."""
    calls = {"keyset": 0, "sweep": 0}

    def fake_run_one_batch(*, params, **kwargs):
        if "last_id" in params:
            calls["keyset"] += 1
            return _BatchOutcome(updated_rows=0, error=None, contended=False, last_id=None)
        calls["sweep"] += 1
        if calls["sweep"] == 1:
            return _BatchOutcome(
                updated_rows=3,
                error=None,
                contended=False,
                last_id="bbbb0001-0000-0000-0000-000000000000",
            )
        return _BatchOutcome(updated_rows=0, error=None, contended=False, last_id=None)

    engine = _process_engine(lambda *a, **k: _result(), total_rows=3)

    with patch(
        "jobs.tenant_manager.operations.encryption._run_one_batch",
        side_effect=fake_run_one_batch,
    ):
        result = _run_process(engine, chat_message_target)

    assert calls["keyset"] == 1
    assert calls["sweep"] == 2
    assert result.processed_count == 3
    assert result.is_success is True


def test_process_table_data_batch_rejects_non_uuid_pk(
    chat_message_target: EncryptionTarget,
) -> None:
    """Non-uuid pk must fail loudly before any UPDATE runs."""
    engine = MagicMock()

    def connect_execute(stmt, params=None):
        t = getattr(stmt, "text", "")
        if "information_schema.columns" in t:
            return _result(scalar="bigint")
        return _result(scalar=10)

    conn = MagicMock()
    conn.execute.side_effect = connect_execute
    conn.__enter__ = MagicMock(return_value=conn)
    conn.__exit__ = MagicMock(return_value=False)
    engine.connect.return_value = conn

    encryption_service = MagicMock()
    encryption_service.derive_org_key.return_value = "derived-key"
    with (
        patch("jobs.tenant_manager.operations.encryption.table_exists", return_value=True),
        patch("jobs.tenant_manager.operations.encryption.get_pk_or_unique_columns", return_value=["id"]),
    ):
        result = process_table_data_batch(
            engine=engine,
            schema="org_test",
            org_id="00000000-0000-0000-0000-000000000001",
            target=chat_message_target,
            encryption_service=encryption_service,
            batch_size=100,
            dry_run=False,
            config=build_encrypt_config(chat_message_target, "org_test"),
        )

    assert result.is_success is False
    assert result.error is not None
    assert "uuid pk" in result.error
    assert engine.begin.call_count == 0


def test_process_table_data_batch_sweep_exhausted_fails(
    chat_message_target: EncryptionTarget,
) -> None:
    """Sweep that updates rows on every pass without draining must surface as
    a failed result (sweep-exhausted), not silent success."""
    from jobs.tenant_manager.operations.encryption import SWEEP_MAX_PASSES

    def fake_run_one_batch(*, params, **kwargs):
        if "last_id" in params:
            return _BatchOutcome(updated_rows=0, error=None, contended=False, last_id=None)
        return _BatchOutcome(updated_rows=1, error=None, contended=False, last_id="b" * 8 + "-0000-0000-0000-000000000000")

    engine = _process_engine(lambda *a, **k: _result(), total_rows=SWEEP_MAX_PASSES)

    with patch(
        "jobs.tenant_manager.operations.encryption._run_one_batch",
        side_effect=fake_run_one_batch,
    ):
        result = _run_process(engine, chat_message_target)

    assert result.is_success is False
    assert result.error == "sweep-exhausted"
    assert result.processed_count == SWEEP_MAX_PASSES


def test_process_table_data_batch_rows_remaining_after_clean_drain_fails(
    chat_message_target: EncryptionTarget,
) -> None:
    """Job that drains keyset+sweep cleanly but still sees predicate matches in
    the post-run probe must surface rows-remaining, not silent success."""
    def fake_run_one_batch(*, params, **kwargs):
        return _BatchOutcome(updated_rows=0, error=None, contended=False, last_id=None)

    engine = _process_engine(lambda *a, **k: _result(), total_rows=5, remaining_after_job=1)

    with patch(
        "jobs.tenant_manager.operations.encryption._run_one_batch",
        side_effect=fake_run_one_batch,
    ):
        result = _run_process(engine, chat_message_target)

    assert result.is_success is False
    assert result.error == "rows-remaining"
