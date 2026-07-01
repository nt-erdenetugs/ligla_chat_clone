from datetime import datetime

from pydantic import BaseModel, Field


class SyncSummary(BaseModel):
    sync_date: datetime
    total_organizations: int = Field(ge=0)
    successful_syncs: int = Field(ge=0)
    failed_syncs: int = Field(ge=0)
    total_records_synced: int = Field(ge=0)
    total_duration_seconds: float = Field(ge=0.0)
    organizations_processed: list[str] = Field(default_factory=list)
    failed_organizations: dict[str, str] = Field(default_factory=dict)


class FileEvent(BaseModel):
    """Schema for file event data from GCS or manual sync requests"""

    file_path: str
    data: dict | None = None
    name: str | None = None
    bucket: str | None = None
    type: str | None = None

    @property
    def resolved_file_path(self) -> str:
        """Get the file path from various possible field names"""
        return (
            self.file_path or (self.data and self.data.get("name")) or self.name or ""
        )
