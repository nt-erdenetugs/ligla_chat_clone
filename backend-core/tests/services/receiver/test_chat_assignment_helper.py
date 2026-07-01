#!/usr/bin/env python3
"""Unit tests for chat assignment helper functions."""

import uuid
from datetime import datetime

from app.db.models import ConditionOperator, LogicalOperator, ValueType
from app.services.receiver.helper.chat_assignment import (
    evaluate_condition,
    evaluate_condition_group,
    evaluate_filter,
    evaluate_filter_group,
    get_field_value,
    normalize_datetime_value,
    normalize_field_name,
    safe_regex_search,
)
from app.services.receiver.schemas.chat_assignment_rule import (
    ChatAssignConditionGroupSchema,
    ChatAssignConditionSchema,
    ChatAssignFilterGroupSchema,
    ChatAssignFilterTreeSchema,
)
from app.services.receiver.schemas.message import Favorites


class TestConditionEvaluation:
    """Test condition evaluation logic."""

    def test_condition_equal_string(self):
        """Test string equality matching."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        additions = {"category1": "test"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        additions = {"category1": "other"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_not_equal_string(self):
        """Test string inequality."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.NOT_EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        additions = {"category1": "other"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        additions = {"category1": "test"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_include_string(self):
        """Test substring inclusion."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.INCLUDE,
            value="KEY",
            valueType=ValueType.STRING,
        )
        additions = {"category1": "random_KEY_random"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        additions = {"category1": "random__random"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_not_include_string(self):
        """Test substring exclusion."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.NOT_INCLUDE,
            value="BLOCK",
            valueType=ValueType.STRING,
        )
        additions = {"category1": "test"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        additions = {"category1": "random_BLOCK"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_regex_match(self):
        """Test regex pattern matching (email, alphabet-only)."""
        # Email regex
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_4",
            operator=ConditionOperator.REGEX,
            value="^[A-Za-z0-9]+@[A-Za-z0-9]+\\.[A-Za-z0-9]+$",
            valueType=ValueType.STRING,
        )
        additions = {"category4": "user@ligla.com"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        additions = {"category4": "user"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

        # Alphabet-only regex
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_5",
            operator=ConditionOperator.REGEX,
            value="^[A-Za-z]+$",
            valueType=ValueType.STRING,
        )
        additions = {"category5": "abc"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        additions = {"category5": "abc123"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_regex_invalid_pattern(self):
        """Test invalid regex handling."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.REGEX,
            value="[invalid(regex",
            valueType=ValueType.STRING,
        )
        additions = {"category1": "test"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_regex_too_long(self):
        """Test ReDoS protection (pattern > 255 chars)."""
        long_pattern = "a" * 256
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.REGEX,
            value=long_pattern,
            valueType=ValueType.STRING,
        )
        additions = {"category1": "test"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_gt_number(self):
        """Test numeric greater than (string comparison)."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="number_10",
            operator=ConditionOperator.GT,
            value="10",
            valueType=ValueType.NUMBER,
        )
        # Note: Implementation uses string comparison, so "11" > "10" = True
        additions = {"number10": "11"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        # String comparison: "10" > "10" = False
        additions = {"number10": "10"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

        # String comparison: "9" > "10" = False (lexicographic: "9" < "1")
        additions = {"number10": "9"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_lt_number(self):
        """Test numeric less than (string comparison)."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="number_11",
            operator=ConditionOperator.LT,
            value="20",
            valueType=ValueType.NUMBER,
        )
        # Note: Implementation uses string comparison, so "19" < "20" = True
        additions = {"number11": "19"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        # String comparison: "20" < "20" = False
        additions = {"number11": "20"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_gte_number(self):
        """Test numeric greater than or equal (string comparison)."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="number_12",
            operator=ConditionOperator.GTE,
            value="15",
            valueType=ValueType.NUMBER,
        )
        # String comparison: "15" >= "15" = True
        additions = {"number12": "15"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        # String comparison: "16" >= "15" = True
        additions = {"number12": "16"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        # String comparison: "14" >= "15" = False (lexicographic: "1" < "1" then "4" < "5")
        additions = {"number12": "14"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_lte_number(self):
        """Test numeric less than or equal (string comparison)."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="number_13",
            operator=ConditionOperator.LTE,
            value="19",
            valueType=ValueType.NUMBER,
        )
        # String comparison: "19" <= "19" = True
        additions = {"number13": "19"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        # String comparison: "18" <= "19" = True
        additions = {"number13": "18"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        # String comparison: "20" <= "19" = False (lexicographic: "2" > "1")
        additions = {"number13": "20"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_values_match_any(self):
        """Test array contains any value."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1 2",
            valueType=ValueType.ARRAY,
        )
        favorites = Favorites(storeIds=[1, 2])
        result = evaluate_condition(condition, favorites, None)
        assert result is True

        favorites = Favorites(storeIds=[1])
        result = evaluate_condition(condition, favorites, None)
        assert result is True

        favorites = Favorites(storeIds=[3])
        result = evaluate_condition(condition, favorites, None)
        assert result is False

    def test_condition_values_do_not_match_any(self):
        """Test array excludes all values."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_DO_NOT_MATCH_ANY,
            value="2 3",
            valueType=ValueType.ARRAY,
        )
        favorites = Favorites(storeIds=[9, 11])
        result = evaluate_condition(condition, favorites, None)
        assert result is True

        favorites = Favorites(storeIds=[1, 2])
        result = evaluate_condition(condition, favorites, None)
        assert result is False

    def test_condition_null(self):
        """Test null value check."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_2",
            operator=ConditionOperator.NULL,
            value=None,
            valueType=ValueType.STRING,
        )
        # Empty string is treated as None by get_field_value when missing
        additions = {"category2": ""}
        result = evaluate_condition(condition, None, additions)
        # Empty string is not None, so NULL check fails
        assert result is False

        additions = {}
        result = evaluate_condition(condition, None, additions)
        assert result is True

        additions = {"category2": "test"}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_not_null(self):
        """Test non-null value check."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.NOT_NULL,
            value=None,
            valueType=ValueType.ARRAY,
        )
        favorites = Favorites(storeIds=[1])
        result = evaluate_condition(condition, favorites, None)
        assert result is True

        favorites = Favorites(storeIds=[])
        result = evaluate_condition(condition, favorites, None)
        assert result is False

    def test_condition_empty_string_to_none(self):
        """Test empty string normalization."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_2",
            operator=ConditionOperator.NULL,
            value=None,
            valueType=ValueType.STRING,
        )
        # Empty string is not None, so NULL check fails
        additions = {"category2": ""}
        result = evaluate_condition(condition, None, additions)
        assert result is False

    def test_condition_datetime_normalization(self):
        """Test ISO datetime to date conversion."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="datetime_1",
            operator=ConditionOperator.EQUAL,
            value="2025-12-11",
            valueType=ValueType.DATETIME,
        )
        additions = {"datetime1": "2025-12-11T10:00:00"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

    def test_condition_field_name_normalization(self):
        """Test camelCase to snake_case conversion."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="storeIds",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1",
            valueType=ValueType.ARRAY,
        )
        favorites = Favorites(storeIds=[1])
        result = evaluate_condition(condition, favorites, None)
        assert result is True

    def test_condition_field_name_denormalization(self):
        """Test category_1 to category1."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        additions = {"category1": "test"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

    def test_condition_store_ids_from_favorites(self):
        """Test store IDs from favorites."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1 2",
            valueType=ValueType.ARRAY,
        )
        favorites = Favorites(storeIds=[1, 2])
        result = evaluate_condition(condition, favorites, None)
        assert result is True

    def test_condition_survey_from_additions(self):
        """Test survey fields from additions dict."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        additions = {"category1": "test"}
        result = evaluate_condition(condition, None, additions)
        assert result is True

    def test_condition_missing_field_returns_none(self):
        """Test missing field handling."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="nonexistent_field",
            operator=ConditionOperator.NULL,
            value=None,
            valueType=ValueType.STRING,
        )
        result = evaluate_condition(condition, None, {})
        assert result is True


class TestConditionGroupEvaluation:
    """Test condition group evaluation logic."""

    def test_condition_group_and_all_true(self):
        """Test AND with all conditions true."""
        condition1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        condition2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="number_1",
            operator=ConditionOperator.EQUAL,
            value="1",
            valueType=ValueType.NUMBER,
        )
        group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition1, condition2],
            subGroups=[],
        )
        additions = {"category1": "test", "number1": "1"}
        result = evaluate_condition_group(group, None, additions)
        assert result is True

    def test_condition_group_and_one_false(self):
        """Test AND with one condition false."""
        condition1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        condition2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="number_1",
            operator=ConditionOperator.EQUAL,
            value="1",
            valueType=ValueType.NUMBER,
        )
        group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition1, condition2],
            subGroups=[],
        )
        additions = {"category1": "test", "number1": "2"}
        result = evaluate_condition_group(group, None, additions)
        assert result is False

    def test_condition_group_or_one_true(self):
        """Test OR with one condition true."""
        condition1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        condition2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_2",
            operator=ConditionOperator.INCLUDE,
            value="KEY",
            valueType=ValueType.STRING,
        )
        group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.OR,
            isRoot=True,
            conditions=[condition1, condition2],
            subGroups=[],
        )
        additions = {"category1": "other", "category2": "random_KEY_random"}
        result = evaluate_condition_group(group, None, additions)
        assert result is True

    def test_condition_group_or_all_false(self):
        """Test OR with all conditions false."""
        condition1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        condition2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_2",
            operator=ConditionOperator.INCLUDE,
            value="KEY",
            valueType=ValueType.STRING,
        )
        group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.OR,
            isRoot=True,
            conditions=[condition1, condition2],
            subGroups=[],
        )
        additions = {"category1": "other", "category2": "random__random"}
        result = evaluate_condition_group(group, None, additions)
        assert result is False

    def test_condition_group_nested_and_or(self):
        """Test nested AND/OR groups."""
        inner_condition1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="number_1",
            operator=ConditionOperator.EQUAL,
            value="1",
            valueType=ValueType.NUMBER,
        )
        inner_condition2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="datetime_1",
            operator=ConditionOperator.NOT_EQUAL,
            value="2025-12-11",
            valueType=ValueType.DATETIME,
        )
        inner_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=False,
            conditions=[inner_condition1, inner_condition2],
            subGroups=[],
        )
        outer_condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        outer_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[outer_condition],
            subGroups=[inner_group],
        )
        additions = {"category1": "test", "number1": "1", "datetime1": "2025-10-10"}
        result = evaluate_condition_group(outer_group, None, additions)
        assert result is True

    def test_condition_group_empty_returns_false(self):
        """Test empty group handling."""
        group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[],
            subGroups=[],
        )
        result = evaluate_condition_group(group, None, {})
        assert result is False

    def test_condition_group_deeply_nested(self):
        """Test deep nesting (3+ levels)."""
        level3_condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="number_1",
            operator=ConditionOperator.EQUAL,
            value="1",
            valueType=ValueType.NUMBER,
        )
        level3_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=False,
            conditions=[level3_condition],
            subGroups=[],
        )
        level2_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.OR,
            isRoot=False,
            conditions=[],
            subGroups=[level3_group],
        )
        level1_condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        level1_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[level1_condition],
            subGroups=[level2_group],
        )
        additions = {"category1": "test", "number1": "1"}
        result = evaluate_condition_group(level1_group, None, additions)
        assert result is True


class TestFilterEvaluation:
    """Test filter evaluation logic."""

    def test_filter_evaluates_root_condition_group(self):
        """Test filter delegates to condition group."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        root_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition],
            subGroups=[],
        )
        filter_tree = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Test Filter",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_group,
        )
        additions = {"category1": "test"}
        result = evaluate_filter(filter_tree, None, additions)
        assert result is True

    def test_filter_with_multiple_conditions(self):
        """Test multiple conditions in filter."""
        condition1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        condition2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="number_1",
            operator=ConditionOperator.EQUAL,
            value="1",
            valueType=ValueType.NUMBER,
        )
        root_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition1, condition2],
            subGroups=[],
        )
        filter_tree = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Test Filter",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_group,
        )
        additions = {"category1": "test", "number1": "1"}
        result = evaluate_filter(filter_tree, None, additions)
        assert result is True


class TestFilterGroupEvaluation:
    """Test filter group evaluation logic."""

    def test_filter_group_and_all_match(self):
        """Test AND with all filters matching."""
        condition1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        root_group1 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition1],
            subGroups=[],
        )
        filter1 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 1",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_group1,
        )

        condition2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_2",
            operator=ConditionOperator.INCLUDE,
            value="KEY",
            valueType=ValueType.STRING,
        )
        root_group2 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition2],
            subGroups=[],
        )
        filter2 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 2",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_group2,
        )

        filter_group = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            filters=[filter1, filter2],
            subGroups=[],
        )
        additions = {"category1": "test", "category2": "random_KEY_random"}
        result = evaluate_filter_group(filter_group, None, additions)
        assert result is True

    def test_filter_group_or_one_matches(self):
        """Test OR with one filter matching."""
        condition1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        root_group1 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition1],
            subGroups=[],
        )
        filter1 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 1",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_group1,
        )

        condition2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_2",
            operator=ConditionOperator.INCLUDE,
            value="KEY",
            valueType=ValueType.STRING,
        )
        root_group2 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition2],
            subGroups=[],
        )
        filter2 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 2",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_group2,
        )

        filter_group = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.OR,
            isRoot=True,
            filters=[filter1, filter2],
            subGroups=[],
        )
        additions = {"category1": "other", "category2": "random_KEY_random"}
        result = evaluate_filter_group(filter_group, None, additions)
        assert result is True

    def test_filter_group_nested_structure(self):
        """Test nested filter groups."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        root_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition],
            subGroups=[],
        )
        filter1 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 1",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_group,
        )

        inner_group = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.OR,
            isRoot=False,
            filters=[filter1],
            subGroups=[],
        )

        outer_group = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            filters=[],
            subGroups=[inner_group],
        )
        additions = {"category1": "test"}
        result = evaluate_filter_group(outer_group, None, additions)
        assert result is True

    def test_filter_group_empty_returns_false(self):
        """Test empty filter group."""
        filter_group = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            filters=[],
            subGroups=[],
        )
        result = evaluate_filter_group(filter_group, None, {})
        assert result is False


class TestFieldValueExtraction:
    """Test field value extraction logic."""

    def test_get_field_value_from_favorites(self):
        """Test store/operator fields from favorites."""
        favorites = Favorites(storeIds=[1, 2], operatorId=uuid.uuid4())
        value = get_field_value("store_ids", favorites, None)
        assert value == [1, 2]

        value = get_field_value("operator_id", favorites, None)
        assert value == favorites.operator_id

    def test_get_field_value_from_additions(self):
        """Test survey fields from additions."""
        additions = {"category1": "test", "number1": 1}
        value = get_field_value("category_1", None, additions)
        assert value == "test"

        value = get_field_value("number_1", None, additions)
        assert value == 1

    def test_get_field_value_favorites_priority(self):
        """Test favorites takes priority over additions."""
        favorites = Favorites(storeIds=[1, 2])
        additions = {"store_ids": [3, 4]}
        value = get_field_value("store_ids", favorites, additions)
        assert value == [1, 2]

    def test_get_field_value_missing_returns_none(self):
        """Test missing field returns None."""
        value = get_field_value("nonexistent", None, {})
        assert value is None


class TestUtilityFunctions:
    """Test utility functions."""

    def test_normalize_field_name_camelcase(self):
        """Test camelCase to snake_case conversion."""
        result = normalize_field_name("storeIds")
        assert result == "store_ids"

        result = normalize_field_name("operatorId")
        assert result == "operator_id"

    def test_normalize_field_name_uppercase_with_digits(self):
        """Test CATEGORY1 to category_1 conversion."""
        result = normalize_field_name("CATEGORY1")
        assert result == "category_1"

        result = normalize_field_name("NUMBER5")
        assert result == "number_5"

    def test_normalize_datetime_value_iso(self):
        """Test ISO datetime normalization."""
        result = normalize_datetime_value("2025-12-11T10:00:00", ValueType.DATETIME)
        assert result == "2025-12-11"

    def test_normalize_datetime_value_non_datetime(self):
        """Test non-datetime values pass through."""
        result = normalize_datetime_value("test", ValueType.STRING)
        assert result == "test"

    def test_safe_regex_search_valid(self):
        """Test valid regex search."""
        result = safe_regex_search("^[A-Za-z]+$", "abc")
        assert result is True

        result = safe_regex_search("^[A-Za-z]+$", "abc123")
        assert result is False

        # Test ReDoS protection
        result = safe_regex_search("(a+)+$", "aaaaaaaaaaaaaaaaaaaaaaaaX")
        assert result is False

    def test_safe_regex_search_invalid_pattern(self):
        """Test invalid regex pattern."""
        result = safe_regex_search("[invalid(regex", "test")
        assert result is False

    def test_safe_regex_search_too_long_pattern(self):
        """Test pattern length limit."""
        long_pattern = "a" * 256
        result = safe_regex_search(long_pattern, "test")
        assert result is False

    def test_safe_regex_search_too_long_text(self):
        """Test text length limit."""
        long_text = "a" * 256
        result = safe_regex_search("pattern", long_text)
        assert result is False
