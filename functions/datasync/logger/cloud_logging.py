import logging
import sys
import datetime
import json


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
        datetime.datetime.fromtimestamp(record.created, datetime.timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


class CloudLoggingFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": format_timestamp(record),
            "severity": map_to_gcp_severity(record.levelname, record.getMessage()),
            "context": record.name,
            "message": record.getMessage(),
            "labels": {"service": "chat-datasync"},
        }
        return json.dumps(log_record)


def get_cloud_logger(name: str = "cloudLogger"):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)

    formatter = CloudLoggingFormatter()
    handler.setFormatter(formatter)

    logger.addHandler(handler)
    logger.propagate = False

    return logger
