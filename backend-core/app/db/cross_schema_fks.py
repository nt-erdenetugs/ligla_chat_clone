from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ForeignKeySpec:
    tenant_table: str
    tenant_column: str
    public_table: str
    public_column: str
    constraint_name: str | None = None


# Schema-per-tenant architecture: only allow the minimal cross-schema FKs below.
# Organization-based relations are gone; keep cross-schema links limited to auth
# references.
CROSS_SCHEMA_FKS: list[ForeignKeySpec] = [
    # user.id -> public.auth.id
    # Auth is in public schema because login happens before org context is known
    ForeignKeySpec(
        tenant_table="user",
        tenant_column="id",
        public_table="auth",
        public_column="id",
        constraint_name="fk_user_auth_id",
    ),
]
