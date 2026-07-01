import threading
from hmac import compare_digest
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.common.dependencies import get_db
from app.common.errors import OrganizationNotFoundError, SchemaValidationError, raise_error
from app.common.utils import get_logger, uuid_to_schema_name
from app.db.models import HypervisorUser, MigrationPhase, Organization
from app.db.schema_manager import drop_tenant_schema
from app.db.session import get_engine
from app.services.organization.schemas import (
    DeprovisionSchemaResponse,
    ProvisionSchemaRequest,
    ProvisionSchemaResponse,
)
from app.services.organization.service import SchemaProvisioningError, SchemaProvisioningService
from app.services.receiver import repository, schemas

router = APIRouter()
logger = get_logger(__name__)
schema_provisioning_service = SchemaProvisioningService()
provisioning_semaphore = threading.BoundedSemaphore(value=4)


class DeleteOrgRequest(schemas.BaseModel):
    org_name: str


@router.post("/delete", response_model=schemas.Organization)
def delete_organization(
    payload: DeleteOrgRequest,
    db: Session = Depends(get_db),
    hypervisor_user_id: str | None = Header(default=None, alias="X-Hypervisor-User-Id"),
    organization_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    org_name = payload.org_name

    org_row = _validate_hypervisor_headers(
        db=db,
        hypervisor_user_id=hypervisor_user_id,
        organization_api_key=organization_api_key,
        organization_name=org_name,
    )

    logger.info(
        "Processing organization deletion request",
        extra={
            "organization": org_name,
            "action": "delete_organization",
        },
    )

    try:
        _drop_and_cleanup_schema(str(org_row.id))
    except Exception as e:
        logger.warning(
            "Failed to drop tenant schema (non-blocking)",
            extra={"organization": org_name, "error": str(e)},
        )

    org_data = repository.organization.delete_organization(db, organization_name=org_name)
    if not org_data:
        raise_error(OrganizationNotFoundError(org_name))

    storage_deletion = org_data.get("storage_deletion", {})
    failed_count = storage_deletion.get("objects_failed", 0)
    total_found = storage_deletion.get("total_objects_found", 0)

    if failed_count > 0:
        logger.warning(
            "Organization deleted from database but some GCS objects failed to delete",
            extra={
                "organization": org_name,
                "objects_failed": failed_count,
                "total_objects_found": total_found,
                "success_rate": f"{((total_found - failed_count) / total_found * 100):.1f}%",
            },
        )

    try:
        organization_response = schemas.Organization(**org_data)
        logger.info(
            "Organization deleted successfully",
            extra={
                "organization": org_name,
                "gcs_objects_deleted": total_found - failed_count,
                "gcs_objects_failed": failed_count,
            },
        )
        return organization_response
    except Exception as e:
        raise_error(
            SchemaValidationError(
                field_errors=[f"Error creating response schema: {str(e)}"],
            )
        )


@router.post("/provision-schema", response_model=ProvisionSchemaResponse)
def provision_schema(
    payload: ProvisionSchemaRequest,
    db: Session = Depends(get_db),
    hypervisor_user_id: str | None = Header(default=None, alias="X-Hypervisor-User-Id"),
    organization_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    org_id = str(payload.organizationId)

    if not provisioning_semaphore.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Provisioning capacity is saturated. Please retry shortly")

    try:
        org_row = _validate_hypervisor_headers(
            db=db,
            organization_id=payload.organizationId,
            hypervisor_user_id=hypervisor_user_id,
            organization_api_key=organization_api_key,
        )

        org_name = org_row.name
        db.close()

        result = schema_provisioning_service.provision(org_id)
        _mark_migration_completed(org_id, org_name)
        return ProvisionSchemaResponse(**result)
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except SchemaProvisioningError as e:
        logger.exception(
            "Schema provisioning failed",
            extra={
                "organization_id": org_id,
                "error": str(e),
            },
        )
        raise HTTPException(status_code=500, detail="Schema provisioning failed") from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Unexpected error during schema provisioning",
            extra={
                "organization_id": org_id,
                "error": str(e),
            },
        )
        raise HTTPException(status_code=500, detail="Schema provisioning failed") from e
    finally:
        provisioning_semaphore.release()


@router.post("/deprovision-schema", response_model=DeprovisionSchemaResponse)
def deprovision_schema(
    payload: ProvisionSchemaRequest,
    db: Session = Depends(get_db),
    hypervisor_user_id: str | None = Header(default=None, alias="X-Hypervisor-User-Id"),
    organization_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    try:
        _validate_hypervisor_headers(
            db=db,
            organization_id=payload.organizationId,
            hypervisor_user_id=hypervisor_user_id,
            organization_api_key=organization_api_key,
        )

        schema_name = _drop_and_cleanup_schema(str(payload.organizationId))
        return DeprovisionSchemaResponse(success=True, schemaName=schema_name)
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Schema deprovisioning failed",
            extra={
                "organization_id": payload.organizationId,
                "error": str(e),
            },
        )
        raise HTTPException(status_code=500, detail="Schema deprovisioning failed") from e


def _mark_migration_completed(organization_id: str, organization_name: str) -> None:
    schema_name = uuid_to_schema_name(organization_id)
    try:
        with get_engine().begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO public."organizationMigration"
                        ("schemaName", "organizationName", "currentPhase", "migrationCompletedAt", "updatedAt")
                    VALUES (:schema_name, :org_name, :phase, NOW(), NOW())
                    ON CONFLICT ("schemaName") WHERE "schemaName" IS NOT NULL DO UPDATE SET
                        "organizationName" = EXCLUDED."organizationName",
                        "currentPhase" = EXCLUDED."currentPhase",
                        "migrationCompletedAt" = EXCLUDED."migrationCompletedAt",
                        "updatedAt" = EXCLUDED."updatedAt"
                """),
                {"org_name": organization_name, "schema_name": schema_name, "phase": MigrationPhase.COMPLETED.value},
            )
    except Exception as e:
        logger.warning(
            "Failed to mark migration completed (non-blocking)",
            extra={"organization_id": organization_id, "schema_name": schema_name, "error": str(e)},
        )


def _drop_and_cleanup_schema(org_id: str) -> str:
    schema_name = uuid_to_schema_name(org_id)
    drop_tenant_schema(schema_name, force=True)
    _cleanup_migration_record(schema_name)
    return schema_name


def _cleanup_migration_record(schema_name: str) -> None:
    try:
        with get_engine().begin() as conn:
            conn.execute(
                text('DELETE FROM public."organizationMigration" WHERE "schemaName" = :schema_name'),
                {"schema_name": schema_name},
            )
    except Exception as e:
        logger.warning(
            "Failed to cleanup migration record (non-blocking)",
            extra={"schema_name": schema_name, "error": str(e)},
        )


def _validate_hypervisor_headers(
    db: Session,
    hypervisor_user_id: str | None,
    organization_api_key: str | None,
    *,
    organization_id: UUID | None = None,
    organization_name: str | None = None,
):
    if not hypervisor_user_id or not organization_api_key:
        raise HTTPException(status_code=401, detail="Missing hypervisor authentication headers")

    try:
        hypervisor_uuid = UUID(hypervisor_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid hypervisor user id") from exc

    hypervisor_exists = db.execute(
        select(HypervisorUser.id).where(HypervisorUser.id == hypervisor_uuid)
    ).scalar_one_or_none()
    if not hypervisor_exists:
        raise HTTPException(status_code=403, detail="Hypervisor user is not authorized")

    if organization_id and organization_name:
        raise HTTPException(status_code=400, detail="Provide organization_id or organization_name, not both")
    elif organization_id:
        org_filter = Organization.id == organization_id
    elif organization_name:
        org_filter = Organization.name == organization_name
    else:
        raise HTTPException(status_code=400, detail="Organization identifier required")

    org_row = db.execute(select(Organization.id, Organization.name, Organization.apiKey).where(org_filter)).first()
    if not org_row:
        raise HTTPException(status_code=404, detail="Organization not found")

    expected_api_key = org_row.apiKey or ""
    if not compare_digest(expected_api_key, organization_api_key):
        raise HTTPException(status_code=403, detail="Invalid organization API key")

    return org_row
