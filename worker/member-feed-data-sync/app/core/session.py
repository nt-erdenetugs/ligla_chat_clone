import re
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import Connection
from sqlalchemy.pool import QueuePool

from app.core.config import AppENV, settings
from app.core.logger import logger

_VALID_SCHEMA_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


class DatabaseManager:
    def __init__(self):
        self._engine: Engine = None

    def get_engine(self) -> Engine:
        if self._engine is None:
            self._engine = self._create_engine()
        return self._engine

    def _create_engine(self) -> Engine:
        database_url = self._get_database_url()

        engine_config = {
            "pool_pre_ping": True,
            "pool_recycle": 300,
            "poolclass": QueuePool,
            "pool_size": 5,
            "max_overflow": 10,
            "pool_timeout": 30,
            "pool_reset_on_return": "commit",
            "echo": settings.ENV == AppENV.LOCAL,
        }

        logger.info("Creating database engine with production configuration")
        return create_engine(database_url, **engine_config)

    def _get_database_url(self) -> str:
        return settings.get_database_url()


db_manager = DatabaseManager()


def get_engine() -> Engine:
    return db_manager.get_engine()


def _get_pool_status() -> str:
    try:
        engine = db_manager.get_engine()
        pool = engine.pool
        return f"size={pool.size()}, checked_in={pool.checkedin()}, checked_out={pool.checkedout()}, overflow={pool.overflow()}"
    except Exception as e:
        return f"pool_status_error: {e}"


def get_db_connection():
    @contextmanager
    def connection_context():
        engine = get_engine()
        connection = engine.connect()
        transaction = connection.begin()
        try:
            logger.debug(
                f"Database connection created. Pool status: {_get_pool_status()}"
            )
            yield connection
            if transaction.is_active:
                transaction.commit()
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            if transaction.is_active:
                transaction.rollback()
            raise
        finally:
            connection.close()
            logger.debug("Database connection closed and returned to pool")

    return connection_context()


def get_tenant_db_connection(schema_name: str) -> Generator[Connection, None, None]:
    @contextmanager
    def tenant_connection_context():
        engine = get_engine()
        connection = engine.connect()
        transaction = connection.begin()
        try:
            if not _VALID_SCHEMA_RE.match(schema_name):
                raise ValueError(f"Invalid schema name: {schema_name}")
            connection.execute(text(f'SET search_path TO "{schema_name}", public'))
            logger.debug(
                f"Tenant connection created. Schema: {schema_name}, Pool: {_get_pool_status()}"
            )

            yield connection

            if transaction.is_active:
                transaction.commit()
        except Exception as e:
            logger.error(
                f"Tenant database connection error (schema={schema_name}): {e}"
            )
            if transaction.is_active:
                transaction.rollback()
            raise
        finally:
            # Reset search_path to public before returning connection to pool
            try:
                connection.execute(text("SET search_path TO public"))
            except Exception:
                pass  # Connection may already be closed
            connection.close()
            logger.debug(f"Tenant connection closed. Schema: {schema_name}")

    return tenant_connection_context()
