import select
import threading
import time
from collections.abc import Callable
from typing import Any, cast

from psycopg2 import Error, connect
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

from app.common.utils import get_logger
from app.config.settings import settings

logger = get_logger(__name__)

# Constants
DEFAULT_LISTEN_TIMEOUT_SECONDS = 5.0
SUPERVISOR_CHECK_INTERVAL_SECONDS = 10
WORKER_SHUTDOWN_TIMEOUT_SECONDS = 5.0


def start_listener(
    channel: str,
    callback: Callable[[str, str], None],
    timeout: float = DEFAULT_LISTEN_TIMEOUT_SECONDS,
) -> tuple[threading.Thread, threading.Event]:
    dsn = _build_database_dsn()
    supervisor_stop_event = threading.Event()
    worker_args = (dsn, channel, callback, None, timeout)

    supervisor_thread = threading.Thread(
        target=_supervisor_loop,
        args=(supervisor_stop_event, _listen_loop, worker_args),
        name=f"pg-listener-supervisor-{channel}",
        daemon=False,
    )
    supervisor_thread.start()

    logger.info(
        "PostgreSQL listener started",
        extra={
            "channel": channel,
            "timeout": timeout,
        },
    )

    return supervisor_thread, supervisor_stop_event


def _listen_loop(
    dsn: str,
    channel: str,
    callback: Callable[[str, str], None],
    stop_event: threading.Event,
    timeout: float = DEFAULT_LISTEN_TIMEOUT_SECONDS,
) -> None:
    connection = None
    cursor = None

    try:
        connection = connect(dsn)
        connection.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = connection.cursor()

        channel_lower = channel.lower()
        cursor.execute(f'LISTEN "{channel_lower}"')
        logger.info("Worker started listening on PostgreSQL channel", extra={"channel": channel_lower})

        while not stop_event.is_set():
            if select.select([connection], [], [], timeout) == ([], [], []):
                continue

            _ = connection.poll()
            while connection.notifies:
                notify = connection.notifies.pop(0)
                try:
                    callback(
                        cast(str, notify.channel),
                        cast(str, notify.payload),
                    )
                except Exception as callback_error:
                    logger.exception(
                        "Error in pg_listener callback",
                        extra={
                            "channel": channel,
                            "error_type": type(callback_error).__name__,
                        },
                    )

    except Error as db_error:
        logger.exception(
            "Database connection error in worker thread",
            extra={
                "channel": channel,
                "error_type": type(db_error).__name__,
            },
        )
    except Exception as unexpected_error:
        logger.exception(
            "Unexpected error in worker thread",
            extra={
                "channel": channel,
                "error_type": type(unexpected_error).__name__,
            },
        )
    finally:
        _cleanup_connection(connection, cursor, channel)


def _cleanup_connection(connection: Any | None, cursor: Any | None, channel: str) -> None:
    if cursor is not None:
        try:
            cursor.close()
            logger.debug("Cursor closed successfully", extra={"channel": channel})
        except Exception as cursor_error:
            logger.warning(
                "Failed to close cursor",
                extra={
                    "channel": channel,
                    "error": str(cursor_error),
                },
                exc_info=True,
            )

    if connection is not None:
        try:
            connection.close()
            logger.debug("Connection closed successfully", extra={"channel": channel})
        except Exception as connection_error:
            logger.warning(
                "Failed to close connection",
                extra={
                    "channel": channel,
                    "error": str(connection_error),
                },
                exc_info=True,
            )

    logger.warning("Worker thread stopping", extra={"channel": channel})


def _supervisor_loop(
    supervisor_stop_event: threading.Event,
    worker_func: Callable[..., None],
    worker_args: tuple[Any, ...],
) -> None:
    logger.info("Supervisor thread started")
    worker_thread: threading.Thread | None = None
    worker_stop_event: threading.Event | None = None

    while not supervisor_stop_event.is_set():
        if worker_thread is None or not worker_thread.is_alive():
            if worker_thread is not None:
                logger.error("Worker thread died unexpectedly, restarting")

            logger.info("Supervisor starting new worker thread")
            worker_stop_event = threading.Event()
            new_worker_args = worker_args[:-2] + (worker_stop_event,) + worker_args[-1:]

            worker_thread = threading.Thread(
                target=worker_func,
                args=new_worker_args,
                daemon=True,
            )
            worker_thread.start()

        time.sleep(SUPERVISOR_CHECK_INTERVAL_SECONDS)

    logger.info("Supervisor received stop signal, stopping worker")
    if worker_stop_event:
        worker_stop_event.set()
    if worker_thread and worker_thread.is_alive():
        worker_thread.join(timeout=WORKER_SHUTDOWN_TIMEOUT_SECONDS)
    logger.info("Supervisor shutdown complete")


def _build_database_dsn() -> str:
    return (
        f"dbname={settings.DB_NAME} "
        f"user={settings.DB_USER} "
        f"password={settings.DB_PASS} "
        f"host={settings.DB_HOST} "
        f"port={settings.DB_PORT}"
    )
