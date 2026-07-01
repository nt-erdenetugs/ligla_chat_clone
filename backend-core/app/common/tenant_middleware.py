import json
import logging
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.db.schema_manager import validate_schema_name
from app.db.tenant_cache import schema_cache
from app.db.tenant_context import clear_tenant_schema, set_context_from_schema, set_tenant_context
from app.db.tenant_resolver import resolve_schema_for_org_name

logger = logging.getLogger(__name__)

RECEIVER_ENDPOINT_PATH = "/receive/new-message-handler"


class TenantSelectionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if getattr(request.state, "tenant_schema", None):
            return await call_next(request)

        schema: str | None = None
        try:
            is_receiver_endpoint = (
                request.url.path.endswith(RECEIVER_ENDPOINT_PATH) and request.method.upper() == "POST"
            )
            if is_receiver_endpoint:
                body_bytes, payload = await self._read_json_body(request)
                if body_bytes:
                    org_name_payload = self._extract_payload_org_name(payload)
                    if org_name_payload:
                        schema = self._resolve_schema(org_name_payload)

                    self._reinject_body(request, body_bytes)

            if schema:
                request.state.tenant_schema = schema
                self._set_tenant_context(schema)

        except Exception as e:  # noqa: BLE001
            logger.warning("Tenant selection failed; continuing without tenant routing", extra={"error": str(e)})

        try:
            return await call_next(request)
        finally:
            if schema:
                self._clear_tenant_context()

    @staticmethod
    def _extract_payload_org_name(payload: object) -> str | None:
        if not isinstance(payload, dict):
            return None

        payload_dict: dict[str, object] = payload
        client_name = payload_dict.get("clientName")
        organization_name = payload_dict.get("organizationName")
        org_name = client_name or organization_name

        if not isinstance(org_name, str):
            return None
        org_name = org_name.strip()
        return org_name if org_name else None

    @staticmethod
    async def _read_json_body(request: Request) -> tuple[bytes, object | None]:
        body_bytes = await request.body()
        if not body_bytes:
            return b"", None

        try:
            payload = json.loads(body_bytes)
        except (ValueError, UnicodeDecodeError):
            payload = None

        return body_bytes, payload

    @staticmethod
    def _reinject_body(request: Request, body_bytes: bytes) -> None:
        async def receive() -> dict[str, object]:
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        request._receive = receive  # type: ignore[attr-defined]

    @staticmethod
    def _resolve_schema(org_identifier: str | uuid.UUID) -> str | None:
        cache_key = f"name:{org_identifier}"

        if schema_cache:
            cached = schema_cache.get(cache_key)
            if cached:
                return cached

        try:
            schema = resolve_schema_for_org_name(str(org_identifier))

            if isinstance(schema, str) and schema:
                validate_schema_name(schema)

                if schema_cache:
                    schema_cache.set(cache_key, schema)
                return schema
        except Exception as e:
            logger.warning(f"Error resolving schema for org {org_identifier}: {e}")

        return None

    @staticmethod
    def _set_tenant_context(schema: str) -> None:
        try:
            set_context_from_schema(schema)
        except Exception as e:
            logger.warning(f"Failed to set tenant context from schema {schema}: {e}")

    @staticmethod
    def _clear_tenant_context() -> None:
        set_tenant_context(None)
        clear_tenant_schema()
