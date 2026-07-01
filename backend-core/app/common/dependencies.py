from collections.abc import Generator

from fastapi import Request
from sqlalchemy.orm import Session

from app.db.base_class import SCHEMA_TOKEN_TENANT
from app.db.session import get_engine
from app.db.tenant_context import get_tenant_schema


def get_db(request: Request) -> Generator[Session]:
    if hasattr(request.state, "db") and request.state.db is not None:
        yield request.state.db
        return

    schema = get_tenant_schema()
    engine = get_engine()
    if schema:
        engine = engine.execution_options(schema_translate_map={SCHEMA_TOKEN_TENANT: schema, None: "public"})

    db: Session = Session(bind=engine, autocommit=False, autoflush=False)
    try:
        yield db
    finally:
        db.close()
