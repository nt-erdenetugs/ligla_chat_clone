from collections.abc import Sequence
from typing import Any

from sqlalchemy import Row


def rows_to_schema_list[SchemaType](rows: Sequence[Row[Any]], schema_cls: type[SchemaType]) -> list[SchemaType]:
    return [schema_cls(**dict(row)) for row in rows]
