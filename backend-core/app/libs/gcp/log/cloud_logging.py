import datetime
import logging
import sys

from pythonjsonlogger import jsonlogger

from app.config.settings import AppENV, settings


def map_to_gcp_severity(level: str, message: str = "") -> str:
    normalized = level.lower()
    message = message.lower()

    level_map = {
        "silly": "DEBUG",
        "debug": "DEBUG",
        "verbose": "DEBUG",
        "info": "INFO",
        "warning": "WARNING",
        "warn": "WARNING",
        "error": "ERROR",
        "critical": "CRITICAL",
    }

    if "alert" in message:
        return "ALERT"
    if "emergency" in message:
        return "EMERGENCY"

    return level_map.get(normalized, "DEFAULT")


def format_timestamp(record):
    return (
        datetime.datetime.fromtimestamp(record.created, datetime.UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


class CloudLoggingFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)

        log_record["timestamp"] = format_timestamp(record)
        log_record["severity"] = map_to_gcp_severity(record.levelname, record.getMessage())
        log_record["context"] = record.name
        log_record["message"] = record.getMessage()

        if settings.ENV != AppENV.LOCAL:
            log_record["labels"] = {"service": "chat-core"}


def get_cloud_logger(name: str = "cloudLogger"):
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG if settings.ENV == AppENV.LOCAL else logging.INFO)

    handler = logging.StreamHandler(sys.stdout)

    formatter = CloudLoggingFormatter(fmt="%(timestamp)s %(severity)s %(context)s %(message)s")
    handler.setFormatter(formatter)

    logger.addHandler(handler)
    logger.propagate = False

    return logger
