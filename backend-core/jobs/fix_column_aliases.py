from __future__ import annotations

import json
import logging

from sqlalchemy import text

from app.db.session import get_engine
from jobs.tenant_manager.operations.introspection import list_tenant_schemas

logger = logging.getLogger(__name__)
TABLE = "organizationSettings"
TYPES = ("memberFeed", "survey")

DEFAULT_ALIASES: dict[str, str] = {
    **{f"category{i}": f"category_{i}" for i in range(1, 26)},
    **{f"number{i}": f"number_{i}" for i in range(1, 16)},
    **{f"datetime{i}": f"datetime_{i}" for i in range(1, 16)},
}


def fix_settings(settings: dict[str, object]) -> tuple[dict[str, object], list[str]]:
    result = {}
    changes = []
    for col_key, col_val in settings.items():
        default_alias = DEFAULT_ALIASES.get(col_key)
        if default_alias and isinstance(col_val, dict) and col_val.get("alias") in (col_key, default_alias):
            result[col_key] = {k: v for k, v in col_val.items() if k != "alias"}
            changes.append(f"  {col_key}.alias: '{col_val['alias']}' -> removed")
        else:
            result[col_key] = col_val
    return result, changes


def run(commit: bool = False) -> int:
    engine = get_engine()
    schemas = sorted(set(list_tenant_schemas(engine)) - {"tenant_template"})
    total_updated = 0
    failed_schemas = []

    for schema in schemas:
        try:
            with engine.begin() as conn:
                rows = conn.execute(
                    text(
                        f'SELECT type, "memberFeedSurveyColumnSettings" FROM "{schema}"."{TABLE}" WHERE type = ANY(:types)'
                    ),
                    {"types": list(TYPES)},
                ).fetchall()

                for row_type, settings_raw in rows:
                    if not settings_raw:
                        continue
                    settings = settings_raw if isinstance(settings_raw, dict) else json.loads(settings_raw)
                    fixed, changes = fix_settings(settings)

                    if not changes:
                        continue

                    logger.info(f"[{schema}] type={row_type}:")
                    for c in changes:
                        logger.info(c)
                    total_updated += 1

                    if commit:
                        conn.execute(
                            text(
                                f'UPDATE "{schema}"."{TABLE}" SET "memberFeedSurveyColumnSettings" = CAST(:data AS jsonb) WHERE type = :type'
                            ),
                            {"data": json.dumps(fixed), "type": row_type},
                        )
        except Exception as e:
            logger.error(f"[{schema}] FAILED: {e}")
            failed_schemas.append(schema)

    mode = "COMMITTED" if commit else "DRY RUN"
    logger.info(
        "[%s] %d rows %s across %d schemas", mode, total_updated, "updated" if commit else "need update", len(schemas)
    )
    if failed_schemas:
        logger.error("FAILED schemas (%d): %s", len(failed_schemas), ", ".join(failed_schemas))
        return 1
    return 0


def main(args) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    return run(commit=args.commit)
