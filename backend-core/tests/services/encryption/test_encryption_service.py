"""Unit tests for the EncryptionService."""

import base64

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from fastapi import HTTPException

from app.services.encryption.service import APPLICATION_SALT, EncryptionService

VALID_MASTER_KEY = base64.b64encode(bytes(range(32))).decode()
ORG_ID = "00000000-0000-0000-0000-000000000001"
ORG_NAME = "Test Organization"


def _make_settings(**overrides):
    class _FakeSettings:
        ENCRYPTION_MASTER_KEY: str = overrides.get("ENCRYPTION_MASTER_KEY", VALID_MASTER_KEY)

    for key, value in overrides.items():
        setattr(_FakeSettings, key, value)

    return _FakeSettings()


def _derive_expected_org_key(master_key_b64: str, organization_name: str) -> str:
    master_key = base64.b64decode(master_key_b64)
    normalized_name = organization_name.strip().lower().encode("utf-8")
    hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=APPLICATION_SALT, info=normalized_name)
    return base64.b64encode(hkdf.derive(master_key)).decode("ascii")


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar(self):
        return self.value

    def scalar_one_or_none(self):
        return self.value


class FakeResolverConnection:
    def __init__(self, names_by_id):
        self.names_by_id = names_by_id
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, statement, params):
        self.calls.append((statement, params))
        return FakeResult(self.names_by_id.get(params["organization_id"]))


class FakeEngine:
    def __init__(self, names_by_id=None):
        self.connection = FakeResolverConnection(names_by_id or {})

    def connect(self):
        return self.connection


class FakeDb:
    def __init__(self, encrypted_blob=b"ciphertext", decrypted_text="plaintext"):
        self.calls = []
        self.encrypted_blob = encrypted_blob
        self.decrypted_text = decrypted_text
        self.raise_encrypt = None
        self.raise_decrypt = None

    def execute(self, statement, params):
        sql_text = str(statement)
        self.calls.append((sql_text, params))

        if "set_config" in sql_text:
            return FakeResult("ok")

        if "pgp_sym_encrypt" in sql_text:
            if self.raise_encrypt:
                raise self.raise_encrypt
            return FakeResult(self.encrypted_blob)

        if "pgp_sym_decrypt" in sql_text:
            if self.raise_decrypt:
                raise self.raise_decrypt
            return FakeResult(self.decrypted_text)

        raise AssertionError(f"Unexpected SQL: {sql_text}")


class TestConstructor:
    def test_valid_key_succeeds(self):
        service = EncryptionService(_make_settings(), engine=FakeEngine())
        assert service.master_key == base64.b64decode(VALID_MASTER_KEY)

    def test_missing_attribute_raises(self):
        class _NoAttr:
            pass

        with pytest.raises(HTTPException) as exc_info:
            EncryptionService(_NoAttr(), engine=FakeEngine())
        assert exc_info.value.detail["error"] == "ENCRYPTION_CONFIGURATION_ERROR"

    def test_invalid_base64_raises(self):
        with pytest.raises(HTTPException) as exc_info:
            EncryptionService(_make_settings(ENCRYPTION_MASTER_KEY="not-base64"), engine=FakeEngine())
        assert exc_info.value.detail["error"] == "ENCRYPTION_CONFIGURATION_ERROR"


class TestKeyDerivation:
    @pytest.fixture()
    def service(self):
        return EncryptionService(_make_settings(), engine=FakeEngine({ORG_ID: ORG_NAME}))

    def test_derives_base64_org_key(self, service):
        assert service.derive_org_key(ORG_ID) == _derive_expected_org_key(VALID_MASTER_KEY, ORG_ID)

    def test_uses_lru_cache_for_derived_keys(self, service):
        service.derive_org_key(ORG_ID)
        service.derive_org_key(ORG_ID)

        cache_info = service._cached_derive_org_key.cache_info()
        assert cache_info.hits == 1
        assert cache_info.misses == 1


class TestPgcryptoFlow:
    def test_tx_with_org_key_sets_session_key_before_callback(self):
        service = EncryptionService(_make_settings(), engine=FakeEngine({ORG_ID: ORG_NAME}))
        db = FakeDb()

        result = service.tx_with_org_key(db, ORG_ID, lambda tx: "done")

        assert result == "done"
        assert "set_config" in db.calls[0][0]
        assert db.calls[0][1]["organization_key"] == _derive_expected_org_key(VALID_MASTER_KEY, ORG_ID)

    def test_encrypt_value_uses_set_config_then_pgcrypto_encrypt(self):
        service = EncryptionService(_make_settings(), engine=FakeEngine({ORG_ID: ORG_NAME}))
        db = FakeDb(encrypted_blob=b"pgcrypto-ciphertext")

        result = service.encrypt_value(db, "hello", ORG_ID)

        assert result == b"pgcrypto-ciphertext"
        assert "set_config" in db.calls[0][0]
        assert "pgp_sym_encrypt" in db.calls[1][0]
        assert "current_setting('app.organizationKey', true)" in db.calls[1][0]
        assert "s2k-mode=0" in db.calls[1][0]
        assert db.calls[1][1] == {"value": "hello"}

    def test_decrypt_value_uses_set_config_then_pgcrypto_decrypt(self):
        service = EncryptionService(_make_settings(), engine=FakeEngine({ORG_ID: ORG_NAME}))
        db = FakeDb(decrypted_text="hello")

        result = service.decrypt_value(db, b"ciphertext", ORG_ID)

        assert result == "hello"
        assert "set_config" in db.calls[0][0]
        assert "pgp_sym_decrypt" in db.calls[1][0]
        assert "current_setting('app.organizationKey', true)" in db.calls[1][0]
        assert db.calls[1][1] == {"value": b"ciphertext"}

    def test_decrypt_value_accepts_memoryview(self):
        service = EncryptionService(_make_settings(), engine=FakeEngine({ORG_ID: ORG_NAME}))
        db = FakeDb(decrypted_text="hello")

        result = service.decrypt_value(db, memoryview(b"ciphertext"), ORG_ID)

        assert result == "hello"
        assert db.calls[1][1] == {"value": b"ciphertext"}

    def test_decrypt_value_raises_on_failure(self):
        service = EncryptionService(_make_settings(), engine=FakeEngine({ORG_ID: ORG_NAME}))
        db = FakeDb()
        db.raise_decrypt = RuntimeError("decrypt failed")

        with pytest.raises(HTTPException) as exc_info:
            service.decrypt_value(db, b"ciphertext", ORG_ID)

        assert exc_info.value.detail["error"] == "DECRYPTION_OPERATION_ERROR"


class TestApplicationSalt:
    def test_salt_value(self):
        assert APPLICATION_SALT == b"ligla-chat-encryption-v1"
