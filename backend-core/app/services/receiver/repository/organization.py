from collections import defaultdict
from typing import Any

from sqlalchemy import delete, inspect, select
from sqlalchemy.orm import Session

from app.common.crud_base import CRUDBase
from app.common.utils import get_exception_info, get_logger
from app.db.models import Auth, Organization
from app.libs.gcp.gcs.organization import delete_organization_data
from app.services.receiver import schemas

logger = get_logger(__name__)


def track_cascading_deletes(org_entity: Organization):
    delete_counts = defaultdict(int)
    total_related_records = 0
    affected_table_count = 0
    table_set = set()

    def count_cascaded_entities(parent, visited=None):
        nonlocal total_related_records, affected_table_count, table_set

        if visited is None:
            visited = set()

        parent_key = f"{parent.__class__.__name__}_{inspect(parent).identity}"
        if parent_key in visited:
            return
        visited.add(parent_key)

        mapper = inspect(parent.__class__)
        for relationship in mapper.relationships:
            if relationship.cascade.delete and hasattr(parent, relationship.key):
                try:
                    related_entities = getattr(parent, relationship.key)

                    if related_entities is not None:
                        if hasattr(related_entities, "__iter__") and not isinstance(related_entities, str):
                            entity_count = 0
                            table_name = None

                            for entity in related_entities:
                                entity_count += 1
                                table_name = entity.__tablename__
                                delete_counts[table_name] += 1
                                count_cascaded_entities(entity, visited)

                            if entity_count > 0 and table_name and table_name not in table_set:
                                table_set.add(table_name)
                                total_related_records += entity_count
                        else:
                            table_name = related_entities.__tablename__
                            delete_counts[table_name] += 1

                            if table_name not in table_set:
                                table_set.add(table_name)
                                total_related_records += 1

                            count_cascaded_entities(related_entities, visited)
                except Exception as e:
                    logger.warning(
                        "Error counting cascaded entities",
                        extra={"relationship": relationship.key, "error": str(e)},
                    )

    count_cascaded_entities(org_entity)
    affected_table_count = len(table_set)

    table_details = dict(delete_counts)
    logger.info(f"Detailed cascade deletion counts by table: {table_details}")

    return {"affected_table_count": affected_table_count, "total_related_records": total_related_records}


class CRUDOrganization(CRUDBase[Organization, schemas.OrganizationCreate, schemas.OrganizationUpdate]):
    def get_by_name(self, db: Session, name: str) -> Organization | None:
        stmt = select(Organization).where(
            Organization.name == name,
            Organization.isActive.is_(True),
        )
        result = db.execute(stmt)
        return result.scalar_one_or_none()

    def get_by_name_all(self, db: Session, name: str) -> Organization | None:
        stmt = select(Organization).where(Organization.name == name)
        result = db.execute(stmt)
        return result.scalar_one_or_none()

    def delete_organization(self, db: Session, organization_name: str) -> dict[str, Any] | None:
        organization = self.get_by_name_all(db, name=organization_name)
        if not organization:
            logger.warning(f"Organization {organization_name} not found")
            return None

        org_dict: dict[str, Any] = {
            "name": organization.name,
            "displayName": organization.displayName,
            "apiKey": organization.apiKey,
            "loginLiffId": organization.loginLiffId,
            "fileUploadLiffId": organization.fileUploadLiffId,
            "description": organization.description,
            "maxOperator": organization.maxOperator,
            "isActive": organization.isActive,
            "archivedBy": organization.archivedBy,
        }

        if hasattr(organization, "createdAt") and organization.createdAt:
            org_dict["createdAt"] = organization.createdAt
        if hasattr(organization, "updatedAt") and organization.updatedAt:
            org_dict["updatedAt"] = organization.updatedAt

        logger.info(f"Deleting organization {organization_name}")

        try:
            cascade_deletion_stats = track_cascading_deletes(organization)
            logger.info(
                f"Cascade deletion will affect {cascade_deletion_stats['affected_table_count']} tables "
                f"with {cascade_deletion_stats['total_related_records']} records for organization {organization_name}"
            )

            auth_stmt = delete(Auth).where(Auth.organizationName == organization_name)
            auth_result = db.execute(auth_stmt)
            logger.info(f"Deleted {auth_result.rowcount} auth records for organization {organization_name}")

            stmt = delete(Organization).where(Organization.name == organization_name)
            db.execute(stmt)
            db.commit()  # Keep commit here - this is a standalone deletion operation with explicit transaction control
            logger.info(f"Successfully deleted organization {organization_name} and its related data")

            org_dict["database_deletion"] = {
                "tables_affected": cascade_deletion_stats["affected_table_count"],
                "total_records_deleted": cascade_deletion_stats["total_related_records"],
            }

            logger.info(f"Starting deletion of GCS data for organization: {organization_name}")
            gcs_deletion_summary = delete_organization_data(organization_name)

            deleted_count = gcs_deletion_summary.get("deleted_blobs", 0)
            failed_count = gcs_deletion_summary.get("failed_blobs_count", 0)
            total_found = gcs_deletion_summary.get("total_blobs", 0)

            if total_found == 0:
                logger.info(f"No GCS objects found for organization {organization_name}")
            elif failed_count == 0:
                logger.info(
                    f"Successfully deleted all {deleted_count} GCS objects for organization {organization_name}"
                )
            else:
                logger.warning(
                    f"GCS deletion incomplete: {deleted_count}/{total_found} objects deleted, {failed_count} failed"
                )

            org_dict["storage_deletion"] = {
                "total_objects_found": total_found,
                "objects_deleted": deleted_count,
                "objects_failed": failed_count,
                "file_types": gcs_deletion_summary.get("file_types_deleted", {}),
            }

        except Exception as e:
            db.rollback()
            error_info = get_exception_info(e)
            logger.error(
                "Error deleting organization - rolling back transaction",
                extra={
                    "organization": organization_name,
                    **error_info,
                },
            )
            raise

        return org_dict


organization = CRUDOrganization(Organization)
