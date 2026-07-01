import logging
from http import HTTPStatus

import functions_framework
from cloudevents.http import CloudEvent
from config import AppENV, settings
from logger.cloud_logging import get_cloud_logger

# Schema-per-tenant service for tenant-isolated data sync
from service import handle_event

logger = get_cloud_logger("datasync")

root_logger = logging.getLogger()
root_logger.handlers = logger.handlers
root_logger.setLevel(logger.level)

if settings.ENV == AppENV.LOCAL:

    @functions_framework.http
    def gcs_event_trigger(request):
        event_data = request.get_json(silent=True)
        if not event_data:
            logger.error("Invalid event data")
            return "Invalid event data", HTTPStatus.BAD_REQUEST.value

        result = handle_event(event_data)
        if result is None:
            return "Invalid event data", HTTPStatus.BAD_REQUEST.value

        return "Data processed successfully", HTTPStatus.OK.value
else:

    @functions_framework.cloud_event
    def gcs_event_trigger(cloud_event: CloudEvent):
        logger.info(f"Received event: {cloud_event}")
        try:
            # Schema-per-tenant: Session management is handled within handle_event
            return handle_event(cloud_event.data)
        except Exception as e:
            logger.error(f"Failed to handle gcs_event_trigger: {e}")
            return None
