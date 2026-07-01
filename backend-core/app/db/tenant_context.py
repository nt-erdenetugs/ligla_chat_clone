from __future__ import annotations

import functools
import inspect
import uuid
from collections.abc import Callable, Generator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text

from app.common.utils import uuid_to_schema_name


@dataclass(frozen=True)
class TenantContext:
    organization_id: uuid.UUID | None
    organization_name: str
    schema_name: str


_tenant_context: ContextVar[TenantContext | None] = ContextVar("tenant_context", default=None)
_tenant_schema: ContextVar[str | None] = ContextVar("tenant_schema", default=None)


def set_tenant_context(context: TenantContext | None) -> None:
    _tenant_context.set(context)
    if context:
        set_tenant_schema(context.schema_name)
    else:
        set_tenant_schema(None)


def get_tenant_context() -> TenantContext | None:
    return _tenant_context.get()


def set_tenant_schema(schema: str | None) -> None:
    _tenant_schema.set(schema)


def get_tenant_schema() -> str | None:
    return _tenant_schema.get()


def clear_tenant_schema() -> None:
    _tenant_schema.set(None)


def _derive_org_id_from_schema(schema_name: str) -> uuid.UUID | None:
    if not schema_name or not schema_name.startswith("org_"):
        return None

    try:
        # Extract UUID hex string (32 chars after "org_")
        uuid_hex = schema_name[4:]  # Remove "org_" prefix
        if len(uuid_hex) != 32:
            return None

        # Insert dashes: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        uuid_str = f"{uuid_hex[:8]}-{uuid_hex[8:12]}-{uuid_hex[12:16]}-{uuid_hex[16:20]}-{uuid_hex[20:]}"
        return uuid.UUID(uuid_str)
    except (ValueError, AttributeError):
        return None


def _resolve_org_from_db(
    actual_org_id: str | uuid.UUID | None,
    actual_org_name: str | None,
    schema_name: str | None = None,
) -> tuple[str, uuid.UUID | None, str | None]:
    from app.db.session import get_sessionmaker

    # If schema is provided, derive org_id from it
    if schema_name and not actual_org_id:
        actual_org_id = _derive_org_id_from_schema(schema_name)

    SessionLocal = get_sessionmaker()
    with SessionLocal() as session:
        if actual_org_id:
            result = session.execute(
                text("SELECT id, name FROM public.organization WHERE id = :org_id"), {"org_id": actual_org_id}
            )
        elif actual_org_name:
            result = session.execute(
                text("SELECT id, name FROM public.organization WHERE name = :org_name"), {"org_name": actual_org_name}
            )
        else:
            raise ValueError("Must provide organization_id, organization_name, or schema_name")

        row = result.fetchone()

        if row:
            resolved_schema = uuid_to_schema_name(row.id)
            return resolved_schema, row.id, row.name
        else:
            raise ValueError(f"Organization not found: {actual_org_id or actual_org_name}")


def _build_tenant_context(
    actual_org_id: str | uuid.UUID | None,
    actual_org_name: str | None,
    resolved_schema: str,
) -> TenantContext:
    org_id_uuid = actual_org_id if isinstance(actual_org_id, uuid.UUID) else None
    return TenantContext(
        organization_id=org_id_uuid,
        organization_name=actual_org_name or "",
        schema_name=resolved_schema,
    )


def _resolve_context_from_schema(schema: str) -> TenantContext:
    org_id = _derive_org_id_from_schema(schema)
    actual_org_id: uuid.UUID | None = None
    actual_org_name: str | None = None
    if org_id:
        _, actual_org_id, actual_org_name = _resolve_org_from_db(org_id, None, schema_name=schema)
    return _build_tenant_context(actual_org_id, actual_org_name, schema)


def set_context_from_schema(schema: str) -> None:
    context = _resolve_context_from_schema(schema)
    set_tenant_context(context)


@contextmanager
def tenant_context_scope(
    organization_id: str | uuid.UUID | None = None,
    organization_name: str | None = None,
    schema_name: str | None = None,
) -> Generator[TenantContext]:
    if schema_name and not organization_id and not organization_name:
        context = _resolve_context_from_schema(schema_name)
        resolved_schema = schema_name
    else:
        resolved_schema, actual_org_id, actual_org_name = _resolve_org_from_db(
            organization_id, organization_name, schema_name=schema_name
        )
        context = _build_tenant_context(actual_org_id, actual_org_name, resolved_schema)
    token = _tenant_context.set(context)
    schema_token = _tenant_schema.set(resolved_schema)
    try:
        yield context
    finally:
        _tenant_context.reset(token)
        _tenant_schema.reset(schema_token)


def _resolve_tenant_for_decorator(
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    organization_id: str | uuid.UUID | Callable[..., str | uuid.UUID | None] | None,
    organization_name: str | Callable[..., str | None] | None,
    schema_name: str | Callable[..., str | None] | None,
) -> tuple[TenantContext, str]:
    existing_context = get_tenant_context()

    if existing_context and existing_context.schema_name:
        resolved_schema = existing_context.schema_name
        actual_org_id = existing_context.organization_id
        actual_org_name = existing_context.organization_name
    else:
        resolved_schema = schema_name(*args, **kwargs) if callable(schema_name) else schema_name
        actual_org_id = organization_id(*args, **kwargs) if callable(organization_id) else organization_id
        actual_org_name = organization_name(*args, **kwargs) if callable(organization_name) else organization_name

        if not resolved_schema:
            resolved_schema, actual_org_id, actual_org_name = _resolve_org_from_db(
                actual_org_id, actual_org_name, schema_name=None
            )
        elif not actual_org_id and not actual_org_name:
            _, actual_org_id, actual_org_name = _resolve_org_from_db(None, None, schema_name=resolved_schema)

    if not resolved_schema:
        raise ValueError("Schema name must be resolved")

    context = _build_tenant_context(actual_org_id, actual_org_name, resolved_schema)
    return context, resolved_schema


def with_tenant_context(
    organization_id: str | uuid.UUID | Callable[..., str | uuid.UUID | None] | None = None,
    organization_name: str | Callable[..., str | None] | None = None,
    schema_name: str | Callable[..., str | None] | None = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            context, resolved_schema = _resolve_tenant_for_decorator(
                args, kwargs, organization_id, organization_name, schema_name
            )
            token = _tenant_context.set(context)
            schema_token = _tenant_schema.set(resolved_schema)
            try:
                return await func(*args, **kwargs)
            finally:
                _tenant_context.reset(token)
                _tenant_schema.reset(schema_token)

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            context, resolved_schema = _resolve_tenant_for_decorator(
                args, kwargs, organization_id, organization_name, schema_name
            )
            token = _tenant_context.set(context)
            schema_token = _tenant_schema.set(resolved_schema)
            try:
                return func(*args, **kwargs)
            finally:
                _tenant_context.reset(token)
                _tenant_schema.reset(schema_token)

        if inspect.iscoroutinefunction(func):
            return async_wrapper  # type: ignore
        return sync_wrapper  # type: ignore

    return decorator


def is_tenant_routed() -> bool:
    return bool(get_tenant_schema())


def should_apply_organization_filter() -> bool:
    return not is_tenant_routed()
