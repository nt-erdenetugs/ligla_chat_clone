import uuid

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.core.logger import logger


def uuid_to_schema_name(org_id: uuid.UUID) -> str:
    return f"org_{org_id.hex.lower()}"


def lookup_organization_schema(
    connection: Connection, org_name: str
) -> tuple[uuid.UUID, str] | None:
    result = connection.execute(
        text("""
            SELECT id
            FROM organization
            WHERE name = :org_name
            LIMIT 1
        """),
        {"org_name": org_name},
    ).fetchone()

    if not result:
        logger.warning(f"Organization not found: {org_name}")
        return None

    org_id = result[0]

    # Normalize org_id to UUID
    if isinstance(org_id, str):
        try:
            org_id = uuid.UUID(org_id)
        except ValueError:
            logger.warning("Invalid UUID for organization %s: %s", org_name, org_id)
            return None

    # Compute schema name from organization UUID
    schema_name = uuid_to_schema_name(org_id)

    return (org_id, schema_name)


def ensure_tenant_table_exists(
    connection: Connection, schema_name: str, table_name: str = "memberFeedData"
) -> bool:
    result = connection.execute(
        text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = :schema_name
                AND table_name = :table_name
            )
        """),
        {"schema_name": schema_name, "table_name": table_name},
    )

    exists = result.scalar()

    if not exists:
        logger.warning(f"Table {table_name} does not exist in schema {schema_name}")

    return exists
