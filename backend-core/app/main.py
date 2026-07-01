import logging
import time
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common import dependencies as deps
from app.common.errors import SchemaValidationError
from app.common.middleware import DBSessionMiddleware
from app.common.schemas import HealthCheck
from app.common.tenant_middleware import TenantSelectionMiddleware
from app.config.settings import AppENV, settings
from app.db.session import dispose_engine, get_engine
from app.libs.gcp.log.cloud_logging import get_cloud_logger
from app.services.receiver.helper import messaging
from app.services.router import root_router

logger = get_cloud_logger()

uvicorn_logger = logging.getLogger("uvicorn")
uvicorn_logger.handlers = logger.handlers
uvicorn_logger.setLevel(logger.level)

root_logger = logging.getLogger()
root_logger.handlers = logger.handlers
root_logger.setLevel(logger.level)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FastAPI startup: initializing resources")

    get_engine()

    messaging.initialize_pubsub_resources()

    # TODO: Needs to verify this
    # supervisor_thread, supervisor_stop_evt = start_listener(
    #     settings.DB_SYNC_NOTIFY_CHANNEL,
    #     chat_data_sync.handle_chat_data_sync_notify,
    # )

    # app.state.supervisor_thread = supervisor_thread
    # app.state.supervisor_stop_event = supervisor_stop_evt

    yield

    logger.info("FastAPI shutdown: cleaning up resources")

    dispose_engine()

    # stop_evt = app.state.supervisor_stop_event
    # stop_evt.set()
    # thread = app.state.supervisor_thread
    # thread.join(timeout=10.0)

    logger.info("Lifespan shutdown complete.")


def get_application():
    _debug = settings.ENV == AppENV.LOCAL
    _app = FastAPI(
        debug=_debug,
        title=settings.PROJECT_NAME,
        openapi_url=settings.OPENAPI_URL,
        lifespan=lifespan,
    )
    _app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).strip("/") for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return _app


app = get_application()
app.add_middleware(TenantSelectionMiddleware)
app.add_middleware(DBSessionMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    field_errors: list[str] = []
    for error in exc.errors():
        loc = " -> ".join(str(x) for x in error["loc"][1:])
        msg = error["msg"]
        error_type = error["type"]

        if loc:
            field_errors.append(f"{loc}: {msg} (type={error_type})")
        else:
            field_errors.append(f"{msg} (type={error_type})")

    validation_error = SchemaValidationError(field_errors=field_errors, obj_in=exc.body)
    validation_error.log()

    return JSONResponse(status_code=validation_error.http_status.value, content=validation_error.to_dict())


@app.middleware("http")
async def add_process_time_header(request: Request, call_next: Callable[[Request], Awaitable[Response]]):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


@app.get("/_ah/warmup", status_code=status.HTTP_200_OK)
def warmup(db: Session = Depends(deps.get_db)):
    db.execute(text("SELECT 1"))
    return ""


@app.get("/health")
def health_check():
    return HealthCheck(status="ok")


@app.get("/health/db-pool")
def db_pool_health():
    try:
        engine = get_engine()
        pool = engine.pool
        return pool.status()
    except Exception as e:
        logger.error(f"DB Pool health check failed: {e}")
        return JSONResponse(status_code=500, content={"status": "unhealthy", "error": str(e)})


app.include_router(root_router, prefix=settings.API_V1_STR)
