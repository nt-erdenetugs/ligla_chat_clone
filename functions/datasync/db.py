import logging
import re
from contextlib import contextmanager
from typing import Generator

from config import AppENV, settings
from sqlalchemy import MetaData, create_engine, text
from sqlalchemy.engine.url import URL
from sqlalchemy.orm import Session, scoped_session, sessionmaker

logger = logging.getLogger(__name__)

_VALID_SCHEMA_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

engine = None
metadata = None
SessionLocal = None


def init_connection_engine():
    db_config = {
        "pool_size": 5,
        "max_overflow": 2,
        "pool_timeout": 30,  # 30 seconds
        "pool_recycle": 1800,  # 30 minutes
        "pool_pre_ping": True,
    }

    if settings.ENV in (AppENV.PRD, AppENV.STG):
        return init_unix_connection_engine(db_config)
    return init_tcp_connection_engine(db_config)


def init_tcp_connection_engine(db_config: dict[str, int | bool]):
    pool = create_engine(
        URL.create(
            drivername="postgresql",
            username=settings.DB_USER,
            password=settings.DB_PASS,
            host=settings.DB_HOST,
            port=int(settings.DB_PORT),
            database=settings.DB_NAME,
        ),
        **db_config,
    )
    pool.dialect.description_encoding = None
    return pool


def init_unix_connection_engine(db_config: dict[str, int | bool]):
    try:
        pool = create_engine(
            URL.create(
                drivername="postgresql",
                username=settings.DB_USER,
                password=settings.DB_PASS,
                database=settings.DB_NAME,
                query={"host": f"/cloudsql/{settings.CLOUD_SQL_CONNECTION_NAME}"},
            ),
            **db_config,
        )
        pool.dialect.description_encoding = None
        return pool
    except Exception as e:
        logger.warning(f"Could not initialize Unix socket connection: {e}")
        return None


def get_db_session():
    """Return lazy-initialized scoped_session."""
    global engine, metadata, SessionLocal
    if SessionLocal is None:
        engine = init_connection_engine()
        if engine is None:
            raise ConnectionError("Failed to initialize database engine")

        metadata = MetaData()
        try:
            metadata.reflect(bind=engine)
        except Exception as e:
            logger.warning(f"Metadata reflection skipped: {e}")

        SessionLocal = scoped_session(
            sessionmaker(autocommit=False, autoflush=False, bind=engine)
        )
    return SessionLocal, metadata, engine


@contextmanager
def get_tenant_db_session(schema_name: str) -> Generator[Session, None, None]:
    SessionLocal, _, _ = get_db_session()
    session = SessionLocal()

    try:
        if not _VALID_SCHEMA_RE.match(schema_name):
            raise ValueError(f"Invalid schema name: {schema_name}")
        exists = session.execute(
            text("SELECT 1 FROM information_schema.schemata WHERE schema_name = :s"),
            {"s": schema_name},
        ).scalar()
        if not exists:
            raise ValueError(f"Tenant schema does not exist: {schema_name}")
        session.execute(text(f'SET search_path TO "{schema_name}", public'))
        logger.debug(f"Tenant session created. Schema: {schema_name}")

        yield session

        session.commit()
    except Exception as e:
        logger.error(f"Tenant database session error (schema={schema_name}): {e}")
        session.rollback()
        raise
    finally:
        try:
            session.execute(text("SET search_path TO public"))
        except Exception:
            pass  # Session may already be closed
        SessionLocal.remove()
        logger.debug(f"Tenant session closed. Schema: {schema_name}")
