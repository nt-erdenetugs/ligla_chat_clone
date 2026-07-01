import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.common.errors import InternalError, alert_critical_issue, handle_error
from app.common.utils import get_exception_info, get_logger
from app.db.base_class import SCHEMA_TOKEN_TENANT
from app.db.session import get_engine
from app.db.tenant_context import tenant_context_scope
from app.services.receiver.dependencies import EncryptionServiceDep
from app.services.receiver.helper.messaging import (
    decode_pubsub_data,
    get_queue_service,
    parse_request_body,
    process_message,
    publish_message,
    validate_incoming_message,
)
from app.services.receiver.schemas.message import MessageRequest

router = APIRouter()
logger = get_logger(__name__)


@router.post("/publish-message", status_code=status.HTTP_201_CREATED)
async def publish_new_message(payload: MessageRequest):
    try:
        return await publish_message(payload)
    except HTTPException:
        raise
    except Exception as e:
        raise handle_error(e, context={"endpoint": "publish_message"})


@router.post("/new-message-handler", status_code=status.HTTP_200_OK)
async def pubsub_push_handler(request: Request, encryption_service: EncryptionServiceDep):
    raw_payload = await parse_request_body(request)
    decoded_data = decode_pubsub_data(raw_payload)
    message_request = validate_incoming_message(decoded_data)
    msg_type = (
        message_request.message_type.value
        if hasattr(message_request.message_type, "value")
        else str(message_request.message_type)
    )

    with tenant_context_scope(organization_name=message_request.client_name) as ctx:
        engine = get_engine().execution_options(
            schema_translate_map={SCHEMA_TOKEN_TENANT: ctx.schema_name, None: "public"}
        )
        db = Session(bind=engine, autocommit=False, autoflush=False)

        try:
            logger.info(
                "Processing pubsub message",
                extra={
                    "message_type": msg_type,
                    "user_id": message_request.user_id,
                    "client_name": message_request.client_name,
                },
            )
            result = await process_message(message_request, db, encryption_service)

            db.commit()

            # Notify BFF AFTER commit to prevent race conditions
            if result:
                try:
                    await result.notify_bff()

                    if result.auto_reply_message:
                        await asyncio.sleep(2)
                        await result.notify_bff_auto_reply()
                except Exception as bff_error:
                    # BFF notification failures are non-blocking - message already committed
                    error_info = get_exception_info(bff_error)
                    logger.error(
                        "BFF notification failed but message processing succeeded",
                        extra={
                            "chat_id": str(result.chat_id),
                            "message_type": message_request.message_type,
                            **error_info,
                        },
                    )

            logger.info(
                "Message processed successfully",
                extra={
                    "message_type": msg_type,
                    "chat_id": str(result.chat_id) if result else None,
                },
            )

            return {"status": "Message processed successfully"}

        except HTTPException as e:
            db.rollback()

            if e.status_code == 400:
                logger.error(
                    "VALIDATION_ERROR_ALERT",
                    extra={
                        "error_detail": e.detail,
                        "alert_type": "validation_error",
                        "should_alert": True,
                        "should_dlq": True,
                        "error_code": e.status_code,
                    },
                )
            else:
                logger.warning(
                    "Client error processing message",
                    extra={
                        "status_code": e.status_code,
                        "error_detail": e.detail,
                    },
                )
            raise

        except Exception as e:
            db.rollback()

            logger.exception(
                "Critical internal error handling Pub/Sub message",
                extra={
                    "error_type": type(e).__name__,
                    "error_details": str(e),
                },
            )
            alert_critical_issue("Pub/Sub processing failed", {"error": str(e), "error_type": type(e).__name__})
            raise handle_error(e, context={"endpoint": "pubsub_push_handler"})
        finally:
            db.close()


@router.get("/dlq-messages", response_model=list[dict[str, Any]])
async def get_dlq_messages(max_messages: int = 10):
    queue_service = get_queue_service()
    if not queue_service:
        error = InternalError("Queue service could not be initialized")
        error.log()
        raise error.to_http_exception()

    try:
        return queue_service.pull_messages_from_dlq(max_messages)
    except Exception as e:
        error_info = get_exception_info(e)
        logger.error(
            "Failed to get messages from DLQ",
            extra={
                "max_messages": max_messages,
                **error_info,
            },
        )
        raise handle_error(e, context={"endpoint": "get_dlq_messages", "max_messages": max_messages})


# Uncomment to enable chat deletion endpoint
# @router.delete("/chats/{chat_id}", response_model=ChatDeleteResponse, status_code=status.HTTP_200_OK)
# async def delete_chat(
#     chat_id: UUID,
#     organization_name: str = Query(..., alias="organizationName", description="Organization name for validation"),
# ):
#     """
#     Completely delete a chat and all its related data.

#     This endpoint permanently removes a chat and all associated data following
#     the proper deletion order to avoid foreign key constraint violations.

#     **Deletes in order:**
#     - chatAttributeValue records
#     - chatTags records
#     - chatTeamAssignment records
#     - chatActivity records
#     - chatMessage records
#     - note records
#     - attribute records
#     - chat record itself
#     - endUser record (only if no other chats exist for this user)
#     - surveyData records for deleted endUsers

#     **Warning:** This operation is irreversible and should only be used for
#     cleaning up dummy/test data after UAT testing.
#     """
#     from app.db.session import get_sessionmaker_for_current_tenant
#     from app.db.tenant_context import (
#         _build_tenant_context,
#         _resolve_org_from_db,
#         _tenant_context,
#         _tenant_schema,
#     )

#     # Resolve organization and schema for Tenant-schema architecture
#     resolved_schema, actual_org_id, actual_org_name = _resolve_org_from_db(None, organization_name)

#     # Set tenant context for tenant schema operations
#     context = _build_tenant_context(actual_org_id, actual_org_name, resolved_schema)
#     token = _tenant_context.set(context)
#     schema_token = _tenant_schema.set(resolved_schema)

#     SessionLocal = get_sessionmaker_for_current_tenant()
#     tenant_db = SessionLocal()

#     try:
#         organization = repository.organization.get_by_name(tenant_db, organization_name)
#         if not organization:
#             raise HTTPException(
#                 status_code=404,
#                 detail=f"Organization {organization_name} not found",
#             )

#         logger.info(
#             "Deleting chat and all related data",
#             extra={
#                 "chat_id": str(chat_id),
#                 "organization_name": organization_name,
#                 "schema": resolved_schema,
#             },
#         )

#         result = repository.chat_assignment.delete_chat(tenant_db, chat_id, organization)
#         tenant_db.commit()

#         logger.info(
#             "Chat and all related data deleted successfully",
#             extra={
#                 "chat_id": str(chat_id),
#                 "organization_name": organization_name,
#                 "deleted_messages_count": result.deleted_messages_count,
#                 "deleted_activities_count": result.deleted_activities_count,
#                 "deleted_notes_count": result.deleted_notes_count,
#                 "deleted_attributes_count": result.deleted_attributes_count,
#                 "deleted_chat_attributes_count": result.deleted_chat_attributes_count,
#                 "deleted_tags_count": result.deleted_tags_count,
#                 "deleted_team_assignments_count": result.deleted_team_assignments_count,
#                 "end_user_deleted": result.end_user_deleted,
#                 "deleted_survey_count": result.deleted_survey_count,
#             },
#         )

#         return ChatDeleteResponse(
#             success=result.success,
#             chatId=result.deleted_chat_id,
#             message="Chat and all related data deleted successfully.",
#             deletedMessagesCount=result.deleted_messages_count,
#             deletedActivitiesCount=result.deleted_activities_count,
#             deletedNotesCount=result.deleted_notes_count,
#             deletedAttributesCount=result.deleted_attributes_count,
#             deletedChatAttributesCount=result.deleted_chat_attributes_count,
#             deletedTagsCount=result.deleted_tags_count,
#             deletedTeamAssignmentsCount=result.deleted_team_assignments_count,
#             endUserDeleted=result.end_user_deleted,
#             deletedSurveyCount=result.deleted_survey_count,
#         )
#     except HTTPException:
#         tenant_db.rollback()
#         raise
#     except Exception as e:
#         tenant_db.rollback()
#         logger.error(
#             "Failed to delete chat",
#             extra={
#                 "chat_id": str(chat_id),
#                 "organization_name": organization_name,
#                 "schema": resolved_schema,
#                 "error_type": type(e).__name__,
#                 "error_details": str(e),
#             },
#         )
#         raise handle_error(e, context={"endpoint": "delete_chat", "chat_id": str(chat_id)})
#     finally:
#         tenant_db.close()
#         _tenant_context.reset(token)
#         _tenant_schema.reset(schema_token)
