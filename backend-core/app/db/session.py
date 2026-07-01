from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import URL
from sqlalchemy.orm import Session, sessionmaker

from app.common.errors.tenant import TenantContextRequiredError
from app.config.settings import AppENV, settings
from app.db.base_class import SCHEMA_TOKEN_TENANT
from app.db.tenant_context import get_tenant_schema

_DEFAULT_EXECUTION_OPTIONS = {
    "schema_translate_map": {
        None: "public",
        SCHEMA_TOKEN_TENANT: "__unresolved_tenant__",
    }
}

_DEFAULT_POOL_CONFIG: dict[str, int | bool] = {
    "pool_size": 5,
    "max_overflow": 2,
    "pool_timeout": 30,
    "pool_recycle": 1800,
    "pool_pre_ping": True,
}


def _create_engine(pool_config: dict[str, int | bool] | None = None) -> Engine:
    config = pool_config or _DEFAULT_POOL_CONFIG

    if settings.ENV in [AppENV.PRD, AppENV.STG]:
        url = URL.create(
            drivername="postgresql+psycopg2",
            username=settings.DB_USER,
            password=settings.DB_PASS,
            database=settings.DB_NAME,
            query={"host": f"/cloudsql/{settings.CLOUD_SQL_CONNECTION_NAME}"},
        )
    else:
        url = URL.create(
            drivername="postgresql+psycopg2",
            username=settings.DB_USER,
            password=settings.DB_PASS,
            host=settings.DB_HOST,
            port=int(settings.DB_PORT),
            database=settings.DB_NAME,
        )

    return create_engine(url, execution_options=_DEFAULT_EXECUTION_OPTIONS, **config)


_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = _create_engine()
    return _engine


def get_engine_for_parallel_operations() -> Engine:
    # Sized for the tenant_manager jobs: each worker thread uses ~1 connection at a
    # time (its per-batch transaction). Kept small so a job cannot exhaust the
    # Cloud SQL connection ceiling while the live services hold their own pools.
    return _create_engine(
        {
            "pool_size": 4,
            "max_overflow": 2,
            "pool_timeout": 30,
            "pool_recycle": 1800,
            "pool_pre_ping": True,
        }
    )


def dispose_engine() -> None:
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None


def get_sessionmaker() -> sessionmaker[Session]:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


def get_sessionmaker_for_current_tenant() -> sessionmaker[Session]:
    schema = get_tenant_schema()
    if not schema:
        raise TenantContextRequiredError()

    schema_translate_map: dict[str | None, str] = {SCHEMA_TOKEN_TENANT: schema, None: "public"}
    tenant_engine = get_engine().execution_options(schema_translate_map=schema_translate_map)
    return sessionmaker(autocommit=False, autoflush=False, bind=tenant_engine)
