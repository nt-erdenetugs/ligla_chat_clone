#!/usr/bin/env python3
"""Utility function tests."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestFileValidation:
    """Test file validation utilities."""

    def test_validate_file_stores_valid_path(self):
        """Test stores file validation with valid path."""
        from utils.file_validation import validate_file

        org = validate_file(
            file_name="acme/stores/acme-store_data-20250101_010203.csv",
            directory_name="stores",
            filename_pattern="-store_data-",
        )
        assert org == "acme"

    def test_validate_file_stores_legacy_filename(self):
        """Test stores file validation with legacy filename."""
        from utils.file_validation import validate_file

        org = validate_file(
            file_name="acme-store_data-20250101_010203123.csv",
            directory_name="stores",
            filename_pattern="-store_data-",
        )
        assert org == "acme"

    def test_validate_file_wrong_directory_raises(self):
        """Test file validation raises error for wrong directory."""
        from utils.file_validation import validate_file

        try:
            _ = validate_file(
                file_name="acme/other/acme-store_data-20250101_010203.csv",
                directory_name="stores",
                filename_pattern="-store_data-",
            )
            assert False, "Expected exception"
        except Exception as e:
            assert "Expected directory" in str(e)

    def test_validate_file_invalid_datetime_raises(self):
        """Test file validation raises error for invalid datetime format."""
        from utils.file_validation import validate_file

        try:
            _ = validate_file(
                file_name="acme/stores/acme-store_data-2025-01-01.csv",
                directory_name="stores",
                filename_pattern="-store_data-",
            )
            assert False, "Expected exception"
        except Exception as e:
            assert "format" in str(e)


class TestDataProcessing:
    """Test data processing utilities."""

    def test_process_large_dataset_batches(self):
        """Test large dataset processing creates proper batches."""
        from utils.data_processing import process_large_dataset

        calls = []

        def fake_process(db, org, rows):
            calls.append(rows)

        rows = [{"id": i, "name": f"n{i}"} for i in range(12)]
        process_large_dataset(
            db=None,
            org_name="acme",
            csv_rows=rows,
            process_batch_fn=fake_process,
            max_batch_size=5,
        )

        # Expect 3 batches: 5,5,2
        sizes = [len(b) for b in calls]
        assert sizes == [5, 5, 2]


class TestContextManagers:
    """Test context manager utilities."""

    def test_safe_database_operation_success_updates_status(self):
        """Test safe database operation updates status on success."""
        from utils.context_manager import safe_database_operation
        from logger.logger import ProcessingStatus

        status = ProcessingStatus()
        data = [{"id": 1, "name": "A"}, {"id": 2, "name": "B"}]

        def identity_clean(rows):
            return rows

        with safe_database_operation("op", data, status, identity_clean) as cleaned:
            assert cleaned == data

        assert status.processed_rows == 2
        assert status.failed_rows == 0

    def test_safe_database_operation_exception_raises(self):
        """Test safe database operation raises on failure."""
        from utils.context_manager import safe_database_operation
        from logger.logger import ProcessingStatus, DataProcessingError

        status = ProcessingStatus()
        data = [{"id": 1}]

        def bad_clean(_rows):
            raise RuntimeError("boom")

        try:
            with safe_database_operation("op", data, status, bad_clean):
                pass
            assert False, "Expected exception"
        except DataProcessingError as e:
            assert "Failed op" in str(e)

        # failed should have been incremented
        assert status.failed_rows == 1


class TestCSVUtils:
    """Test CSV utility functions."""

    def test_csv_utils_import(self):
        """Test that CSV utils module can be imported."""
        from utils import csv_utils

        assert csv_utils is not None
        assert hasattr(csv_utils, "read_csv_from_bucket")


def run_tests():
    """Run all utility tests."""
    print("🧪 Testing Utils")
    print("-" * 40)

    test_classes = [
        TestFileValidation,
        TestDataProcessing,
        TestContextManagers,
        TestCSVUtils,
    ]

    passed = 0
    total = 0

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

    print(f"\nResults: {passed}/{total} passed")
    return passed == total


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
