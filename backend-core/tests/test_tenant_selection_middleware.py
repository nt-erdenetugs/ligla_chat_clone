import asyncio
import json

from app.common.tenant_middleware import TenantSelectionMiddleware


class _FakeURL:
    def __init__(self, path: str) -> None:
        self.path = path


class _FakeState:
    pass


class _FakeRequest:
    def __init__(self, *, path: str, method: str, body: bytes, headers: dict[str, str] | None = None) -> None:
        self.url = _FakeURL(path)
        self.method = method
        self.state = _FakeState()
        self.headers = headers or {}
        self._body = body

        async def _receive() -> dict[str, object]:
            return {"type": "http.request", "body": self._body, "more_body": False}

        self._receive = _receive  # type: ignore[assignment]

    async def body(self) -> bytes:
        return self._body


def _patch_resolver(monkeypatch, resolve_fn):
    monkeypatch.setattr("app.db.tenant_resolver.resolve_schema_for_org_name", resolve_fn)
    monkeypatch.setattr("app.db.schema_manager.validate_schema_name", lambda _name: None)
    monkeypatch.setattr("app.db.tenant_context.set_context_from_schema", lambda _schema: None)
    monkeypatch.setattr("app.common.tenant_middleware.schema_cache", None)


def test_sets_tenant_schema_from_client_name(monkeypatch) -> None:
    _patch_resolver(monkeypatch, lambda org: f"org_for_{org}")

    mw = TenantSelectionMiddleware(app=None)  # type: ignore[arg-type]

    payload = {"clientName": "ligla_chat"}
    req = _FakeRequest(path="/api/v1/receive/new-message-handler", method="POST", body=json.dumps(payload).encode())

    async def call_next(request):  # type: ignore[no-untyped-def]
        assert getattr(request.state, "tenant_schema", None) == "org_for_ligla_chat"
        return "ok"

    result = asyncio.run(mw.dispatch(req, call_next))
    assert result == "ok"


def test_preserves_body_for_downstream(monkeypatch) -> None:
    _patch_resolver(monkeypatch, lambda _org: None)

    mw = TenantSelectionMiddleware(app=None)  # type: ignore[arg-type]

    raw = b'{"clientName":"ligla_chat","x":1}'
    req = _FakeRequest(path="/api/v1/receive/new-message-handler", method="POST", body=raw)

    async def call_next(request):  # type: ignore[no-untyped-def]
        body = await request.body()
        assert body == raw
        return "ok"

    result = asyncio.run(mw.dispatch(req, call_next))
    assert result == "ok"


def test_noop_for_other_paths(monkeypatch) -> None:
    _patch_resolver(monkeypatch, lambda org: f"org_for_{org}")

    mw = TenantSelectionMiddleware(app=None)  # type: ignore[arg-type]

    req = _FakeRequest(path="/api/v1/health", method="POST", body=b'{"clientName":"ligla_chat"}')

    async def call_next(request):  # type: ignore[no-untyped-def]
        assert getattr(request.state, "tenant_schema", None) is None
        return "ok"

    assert asyncio.run(mw.dispatch(req, call_next)) == "ok"


def test_does_not_override_existing_tenant_schema(monkeypatch) -> None:
    _patch_resolver(monkeypatch, lambda org: f"org_for_{org}")

    mw = TenantSelectionMiddleware(app=None)  # type: ignore[arg-type]
    req = _FakeRequest(path="/api/v1/receive/new-message-handler", method="POST", body=b"{}")
    req.state.tenant_schema = "org_upstream"

    async def call_next(request):  # type: ignore[no-untyped-def]
        assert getattr(request.state, "tenant_schema", None) == "org_upstream"
        return "ok"

    assert asyncio.run(mw.dispatch(req, call_next)) == "ok"
