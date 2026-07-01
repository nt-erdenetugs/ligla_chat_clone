import re
from datetime import datetime
from typing import Any

import re2

from app.common.utils import get_logger
from app.db.models import ConditionOperator, LogicalOperator, ValueType
from app.services.receiver import schemas
from app.services.receiver.schemas.chat_assignment_rule import (
    ChatAssignConditionGroupSchema,
    ChatAssignConditionSchema,
    ChatAssignFilterGroupSchema,
    ChatAssignFilterTreeSchema,
)

logger = get_logger(__name__)

ARRAY_DELIMITER = " "
MAX_REGEX_PATTERN_LENGTH = 255
MAX_REGEX_TEXT_LENGTH = 255


def normalize_field_name(field_name: str) -> str:
    """
    Convert field name from rule format to Python attribute format.

    Examples:
        storeIds -> store_ids
        operatorId -> operator_id
    """
    # Handle uppercase patterns (CATEGORY1, NUMBER5, DATETIME25, etc.)
    # Check if the field is all uppercase or mostly uppercase (excluding trailing digits)
    logger.info(f"normalize_field_name called with field_name={field_name}")
    alpha_part = re.match(r"^([A-Z]+)", field_name)
    if alpha_part and alpha_part.group(1) == field_name.rstrip("0123456789"):
        # Insert underscore before any trailing digits, then lowercase
        # CATEGORY1 -> CATEGORY_1 -> category_1
        result = re.sub(r"([A-Z]+)(\d+)$", r"\1_\2", field_name).lower()
        logger.info(f"normalize_field_name result={result}")
        return result

    # Handle camelCase to snake_case (storeIds -> store_ids)
    # Insert underscore before uppercase letters and convert to lowercase
    snake_case = re.sub(r"(?<!^)(?=[A-Z])", "_", field_name).lower()
    logger.info(f"normalize_field_name result={snake_case}")
    return snake_case


def denormalize_field_name(field_name: str) -> str:
    """
    Convert snake_case with trailing number to compact form.

    Examples:
        category_2 -> category2
        number_1 -> number1
    """
    logger.info(f"denormalize_field_name called with field_name={field_name}")
    result = re.sub(r"_(\d+)$", r"\1", field_name)
    logger.info(f"denormalize_field_name result={result}")
    return result


def get_field_value(field_name: str, favorites: schemas.Favorites | None, additions: Any | None) -> Any:
    logger.info(f"get_field_value called with field_name={field_name}")
    field_name_lower = field_name.lower()
    if "store" in field_name_lower or "operator" in field_name_lower:
        _field_name = normalize_field_name(field_name)
    else:
        _field_name = denormalize_field_name(field_name)

    if favorites is not None:
        value = getattr(favorites, _field_name, None)
        if value is not None:
            logger.info("get_field_value returning from favorites")
            return value

    if additions is not None:
        # Handle both dict and Pydantic model
        if isinstance(additions, dict):
            value = additions.get(_field_name, None)
        else:
            value = getattr(additions, _field_name, None)

        if value is not None:
            logger.info("get_field_value returning from additions")
            return value

    logger.info("get_field_value returning None")
    return None


def unwrap_list_value(value: Any, operator: ConditionOperator) -> Any:
    """
    Unwrap list values for scalar comparison operators.

    For operators like EQUAL, GT, LT, etc., if the value is a list:
    - Single element list [42] -> unwrap to 42
    - Multiple element list [42, 24] -> return first element (with warning)
    - Empty list [] -> return None

    For array operators (INCLUDE, VALUES_MATCH_ANY, etc.), keep as list.
    """

    logger.info(f"unwrap_list_value with operator={operator}")
    array_operators = {
        ConditionOperator.VALUES_MATCH_ANY,
        ConditionOperator.VALUES_DO_NOT_MATCH_ANY,
    }

    if operator in array_operators:
        result = value if isinstance(value, list) else [value]
        logger.info("unwrap_list_value result for array operator")
        return result

    if not isinstance(value, list):
        logger.info("unwrap_list_value scalar")
        return value

    # Scalar operators (EQUAL, GT, LT, etc.) with list values - unwrap
    if len(value) == 0:
        logger.info("unwrap_list_value empty list -> None")
        return None
    elif len(value) == 1:
        logger.info("unwrap_list_value as first element")
        return value[0]
    else:
        # Multiple elements - use first element but log warning
        logger.warning(
            "Multiple element list with scalar operator. "
            "Using first element. Consider using array operators (INCLUDE, VALUES_MATCH_ANY) instead."
        )
        return value[0]


def normalize_datetime_value(value: Any, value_type: ValueType) -> Any:
    """
    Normalize ISO datetime string to date string (YYYY-MM-DD).
    If value is not a valid ISO datetime, return it as-is.
    """
    if value_type != ValueType.DATETIME or value is None:
        return value

    try:
        return datetime.fromisoformat(value).date().isoformat()
    except (TypeError, ValueError):
        logger.info("normalize_datetime_value: skip normalization, value is not ISO format")
        return value


def safe_regex_search(pattern: str, text: str) -> bool:
    """
    Safely execute regex search with ReDoS protection using Google's RE2 engine.
    """
    # Enforce input size limits to prevent resource exhaustion
    if len(pattern) > MAX_REGEX_PATTERN_LENGTH:
        logger.warning(f"Regex pattern exceeds maximum length ({MAX_REGEX_PATTERN_LENGTH}): {len(pattern)} characters")
        return False

    if len(text) > MAX_REGEX_TEXT_LENGTH:
        logger.warning(f"Regex text exceeds maximum length ({MAX_REGEX_TEXT_LENGTH}): {len(text)} characters")
        return False

    try:
        return re2.search(pattern, text) is not None
    except re2.error as e:
        logger.error(f"Invalid regex pattern '{pattern}': {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error during RE2 regex search with pattern '{pattern}': {e}")
        return False


def evaluate_condition(
    condition: ChatAssignConditionSchema,
    favorites: schemas.Favorites | None = None,
    additions: Any | None = None,
) -> bool:
    """Evaluate a single condition against the given object."""
    # Get the value from either favorites or additions
    logger.info(f"evaluate_condition called with condition={condition}")
    field_value = get_field_value(condition.field, favorites, additions)
    # Unwrap list values for scalar operators
    unwrapped_value = unwrap_list_value(field_value, condition.operator)
    value = normalize_datetime_value(unwrapped_value, condition.valueType)

    # Convert condition.value based on ValueType
    match condition.valueType:
        case ValueType.NUMBER:
            try:
                condition_val = str(condition.value)
            except (TypeError, ValueError):
                return False
        case ValueType.STRING:
            condition_val = str(condition.value)
        case ValueType.DATETIME:
            condition_val = str(condition.value)
        case ValueType.ARRAY:
            condition_val = condition.value.split(ARRAY_DELIMITER) if condition.value else []
        case ValueType.BOOLEAN:
            condition_val = str(condition.value).lower() in ("true", "1")
        case _:
            logger.warning(f"evaluate_condition: Unknown valueType '{condition.valueType.value}', using raw value")
            condition_val = condition.value

    logger.info(
        f"evaluate_condition comparing value to condition_val={condition_val} with operator={condition.operator}"
    )
    try:
        match condition.operator:
            case ConditionOperator.EQUAL:
                result = str(value) == condition_val
            case ConditionOperator.NOT_EQUAL:
                result = str(value) != condition_val
            case ConditionOperator.INCLUDE:
                result = condition_val in value if isinstance(value, (list, str)) else False
            case ConditionOperator.NOT_INCLUDE:
                result = condition_val not in value if isinstance(value, (list, str)) else True
            case ConditionOperator.GT:
                if condition.valueType == ValueType.NUMBER:
                    result = int(value) > int(condition_val)
                else:
                    result = str(value) > condition_val
            case ConditionOperator.LT:
                if condition.valueType == ValueType.NUMBER:
                    result = int(value) < int(condition_val)
                else:
                    result = str(value) < condition_val
            case ConditionOperator.GTE:
                if condition.valueType == ValueType.NUMBER:
                    result = int(value) >= int(condition_val)
                else:
                    result = str(value) >= condition_val
            case ConditionOperator.LTE:
                if condition.valueType == ValueType.NUMBER:
                    result = int(value) <= int(condition_val)
                else:
                    result = str(value) <= condition_val
            case ConditionOperator.NULL:
                result = value is None
            case ConditionOperator.NOT_NULL:
                result = value is not None
            case ConditionOperator.VALUES_MATCH_ANY:
                result = any(str(v) in condition_val for v in value) if isinstance(value, list) else False
            case ConditionOperator.VALUES_DO_NOT_MATCH_ANY:
                result = all(str(v) not in condition_val for v in value) if isinstance(value, list) else True
            case ConditionOperator.REGEX:
                result = safe_regex_search(condition_val, str(value))
            case _:
                logger.warning(f"evaluate_condition: Unknown operator '{condition.operator.value}'")
                result = False
    except Exception as e:
        logger.error(f"evaluate_condition: Unexpected error during type comparison: {e}")
        return False
    logger.info(f"evaluate_condition result={result}")
    return result


def evaluate_condition_group(
    group: ChatAssignConditionGroupSchema,
    favorites: schemas.Favorites | None = None,
    additions: Any | None = None,
) -> bool:
    """
    Evaluate a condition group (and sub-groups) with logical operators.

    Returns:
        True if group conditions match, False otherwise
    """
    results = []

    for condition in group.conditions:
        results.append(evaluate_condition(condition, favorites, additions))

    for sub_group in group.subGroups:
        results.append(evaluate_condition_group(sub_group, favorites, additions))

    if not results:
        logger.info("evaluate_condition_group no results -> False")
        return False

    match group.logicalOperator:
        case LogicalOperator.AND:
            result = all(results)
        case LogicalOperator.OR:
            result = any(results)
        case _:
            logger.warning(f"Unknown logical operator '{group.logicalOperator.value}' for group {group.id}")
            result = False

    logger.info(f"evaluate_condition_group result={result}")
    return result


def evaluate_filter(
    filter: ChatAssignFilterTreeSchema,
    favorites: schemas.Favorites | None = None,
    additions: Any | None = None,
) -> bool:
    """Evaluate a single filter against the given object."""
    return evaluate_condition_group(filter.rootConditionGroup, favorites, additions)


def evaluate_filter_group(
    group: ChatAssignFilterGroupSchema,
    favorites: schemas.Favorites | None = None,
    additions: Any | None = None,
) -> bool:
    """
    Evaluate a filter group (and sub-groups) with logical operators.

    Returns:
        True if group filters match, False otherwise
    """
    results = []

    for filter in group.filters:
        results.append(evaluate_filter(filter, favorites, additions))

    for sub_group in group.subGroups:
        results.append(evaluate_filter_group(sub_group, favorites, additions))

    if not results:
        logger.info("evaluate_filter_group no results -> False")
        return False

    match group.logicalOperator:
        case LogicalOperator.AND:
            result = all(results)
        case LogicalOperator.OR:
            result = any(results)
        case _:
            logger.warning(f"Unknown logical operator '{group.logicalOperator.value}' for group {group.id}")
            result = False

    logger.info(f"evaluate_filter_group result={result}")
    return result
