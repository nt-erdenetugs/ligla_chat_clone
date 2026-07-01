from sqlalchemy.orm import DeclarativeBase

SCHEMA_TOKEN_TENANT = "__TENANT_SCHEMA_TOKEN__"


class Base(DeclarativeBase):
    pass


class SharedBase(Base):
    __abstract__ = True
    __table_args__ = {"schema": "public"}


class TenantBase(Base):
    __abstract__ = True
    __table_args__ = {"schema": SCHEMA_TOKEN_TENANT}
