from __future__ import annotations

from datetime import datetime, timedelta

CACHE_TTL = timedelta(minutes=5)


class SchemaCache:
    def __init__(self, ttl: timedelta = CACHE_TTL):
        self._cache: dict[str, tuple[str | None, datetime]] = {}
        self._ttl = ttl

    def get(self, key: str) -> str | None:
        if key in self._cache:
            schema, cached_at = self._cache[key]
            if datetime.now() - cached_at < self._ttl:
                return schema
            del self._cache[key]
        return None

    def set(self, key: str, value: str | None) -> None:
        self._cache[key] = (value, datetime.now())

    def invalidate(self, key: str) -> None:
        self._cache.pop(key, None)

    def clear(self) -> None:
        self._cache.clear()


schema_cache = SchemaCache()
