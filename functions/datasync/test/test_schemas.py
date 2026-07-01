#!/usr/bin/env python3
"""Schema validation tests for Pydantic models."""

import sys
import os
import pytest
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from schemas.survey_feed_columns import SurveyFeedColumns
from schemas.store import StoreCSVData
from schemas.member_feed_columns import MemberFeedColumnAlias


class TestSurveyFeedColumns:
    """Test SurveyFeedColumns schema validation."""

    def test_empty_string_to_none(self):
        """Empty strings convert to None via field validator."""
        data = {"category_1": "", "number_1": "", "datetime_1": ""}
        result = SurveyFeedColumns(**data)

        assert result.category1 is None
        assert result.number1 is None
        assert result.datetime1 is None

    def test_populate_by_name(self):
        """Schema accepts field names with populate_by_name=True."""
        data = {
            "category_1": "test",
            "number_1": "123",
            "datetime_1": "2025-01-01T00:00:00",
        }
        result = SurveyFeedColumns(**data)

        assert result.category1 == "test"
        assert result.number1 == "123"
        assert result.datetime1 == "2025-01-01T00:00:00"


class TestStoreSchemas:
    """Test Store and StoreCSVData schemas."""

    def test_store_csv_data_datetime_parsing(self):
        """StoreCSVData parses ISO datetime strings from snake_case CSV columns."""
        data = {
            "id": 1,
            "name": "Test Store",
            "starts_at": "2025-01-01T10:00:00",
            "ends_at": "2025-01-01T18:00:00",
        }
        result = StoreCSVData(**data)

        assert isinstance(result.startsAt, datetime)
        assert isinstance(result.endsAt, datetime)
        assert result.startsAt.year == 2025
        assert result.endsAt.hour == 18

    def test_store_csv_data_empty_datetime_to_none(self):
        """Empty datetime strings convert to None from snake_case CSV columns."""
        data = {
            "id": 1,
            "name": "Test Store",
            "starts_at": "",
            "ends_at": None,
        }
        result = StoreCSVData(**data)

        assert result.startsAt is None
        assert result.endsAt is None

    def test_store_csv_data_populate_by_name(self):
        production_csv_data = {
            "id": 2,
            "name": "テスト店舗A",
            "type_name": "飲食",
            "area_name": "テスト県A",
            "note": "テスト備考",
            "starts_at": "2025-01-01T10:00:00",
            "ends_at": "",
        }

        result = StoreCSVData(**production_csv_data)

        assert result.id == 2
        assert result.name == "テスト店舗A"
        assert result.typeName == "飲食"
        assert result.areaName == "テスト県A"
        assert result.note == "テスト備考"
        assert result.startsAt.year == 2025
        assert result.startsAt.month == 1
        assert result.endsAt is None

    def test_store_csv_data_backward_compatibility(self):
        production_data = {
            "id": 2,
            "name": "テスト店舗A",
            "type_name": "飲食",
            "area_name": "テスト県A",
            "starts_at": "2025-01-01T10:00:00",
            "ends_at": "",
        }

        result = StoreCSVData(**production_data)

        assert result.typeName == "飲食"
        assert result.areaName == "テスト県A"
        assert result.startsAt.year == 2025
        assert result.startsAt.month == 1
        assert result.startsAt.day == 1
        assert result.endsAt is None

    def test_store_csv_data_camelcase_input_also_works(self):
        camelcase_data = {
            "id": 3,
            "name": "Test Store",
            "typeName": "Retail",
            "areaName": "Downtown",
            "startsAt": "2025-02-01T14:30:00",
            "endsAt": "2025-02-01T16:00:00",
        }

        result = StoreCSVData(**camelcase_data)

        assert result.typeName == "Retail"
        assert result.areaName == "Downtown"
        assert result.startsAt.hour == 14
        assert result.startsAt.minute == 30
        assert result.endsAt.hour == 16

    def test_store_csv_data_mixed_input_formats(self):
        mixed_data = {
            "id": 4,
            "name": "Mixed Store",
            "type_name": "飲食",
            "areaName": "Downtown",
            "starts_at": "2025-03-01T09:00:00",
            "endsAt": "2025-03-01T17:00:00",
        }

        result = StoreCSVData(**mixed_data)

        assert result.typeName == "飲食"
        assert result.areaName == "Downtown"
        assert result.startsAt.hour == 9
        assert result.endsAt.hour == 17

    def test_store_csv_data_corrupted_data_validation(self):
        """StoreCSVData properly validates and rejects corrupted data."""
        from pydantic import ValidationError

        corrupted_cases = [
            {
                "id": "not_an_integer",  # Wrong type for id
                "name": "Test Store",
                "expected_error": "int_parsing"
            },
            {
                "id": 1,
                "name": "",  # Empty required field - this should be allowed for StoreCSVData
            },
            {
                "id": 1,
                "name": "Test Store",
                "starts_at": "invalid-date-format",  # Malformed datetime
                "expected_error": "value_error"
            },
            {
                "id": 1,
                "name": "Test Store",
                "ends_at": "2025-13-45T25:00:00",  # Impossible date
                "expected_error": "value_error"
            }
        ]

        for case in corrupted_cases:
            if "expected_error" in case:
                # Should raise ValidationError for truly invalid data
                with pytest.raises(ValidationError) as exc_info:
                    StoreCSVData(**case)
                assert exc_info.value.error_count() > 0
            else:
                # Should handle gracefully
                result = StoreCSVData(**case)
                assert result.id == 1
                assert result.name == ""  # Empty strings are allowed in StoreCSVData

    def test_store_csv_data_edge_cases(self):
        """StoreCSVData handles various edge cases correctly."""
        edge_cases = [
            {
                "name": "x" * 300,  # Very long name
                "type_name": "A" * 100,  # Very long type
                "area_name": "B" * 200,  # Very long area
            },
            {
                "name": "Valid Name",
                "type_name": "",  # Empty string
                "area_name": None,  # Explicit None
            },
            {
                "name": "Store with Unicode 🔥",
                "type_name": "カフェ & レストラン",  # Unicode with symbols
                "area_name": "東京 23区",  # Unicode with numbers
            }
        ]

        for i, case in enumerate(edge_cases):
            result = StoreCSVData(id=i+10, **case)

            # Verify basic parsing works
            assert result.id == i + 10
            assert isinstance(result.name, str)
            assert result.typeName is None or isinstance(result.typeName, str)
            assert result.areaName is None or isinstance(result.areaName, str)

    def test_store_csv_data_business_logic_validation(self):
        """StoreCSVData validates business rules and data integrity."""
        # Test with realistic business scenarios
        business_scenarios = [
            {
                "id": 1001,
                "name": "Downtown Coffee Shop",
                "type_name": "Food & Beverage",
                "area_name": "Central Business District",
                "starts_at": "2025-01-01T08:00:00",
                "ends_at": "2025-01-01T18:00:00",
            },
            {
                "id": 1002,
                "name": "24/7 Convenience Store",
                "type_name": "Retail",
                "area_name": "Residential Area",
                # No hours - should be valid for 24/7 stores
            },
            {
                "id": 1003,
                "name": "Pop-up Store",
                "type_name": "Temporary",
                "area_name": "Shopping Mall",
                "starts_at": "2025-02-01T10:00:00",
                "ends_at": "2025-02-28T20:00:00",  # Month-end
            }
        ]

        for scenario in business_scenarios:
            result = StoreCSVData(**scenario)

            # Business logic validations
            assert result.id > 0, f"Invalid store ID: {result.id}"
            assert len(result.name.strip()) > 0, "Store name cannot be empty"
            assert result.typeName is None or len(result.typeName.strip()) > 0, "Type cannot be whitespace-only"

            # Time range validation (if both times provided)
            if result.startsAt and result.endsAt:
                assert result.startsAt < result.endsAt, f"Start time {result.startsAt} must be before end time {result.endsAt}"


class TestMemberFeedColumns:
    """Test MemberFeedColumnAlias schema."""

    def test_empty_string_to_none(self):
        """MemberFeedColumnAlias converts empty strings to None."""
        data = {"category_1": "", "number_1": "", "datetime_1": ""}
        result = MemberFeedColumnAlias(**data)

        assert result.category1 is None
        assert result.number1 is None
        assert result.datetime1 is None

    def test_populate_by_name(self):
        """MemberFeedColumnAlias accepts field names with populate_by_name=True."""
        data = {
            "category_1": "test",
            "number_1": "123",
            "datetime_1": "2025-01-01T00:00:00",
        }
        result = MemberFeedColumnAlias(**data)

        assert result.category1 == "test"
        assert result.number1 == "123"
        assert result.datetime1 == "2025-01-01T00:00:00"


def run_tests():
    """Run all schema validation tests."""
    print("📋 Testing Schemas")
    print("-" * 40)

    test_classes = [
        TestSurveyFeedColumns,
        TestStoreSchemas,
        TestMemberFeedColumns,
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
