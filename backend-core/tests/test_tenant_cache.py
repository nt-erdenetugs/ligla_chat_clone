from datetime import timedelta

from app.db.tenant_cache import SchemaCache


def test_schema_cache_set_get_roundtrip() -> None:
    cache = SchemaCache(ttl=timedelta(minutes=5))
    cache.set("name:acme", "org_acme")
    assert cache.get("name:acme") == "org_acme"


def test_schema_cache_expires_entries() -> None:
    cache = SchemaCache(ttl=timedelta(seconds=0))
    cache.set("id:123", "org_123")
    # With TTL=0, entry should be treated as expired immediately.
    assert cache.get("id:123") is None


def test_schema_cache_separates_name_and_id_namespaces() -> None:
    cache = SchemaCache(ttl=timedelta(minutes=5))
    cache.set("name:foo", "org_foo")
    cache.set("id:foo", "org_id_foo")

    assert cache.get("name:foo") == "org_foo"
    assert cache.get("id:foo") == "org_id_foo"
