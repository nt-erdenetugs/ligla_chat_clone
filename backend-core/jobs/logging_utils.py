from __future__ import annotations

import logging
import sys


class _MaxLevelFilter(logging.Filter):
    def __init__(self, max_level: int) -> None:
        super().__init__()
        self.max_level = max_level

    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno <= self.max_level


def configure_jobs_logging(level: int = logging.INFO) -> None:
    root_logger = logging.getLogger()

    if getattr(root_logger, "_jobs_logging_configured", False):
        if root_logger.level > level:
            root_logger.setLevel(level)
        return

    root_logger.setLevel(level)

    formatter = logging.Formatter("%(message)s")

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setLevel(level)
    stdout_handler.addFilter(_MaxLevelFilter(logging.WARNING))
    stdout_handler.setFormatter(formatter)

    stderr_handler = logging.StreamHandler(sys.stderr)
    stderr_handler.setLevel(logging.ERROR)
    stderr_handler.setFormatter(formatter)

    root_logger.addHandler(stdout_handler)
    root_logger.addHandler(stderr_handler)
    root_logger._jobs_logging_configured = True  # type: ignore[attr-defined]
