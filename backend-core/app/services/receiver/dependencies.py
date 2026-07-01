from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.common.utils import get_logger
from app.config.settings import settings
from app.db.models import SenderType
from app.services.encryption import EncryptionService

logger = get_logger(__name__)


def validate_sender_type(sender_type: str) -> SenderType:
    if sender_type == "user":
        return SenderType.END_USER

    logger.warning(f"Invalid sender type: {sender_type}. Defaulting to 'END_USER'.")
    return SenderType.END_USER


@lru_cache(maxsize=1)
def get_encryption_service() -> EncryptionService:
    return EncryptionService(settings)


ValidSenderType = Annotated[str, Depends(validate_sender_type)]
EncryptionServiceDep = Annotated[EncryptionService, Depends(get_encryption_service)]
