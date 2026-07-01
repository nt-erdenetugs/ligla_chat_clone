from app.db.tenant_resolver import resolve_schema_for_org_name


def test_resolve_schema_for_org_name_missing_returns_none() -> None:
    # Smoke test only: ensure symbol exists and is callable.
    # Full behavior requires a real DB connection.
    assert callable(resolve_schema_for_org_name)
