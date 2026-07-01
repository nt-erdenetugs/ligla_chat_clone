from uuid import UUID

from pydantic import BaseModel, Field


class ProvisionSchemaRequest(BaseModel):
    organizationId: UUID = Field(...)


class ProvisionSchemaResponse(BaseModel):
    success: bool
    tableCount: int
    alreadyExisted: bool = False


class DeprovisionSchemaResponse(BaseModel):
    success: bool
    schemaName: str
