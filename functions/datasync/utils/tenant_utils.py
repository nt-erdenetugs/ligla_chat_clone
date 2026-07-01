import uuid

from sqlalchemy import text
from sqlalchemy.engine import Engine

from logger import get_cloud_logger

logger = get_cloud_logger("tenant_utils")


def uuid_to_schema_name(org_id: uuid.UUID) -> str:
    return f"org_{org_id.hex.lower()}"


def lookup_organization_schema(
    engine: Engine | None, org_name: str
) -> tuple[uuid.UUID, str] | None:
    if not engine:
        return None

    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT id
                FROM public."organization"
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
            org_id = uuid.UUID(org_id)

        # Always compute schema name from UUID (matches backend-core approach)
        schema_name = uuid_to_schema_name(org_id)

        return (org_id, schema_name)
