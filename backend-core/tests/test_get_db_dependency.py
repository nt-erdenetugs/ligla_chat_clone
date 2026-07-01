from types import SimpleNamespace

import pytest

from app.common.dependencies import get_db
from app.db.tenant_context import set_tenant_schema


class _FakeRequest:
    def __init__(self) -> None:
        self.state = SimpleNamespace()


def test_get_db_uses_request_state_when_present() -> None:
    req = _FakeRequest()
    sentinel = object()
    req.state.db = sentinel

    gen = get_db(req)
    assert next(gen) is sentinel

    # dependency should finish cleanly
    try:
        next(gen)
        raise AssertionError("Expected StopIteration")
    except StopIteration:
        pass


def test_get_db_yields_session_when_no_request_state_db() -> None:
    pytest.importorskip("psycopg2")

    req = _FakeRequest()

    # ensure tenant context doesn't crash the dependency
    set_tenant_schema("org_abc")

    gen = get_db(req)
    db = next(gen)

    # We avoid importing SQLAlchemy Session type here; just assert it has close()
    assert hasattr(db, "close")

    # closing should happen on generator finalization
    try:
        next(gen)
        raise AssertionError("Expected StopIteration")
    except StopIteration:
        pass
