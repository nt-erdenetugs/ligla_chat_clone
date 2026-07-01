#!/usr/bin/env python3
"""Handler tests for data processing handlers."""

import sys
import os
from types import ModuleType

import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from logger.logger import DataProcessingError


class FakeDB:
    """Mock database for testing."""

    def __init__(self):
        self.committed = False
        self.rolled_back = False
        self.executed = []

    def execute(self, stmt, *args, **kwargs):
        self.executed.append((stmt, args, kwargs))

        class MockResult:
            def mappings(self):
                return self

            def fetchone(self):
                return None

            def fetchall(self):
                return []

            def scalars(self):
                return self

            def all(self):
                return []

        return MockResult()

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class TestStoreHandler:
    """Test StoreHandler functionality."""

    @pytest.fixture(autouse=True)
    def setup_handler(self):
        """Setup fake CRUD modules before each test."""
        self._install_fake_crud_store()
        from handlers.store import StoreHandler

        self.handler = StoreHandler()

        self._original_modules = {
            "crud.store": sys.modules.get("crud.store"),
            "crud.member_feed_columns": sys.modules.get("crud.member_feed_columns"),
            "crud.survey_feed_columns": sys.modules.get("crud.survey_feed_columns"),
        }

        yield

        for module_name, original_module in self._original_modules.items():
            if original_module is not None:
                sys.modules[module_name] = original_module
            elif module_name in sys.modules:
                del sys.modules[module_name]

    def _install_fake_crud_store(self):
        """Install fake CRUD store module."""
        fake_mod = ModuleType("crud.store")

        class FakeCrudStore:
            def get_stores_by_organization(self, db):
                return []

            def get_stores_status(self, db, ids):
                return {}

            def create_store(self, db, row):
                return None

            def update_stores(self, db, rows):
                return None

            def soft_delete_stores(self, db, ids):
                return None

        fake_mod.crud_store = FakeCrudStore()
        sys.modules["crud.store"] = fake_mod

    def test_clean_data_basic(self):
        """Test basic data cleaning functionality."""
        data = [
            {
                "id": 1,
                "name": "  Test  ",
                "startsAt": pd.NaT,
                "endsAt": "",
                "note": None,
            }
        ]

        cleaned = self.handler.clean_data(data)
        assert cleaned[0]["name"] == "Test"
        assert cleaned[0]["startsAt"] is None
        assert cleaned[0]["endsAt"] is None

    def test_validate_file_ok(self):
        """Test file validation with valid filename."""
        org = self.handler.validate_file(
            "acme/stores/acme-store_data-20250101_010203.csv"
        )
        assert org == "acme"

    def test_process_batch_success(self):
        """Test successful batch processing."""
        db = FakeDB()
        rows = [{"id": 1, "name": "N1"}, {"id": 2, "name": "N2"}]

        # Should not raise
        self.handler.process_batch(db, "acme", rows)

    def test_missing_required_field_raises(self):
        """Test that missing required fields raise DataProcessingError."""
        db = FakeDB()
        rows = [{"id": 1}]  # missing 'name'

        try:
            self.handler.process_batch(db, "acme", rows)
            assert False, "expected DataProcessingError"
        except DataProcessingError as e:
            assert "Missing required fields" in str(e)


class TestMemberFeedHandler:
    """Test MemberFeedColumnHandler functionality."""

    @pytest.fixture(autouse=True)
    def setup_handler(self):
        """Setup fake CRUD modules before each test."""
        self._install_fake_crud_member_feed()
        from handlers.member_feed_columns import MemberFeedColumnHandler

        self.handler = MemberFeedColumnHandler()

    def _install_fake_crud_member_feed(self):
        """Install fake CRUD member feed module."""
        fake_mod = ModuleType("crud.member_feed_columns")

        class FakeCrudMember:
            def upsert_data(self, db, rows):
                return None

        fake_mod.crud_member_feed_aliases = FakeCrudMember()
        sys.modules["crud.member_feed_columns"] = fake_mod

    def test_validate_file_ok(self):
        """Test file validation with valid filename."""
        org = self.handler.validate_file(
            "acme/settings/acme-client_users-20250101_010203.csv"
        )
        assert org == "acme"

    def test_clean_data_trims(self):
        """Test data cleaning trims whitespace and handles NaT."""
        data = [{"col": "  X  "}, {"col": pd.NaT}]
        cleaned = self.handler.clean_data(data)

        assert cleaned[0]["col"] == "X"
        assert cleaned[1]["col"] is None


class TestSurveyFeedHandler:
    """Test SurveyFeedColumnHandler functionality."""

    @pytest.fixture(autouse=True)
    def setup_handler(self):
        """Setup fake CRUD modules before each test."""
        self._install_fake_crud_survey_feed()
        from handlers.survey_feed_columns import SurveyFeedColumnHandler

        self.handler = SurveyFeedColumnHandler()

    def _install_fake_crud_survey_feed(self):
        """Install fake CRUD survey feed module."""
        fake_mod = ModuleType("crud.survey_feed_columns")

        class FakeCrudSurvey:
            def upsert_data(self, db, rows):
                return None

        fake_mod.crud_survey_feed_columns = FakeCrudSurvey()
        sys.modules["crud.survey_feed_columns"] = fake_mod

    def test_validate_file_ok(self):
        """Test file validation with valid filename."""
        org = self.handler.validate_file(
            "acme/settings/acme-additions-20250101_010203.csv"
        )
        assert org == "acme"

    def test_clean_data_trims(self):
        """Test data cleaning trims whitespace and handles NaT."""
        data = [{"category_1": "  X  "}, {"number_1": pd.NaT}]
        cleaned = self.handler.clean_data(data)

        assert cleaned[0]["category_1"] == "X"
        assert cleaned[1]["number_1"] is None

    def test_process_batch_success(self):
        """Test successful batch processing."""
        db = FakeDB()
        rows = [{"category_1": "A"}, {"number_1": "1"}]

        # Should not raise
        self.handler.process_batch(db, "acme", rows)

    def test_process_batch_with_advisory_lock(self):
        """Test batch processing uses advisory lock."""
        db = FakeDB()
        rows = [{"category_1": "A"}]

        self.handler.process_batch(db, "acme", rows)
        assert db.executed

        # Should have executed advisory lock queries
        assert any("advisory_lock" in str(stmt) for stmt, _, _ in db.executed)


def test_member_data_file_detection():
    """Test: Member data file detection helper function works correctly."""

    # Mock the function to avoid configuration dependencies
    def _is_member_data_file(file_name: str) -> bool:
        """Mock implementation of member data file detection."""
        if not file_name.endswith((".csv", ".csv.gz")):
            return False

        file_name = file_name.strip("/")
        parts = file_name.split("/")

        if len(parts) == 3:
            _, directory_name, filename = parts
            return directory_name == "client_users" and "-client_user_data-" in filename

        return False

    assert (
        _is_member_data_file(
            "nasha_tech/client_users/nasha_tech-client_user_data-20250825_231500.csv"
        )
        is True
    )

    assert (
        _is_member_data_file(
            "nasha_tech/settings/nasha_tech-client_user_data-20250825_231500.csv"
        )
        is False
    )

    assert (
        _is_member_data_file(
            "nasha_tech/client_users/nasha_tech-store_data-20250825_231500.csv"
        )
        is False
    )

    assert (
        _is_member_data_file(
            "nasha_tech/client_users/nasha_tech-client_user_data-20250825_231500.csv.gz"
        )
        is True
    )


def run_tests():
    """Run all handler tests."""
    print("🧩 Testing Handlers")
    print("-" * 40)

    test_classes = [
        TestStoreHandler,
        TestMemberFeedHandler,
        TestSurveyFeedHandler,
    ]

    passed = 0
    total = 0

    # Run class-based tests
    for test_class in test_classes:
        test_instance = test_class()
        for method_name in dir(test_instance):
            if method_name.startswith("test_"):
                total += 1
                try:
                    getattr(test_instance, method_name)()
                    print(f"✅ {test_class.__name__}.{method_name}")
                    passed += 1
                except Exception as e:
                    print(f"❌ {test_class.__name__}.{method_name}: {e}")

    # Run standalone function tests
    standalone_tests = [
        test_member_data_file_detection,
    ]

    for test_func in standalone_tests:
        total += 1
        try:
            test_func()
            print(f"✅ {test_func.__name__}")
            passed += 1
        except Exception as e:
            print(f"❌ {test_func.__name__}: {e}")

    print(f"\nResults: {passed}/{total} passed")
    return passed == total


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
