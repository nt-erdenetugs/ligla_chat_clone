from datetime import datetime, timezone

from sqlalchemy import Connection, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.errors import TableCreationError
from app.core.logger import logger

BASE_TABLE_NAME = "memberfeeddata"


def create_staging_table_in_schema(
    connection: Connection, org_name: str, schema_name: str
) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S%f")[:-3]
    staging_table_name = f"{BASE_TABLE_NAME}_staging_{timestamp}"
    full_table_name = f'"{schema_name}"."{staging_table_name}"'

    try:
        logger.info(f"Creating staging table in tenant schema: {full_table_name}")

        connection.execute(text(f"DROP TABLE IF EXISTS {full_table_name} CASCADE"))

        create_sql = f"""
            CREATE TABLE {full_table_name} (
                "id" UUID NOT NULL DEFAULT gen_random_uuid(),
                "clientUserId" VARCHAR(255) NOT NULL,
                "lineUserId" VARCHAR(255),

                -- Category fields (1-25)
                category1 VARCHAR(255), category2 VARCHAR(255), category3 VARCHAR(255),
                category4 VARCHAR(255), category5 VARCHAR(255), category6 VARCHAR(255),
                category7 VARCHAR(255), category8 VARCHAR(255), category9 VARCHAR(255),
                category10 VARCHAR(255), category11 VARCHAR(255), category12 VARCHAR(255),
                category13 VARCHAR(255), category14 VARCHAR(255), category15 VARCHAR(255),
                category16 VARCHAR(255), category17 VARCHAR(255), category18 VARCHAR(255),
                category19 VARCHAR(255), category20 VARCHAR(255), category21 VARCHAR(255),
                category22 VARCHAR(255), category23 VARCHAR(255), category24 VARCHAR(255),
                category25 VARCHAR(255),

                -- Number fields (1-15)
                number1 INTEGER, number2 INTEGER, number3 INTEGER, number4 INTEGER, number5 INTEGER,
                number6 INTEGER, number7 INTEGER, number8 INTEGER, number9 INTEGER, number10 INTEGER,
                number11 INTEGER, number12 INTEGER, number13 INTEGER, number14 INTEGER, number15 INTEGER,

                -- Datetime fields (1-15)
                datetime1 TIMESTAMP WITH TIME ZONE, datetime2 TIMESTAMP WITH TIME ZONE,
                datetime3 TIMESTAMP WITH TIME ZONE, datetime4 TIMESTAMP WITH TIME ZONE,
                datetime5 TIMESTAMP WITH TIME ZONE, datetime6 TIMESTAMP WITH TIME ZONE,
                datetime7 TIMESTAMP WITH TIME ZONE, datetime8 TIMESTAMP WITH TIME ZONE,
                datetime9 TIMESTAMP WITH TIME ZONE, datetime10 TIMESTAMP WITH TIME ZONE,
                datetime11 TIMESTAMP WITH TIME ZONE, datetime12 TIMESTAMP WITH TIME ZONE,
                datetime13 TIMESTAMP WITH TIME ZONE, datetime14 TIMESTAMP WITH TIME ZONE,
                datetime15 TIMESTAMP WITH TIME ZONE,

                -- System timestamps
                "importedAt" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "syncedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT "{staging_table_name}_pkey" PRIMARY KEY ("id")
            )
        """

        connection.execute(text(create_sql))

        verify_result = connection.execute(
            text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = :schema_name
                    AND table_name = :table_name
                )
            """),
            {"schema_name": schema_name, "table_name": staging_table_name},
        )

        if not verify_result.scalar():
            raise RuntimeError(f"Staging table creation failed: {full_table_name}")

        logger.info(f"Created staging table: {full_table_name}")
        return staging_table_name

    except SQLAlchemyError as e:
        logger.error(
            f"Failed to create staging table {full_table_name} for {org_name}: {e}"
        )
        raise TableCreationError(staging_table_name, str(e), organization=org_name)
