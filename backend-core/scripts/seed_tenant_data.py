#!/usr/bin/env python3
"""Lightweight Python seeder for schema-per-tenant architecture.

Seeds shared + tenant data using SQLAlchemy with direct schema-qualified SQL.

Usage:
    uv run python scripts/seed_tenant_data.py              # seed all orgs
    uv run python scripts/seed_tenant_data.py --org ligla_chat  # seed specific org
    uv run python scripts/seed_tenant_data.py --shared-only     # seed only shared tables
"""
# ruff: noqa: E402, I001 — sys.path must be set before app/third-party imports
import argparse
import os
import sys
import uuid
from datetime import datetime, timedelta, UTC
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("ENV", "local")

from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent.parent / "secret" / ".env"
if env_path.exists():
    load_dotenv(env_path)

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.common.utils import uuid_to_schema_name
from app.db.session import get_engine


# Shared with backend-bff/seeds/sample/data.ts — keep in sync
DEFAULT_PASSWORD = "ligla_Chat@2024"
_cached_hash: str | None = None


def _get_password_hash() -> str:
    """Generate bcrypt hash once and cache (bcrypt is intentionally slow)."""
    global _cached_hash
    if _cached_hash:
        return _cached_hash
    try:
        import bcrypt
        _cached_hash = bcrypt.hashpw(DEFAULT_PASSWORD.encode(), bcrypt.gensalt(10)).decode()
    except ImportError:
        print("WARNING: bcrypt not installed — using hardcoded hash (may not match DEFAULT_PASSWORD)")
        _cached_hash = "$2b$10$EIXwPCfzLH1ekN5Yb2a3XOqT3jKZfRp0xLmD8vKjNq2pF.sG7qYCe"
    return _cached_hash


def _get_organizations(session: Session) -> list[dict]:
    result = session.execute(text('SELECT id, name, "displayName" FROM public.organization ORDER BY name'))
    return [{"id": str(row[0]), "name": row[1], "display_name": row[2]} for row in result]


def seed_shared(session: Session):
    """Seed shared tables in public schema."""
    print("=== Seeding shared tables ===")

    # Hypervisor user
    hyp_id = str(uuid.uuid4())
    session.execute(
        text(
            'INSERT INTO public."hypervisorUser" (id, email, "hashedPassword", "createdAt") '
            "VALUES (:id, :email, :pw, NOW()) ON CONFLICT DO NOTHING"
        ),
        {"id": hyp_id, "email": "hypervisor@liglachat.com", "pw": _get_password_hash()},
    )
    print("  Hypervisor user seeded")

    # Organizations
    orgs = [
        ("ligla_chat", "Ligla Chat", 100, "ligla", "2000000001-upload"),
        ("test_org", "Test Org", 10, "test", "2000000002-upload"),
    ]
    for _index, (name, display, max_op, login_liff_id, file_upload_liff_id) in enumerate(orgs, start=1):
        session.execute(
            text(
                'INSERT INTO public.organization (name, "displayName", "maxOperator", "loginLiffId", "fileUploadLiffId", "createdAt") '
                "VALUES (:name, :display, :max_op, :login_liff_id, :file_upload_liff_id, NOW()) ON CONFLICT DO NOTHING"
            ),
            {
                "name": name,
                "display": display,
                "max_op": max_op,
                "login_liff_id": login_liff_id,
                "file_upload_liff_id": file_upload_liff_id,
            },
        )
    print("  Organizations seeded")

    # organizationMigration records
    org_rows = _get_organizations(session)
    for org in org_rows:
        schema = uuid_to_schema_name(org["id"])
        session.execute(
            text(
                'INSERT INTO public."organizationMigration" ("schemaName", "lastRevision", "lastStatus", "startedAt", "finishedAt") '
                "VALUES (:schema, 'seed', 'SUCCESS', NOW(), NOW()) "
                'ON CONFLICT ("schemaName") WHERE "schemaName" IS NOT NULL DO NOTHING'
            ),
            {"schema": schema},
        )
    print("  organizationMigration records seeded")

    session.commit()


def seed_tenant(session: Session, org_name: str | None = None):
    """Seed tenant data into org_* schemas."""
    orgs = _get_organizations(session)

    if org_name:
        orgs = [o for o in orgs if o["name"] == org_name]
        if not orgs:
            print(f"Organization '{org_name}' not found")
            return

    for org in orgs:
        schema = uuid_to_schema_name(org["id"])
        print(f"\n=== Seeding tenant: {org['name']} ({schema}) ===")

        # Check schema exists
        exists = session.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = :s)"),
            {"s": schema},
        ).scalar()

        if not exists:
            print(f"  Schema {schema} does not exist, skipping")
            continue

        _seed_org_data(session, schema, org["name"])
        session.commit()


def _seed_org_data(session: Session, schema: str, org_name: str):
    """Seed all tenant tables for one org schema."""
    now = datetime.now(UTC)

    # Teams
    teams = [
        {"name": "Team 1 (Default)", "is_default": True},
        {"name": "Team 2", "is_default": False},
    ]
    for i in range(3, 11):
        teams.append({"name": f"Team {i}", "is_default": False})

    team_params = [
        {"id": str(uuid.uuid4()), "name": t["name"], "is_default": t["is_default"], "now": now}
        for t in teams
    ]
    session.execute(
        text(
            f'INSERT INTO "{schema}".team (id, name, "isDefault", "createdAt") '
            f"VALUES (:id, :name, :is_default, :now) ON CONFLICT DO NOTHING"
        ),
        team_params,
    )
    print(f"  Teams: {len(teams)}")

    # Auth (public) + User (tenant)
    users = [
        ("Admin", f"admin@{org_name}.com", "ADMIN"),
        ("Operator", f"operator@{org_name}.com", "OPERATOR"),
    ]
    for u_name, email, role in users:
        uid = str(uuid.uuid4())
        session.execute(
            text(
                'INSERT INTO public.auth (id, email, "hashedPassword", "organizationName", "createdAt") '
                "VALUES (:id, :email, :pw, :org, :now) ON CONFLICT DO NOTHING"
            ),
            {"id": uid, "email": email, "pw": _get_password_hash(), "org": org_name, "now": now},
        )
        session.execute(
            text(
                f'INSERT INTO "{schema}"."user" (id, "displayName", "roleType", "createdAt") '
                f"VALUES (:id, :name, :role, :now) ON CONFLICT DO NOTHING"
            ),
            {"id": uid, "name": u_name, "role": role, "now": now},
        )
    print(f"  Users: {len(users)}")

    # End users
    end_users = [
        ("Uc6c3264e8bbb2f3c67fed76400d858b9", "LINE Taro"),
        ("Uae35f45f35f1af5b3f8d4756a9ddcb23", "Test user"),
    ]
    for eu_id, eu_name in end_users:
        session.execute(
            text(
                f'INSERT INTO "{schema}"."endUser" ("userId", "displayName", "createdAt") '
                f"VALUES (:id, :name, :now) ON CONFLICT DO NOTHING"
            ),
            {"id": eu_id, "name": eu_name, "now": now},
        )
    print(f"  End users: {len(end_users)}")

    # Stores
    for i in range(1, 4):
        sid = str(uuid.uuid4())
        session.execute(
            text(
                f'INSERT INTO "{schema}".store (id, name, "liglaStoreId", "typeName", "areaName", "createdAt") '
                f"VALUES (:id, :name, :lid, :typ, :area, :now) ON CONFLICT DO NOTHING"
            ),
            {"id": sid, "name": f"Store-{i}", "lid": i, "typ": "Apparel", "area": "Location area", "now": now},
        )
    print("  Stores: 3")

    # Chats
    chat_id = str(uuid.uuid4())
    session.execute(
        text(
            f'INSERT INTO "{schema}".chat (id, "endUserId", "clientUserId", "chatStatus", "createdAt", "latestMessageTimestamp") '
            f"VALUES (:id, :eu, :cu, 'ADDRESSING', :now, :now) ON CONFLICT DO NOTHING"
        ),
        {"id": chat_id, "eu": end_users[0][0], "cu": "client_user_1", "now": now - timedelta(days=1)},
    )
    print("  Chats: 1")

    print(f"  Done: {org_name}")


def main():
    parser = argparse.ArgumentParser(description="Seed tenant data (Python)")
    parser.add_argument("--org", help="Seed specific org only")
    parser.add_argument("--shared-only", action="store_true", help="Seed only shared tables")
    args = parser.parse_args()
    if args.shared_only and args.org:
        parser.error("--shared-only and --org are mutually exclusive")

    engine = get_engine()

    try:
        with Session(engine) as session:
            if not args.org:
                seed_shared(session)

            if not args.shared_only:
                seed_tenant(session, args.org)

        print("\nSeed complete!")
    except Exception as e:
        print(f"\nERROR: Seeding failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
