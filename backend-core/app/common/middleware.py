from collections.abc import Awaitable, Callable
from typing import override

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.common.tenant_middleware import RECEIVER_ENDPOINT_PATH
from app.db.session import get_sessionmaker, get_sessionmaker_for_current_tenant
from app.db.tenant_context import set_tenant_schema


class DBSessionMiddleware(BaseHTTPMiddleware):
    @override
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        schema = getattr(request.state, "tenant_schema", None)
        set_tenant_schema(schema)

        # Receiver handler creates its own tenant-scoped session — skip middleware session
        if request.url.path.endswith(RECEIVER_ENDPOINT_PATH):
            try:
                return await call_next(request)
            finally:
                set_tenant_schema(None)

        SessionMaker = get_sessionmaker_for_current_tenant() if schema else get_sessionmaker()
        request.state.db = SessionMaker()
        try:
            response = await call_next(request)
        finally:
            db = getattr(request.state, "db", None)
            if db:
                db.close()
            set_tenant_schema(None)
        return response
