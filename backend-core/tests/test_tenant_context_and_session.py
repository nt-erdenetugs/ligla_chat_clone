import pytest

from app.db.session import get_sessionmaker_for_current_tenant
from app.db.tenant_context import get_tenant_schema, set_tenant_schema


def test_tenant_context_roundtrip() -> None:
    set_tenant_schema(None)
    assert get_tenant_schema() is None

    set_tenant_schema("org_abc")
    assert get_tenant_schema() == "org_abc"


def test_sessionmaker_switches_when_schema_set() -> None:
    pytest.importorskip("psycopg2")

    set_tenant_schema("org_test1")
    sm1 = get_sessionmaker_for_current_tenant()

    set_tenant_schema("org_test2")
    sm2 = get_sessionmaker_for_current_tenant()

    assert sm1 is not sm2
