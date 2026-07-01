import pytest
from sqlalchemy import create_engine

from app.db.base_class import SCHEMA_TOKEN_TENANT


def test_schema_translate_map_compiles() -> None:
    pytest.importorskip("psycopg2")

    # No DB needed: we just want to ensure SQLAlchemy accepts the execution option.
    # Use an Engine-level execution option to avoid connecting.
    engine = create_engine("postgresql+psycopg2://user:pass@localhost/dbname", echo=False)
    engine2 = engine.execution_options(schema_translate_map={SCHEMA_TOKEN_TENANT: "org_test"})
    assert engine2.get_execution_options()["schema_translate_map"][SCHEMA_TOKEN_TENANT] == "org_test"
