import base64
from collections.abc import Callable
from functools import lru_cache
from typing import TypeVar

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Session

from app.common.errors.encryption import (
    DecryptionOperationError,
    EncryptionConfigurationError,
    EncryptionKeyDerivationError,
    EncryptionOperationError,
)
from app.common.errors.handlers import raise_error
from app.common.utils import get_logger
from app.config.settings import Settings
from app.db.encryption_constants import SET_ORG_KEY_SQL
from app.db.session import get_engine

logger = get_logger(__name__)

APPLICATION_SALT = b"ligla-chat-encryption-v1"
PGP_SYM_ENCRYPT_SQL = text(
    "SELECT pgp_sym_encrypt(CAST(:value AS text), current_setting('app.organizationKey', true), 's2k-mode=0')"
)
PGP_SYM_DECRYPT_SQL = text(
    "SELECT pgp_sym_decrypt(CAST(:value AS bytea), current_setting('app.organizationKey', true))"
)

T = TypeVar("T")


class EncryptionService:
    def __init__(self, settings: Settings, engine: Engine | None = None):
        if not hasattr(settings, "ENCRYPTION_MASTER_KEY") or not settings.ENCRYPTION_MASTER_KEY:
            raise_error(EncryptionConfigurationError("ENCRYPTION_MASTER_KEY", "Master key not configured in settings"))

        try:
            self.master_key = base64.b64decode(settings.ENCRYPTION_MASTER_KEY, validate=True)
            if len(self.master_key) != 32:
                raise ValueError("Master key must be exactly 32 bytes (256 bits)")
        except Exception as error:
            logger.error("Failed to decode master key", exc_info=error)
            raise_error(
                EncryptionConfigurationError("ENCRYPTION_MASTER_KEY", f"Invalid master key format: {str(error)}")
            )

        self.engine = engine or get_engine()
        self.max_cache_entries = 1000
        self._cached_derive_org_key: Callable[[str], str] = lru_cache(maxsize=self.max_cache_entries)(
            self._derive_org_key
        )

        logger.info("EncryptionService initialized successfully")

    def _encrypt_value(self, db: Session | Connection, value: str) -> bytes:
        encrypted_blob = db.execute(PGP_SYM_ENCRYPT_SQL, {"value": value}).scalar()

        if isinstance(encrypted_blob, memoryview):
            encrypted_blob = bytes(encrypted_blob)

        if not isinstance(encrypted_blob, bytes):
            raise TypeError(f"Unexpected encrypted blob type: {type(encrypted_blob).__name__}")

        return encrypted_blob

    def encrypt_value(self, db: Session | Connection, value: str, organization_id: str) -> bytes:
        try:
            encrypted_blob = self.tx_with_org_key(db, organization_id, lambda tx: self._encrypt_value(tx, value))
            logger.debug(
                "Encrypted message for organization",
                extra={
                    "organization_id": organization_id,
                    "plaintext_length": len(value),
                    "blob_length": len(encrypted_blob),
                },
            )
            return encrypted_blob
        except Exception as error:
            raise_error(EncryptionOperationError(organization_id, error))

    def _decrypt_value(self, db: Session | Connection, value: bytes | memoryview) -> str:
        encrypted_blob = bytes(value) if isinstance(value, memoryview) else value
        decrypted_text = db.execute(PGP_SYM_DECRYPT_SQL, {"value": encrypted_blob}).scalar()

        if not isinstance(decrypted_text, str):
            raise TypeError(f"Unexpected decrypted text type: {type(decrypted_text).__name__}")

        return decrypted_text

    def decrypt_value(self, db: Session | Connection, value: bytes | memoryview, organization_id: str) -> str:
        try:
            decrypted_text = self.tx_with_org_key(db, organization_id, lambda tx: self._decrypt_value(tx, value))
            logger.debug(
                "Decrypted message for organization",
                extra={"organization_id": organization_id, "plaintext_length": len(decrypted_text)},
            )
            return decrypted_text
        except Exception as error:
            logger.error(
                "Failed to decrypt message for organization",
                exc_info=error,
                extra={
                    "organization_id": organization_id,
                    "error_type": type(error).__name__,
                    "error": str(error),
                },
            )
            raise_error(DecryptionOperationError(organization_id, error))

    def tx_with_org_key(
        self,
        db: Session | Connection,
        organization_id: str,
        callback: Callable[[Session | Connection], T],
    ) -> T:
        """Run callback with `app.organizationKey` set transaction-locally on `db`.

        SQLAlchemy sessions/connections autobegin on first execute, so
        `set_config(..., true)` is always scoped to the caller's active transaction and
        cleared on its commit/rollback. The caller is responsible for owning that
        transaction (FastAPI request lifecycle, or job-level `engine.begin()`). Avoids
        per-call pool checkout in the receiver hot path.
        """

        organization_key = self.derive_org_key(organization_id)
        db.execute(SET_ORG_KEY_SQL, {"organization_key": organization_key})
        return callback(db)

    def derive_org_key(self, organization_id: str) -> str:
        try:
            derived_key = self._cached_derive_org_key(organization_id)
            logger.debug("Resolved encryption key for organization", extra={"organization_id": organization_id})
            return derived_key
        except Exception as error:
            raise_error(EncryptionKeyDerivationError(organization_id, error))

    def _derive_org_key(self, organization_id: str) -> str:
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=APPLICATION_SALT,
            info=organization_id.encode("utf-8"),
        )
        return base64.b64encode(hkdf.derive(self.master_key)).decode("ascii")
