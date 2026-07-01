from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.models import ConditionOperator, LogicalOperator, ValueType


class ChatAssignConditionSchema(BaseModel):
    id: UUID
    field: str
    operator: ConditionOperator
    value: str | None = None
    valueType: ValueType


class ChatAssignConditionGroupSchema(BaseModel):
    id: UUID
    logicalOperator: LogicalOperator
    isRoot: bool
    conditions: list[ChatAssignConditionSchema] = Field(default_factory=list)
    subGroups: list["ChatAssignConditionGroupSchema"] = Field(default_factory=list)


_ = ChatAssignConditionGroupSchema.model_rebuild()


class ChatAssignFilterTreeSchema(BaseModel):
    id: UUID
    name: str
    targetTable: str
    note: str | None = None
    isActive: bool
    createdAt: datetime
    updatedAt: datetime | None = None
    rootConditionGroup: ChatAssignConditionGroupSchema


class ChatAssignFilterGroupSchema(BaseModel):
    id: UUID
    logicalOperator: LogicalOperator
    isRoot: bool
    filters: list["ChatAssignFilterTreeSchema"] = Field(default_factory=list)
    subGroups: list["ChatAssignFilterGroupSchema"] = Field(default_factory=list)


_ = ChatAssignFilterGroupSchema.model_rebuild()


class ChatAssignRuleTreeSchema(BaseModel):
    id: UUID
    name: str
    note: str | None = None
    isActive: bool
    createdAt: datetime
    updatedAt: datetime | None = None
    targetTeams: list[UUID]
    rootFilterGroup: ChatAssignFilterGroupSchema
