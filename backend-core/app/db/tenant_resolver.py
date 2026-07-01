from __future__ import annotations

import uuid

from sqlalchemy import text

from app.common.utils import uuid_to_schema_name
from app.db.models import MigrationPhase
from app.db.session import get_engine

ROUTABLE_PHASES = {
    MigrationPhase.DATA_COPIED,
    MigrationPhase.COMPLETED,
}


def _is_routable_phase(phase: str | None) -> bool:
    if not phase:
        return False
    try:
        return MigrationPhase(phase) in ROUTABLE_PHASES
    except ValueError:
        return False


def resolve_schema(org_id: uuid.UUID | None = None, org_name: str | None = None) -> str | None:
    if not (org_id or org_name):
        raise ValueError("Must provide org_id or org_name")

    where_col = "o.id" if org_id else "o.name"
    identifier = org_id if org_id else org_name

    with get_engine().connect() as conn:
        row = conn.execute(
            text(f"""
                SELECT o.id, ms."currentPhase"
                FROM public."organization" o
                LEFT JOIN public."organizationMigration" ms
                    ON o.name = ms."organizationName"
                WHERE {where_col} = :identifier
            """),
            {"identifier": identifier},
        ).fetchone()

    if not row:
        return None

    org_uuid, phase = row

    if not org_uuid:
        return None

    # Compute schema name from org UUID
    schema_name = uuid_to_schema_name(org_uuid)

    if _is_routable_phase(phase):
        return schema_name

    return None


def resolve_schema_for_org_name(org_name: str) -> str | None:
    return resolve_schema(org_name=org_name)
