#!/usr/bin/env python3

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from app.db.models import Chat, ConditionOperator, LogicalOperator, RoleType, Team, ValueType
from app.services.receiver.repository.chat_assignment import (
    ChatAssignmentResult,
    ChatAssignmentType,
    CRUDChatAssignment,
)
from app.services.receiver.schemas.chat_assignment_rule import (
    ChatAssignConditionGroupSchema,
    ChatAssignConditionSchema,
    ChatAssignFilterGroupSchema,
    ChatAssignFilterTreeSchema,
    ChatAssignRuleTreeSchema,
)
from app.services.receiver.schemas.message import Favorites


def assert_assignment(
    result: ChatAssignmentResult,
    assignment_type: ChatAssignmentType,
    *,
    operator_id: uuid.UUID | None = None,
    team_ids: list[uuid.UUID] | None = None,
    rule_ids: list[uuid.UUID] | None = None,
) -> None:
    assert isinstance(result, ChatAssignmentResult)
    assert result.success is True
    assert result.assignment_type == assignment_type
    if operator_id is not None:
        assert result.operator_id == operator_id
    if team_ids is not None:
        assert set(result.team_ids) == set(team_ids)
    if rule_ids is not None:
        assert set(result.rule_ids) == set(rule_ids)


class TestQARuleBasedAssignment:
    """QA test cases for rule-based assignment from QA document."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        return db

    @pytest.fixture
    def mock_chat(self):
        """Create a mock chat."""
        chat = MagicMock(spec=Chat)
        chat.id = uuid.uuid4()
        chat.assignedUserId = None
        return chat

    def _create_rule_1(self, rule_team_id: uuid.UUID) -> ChatAssignRuleTreeSchema:
        """Create Rule 1: AND(F1) where F1 = AND(store_ids includes any [1], OR(store_ids includes any [2], store_ids notEmpty))."""
        # Filter 1: AND(store_ids includes any [1], OR(store_ids includes any [2], store_ids notEmpty))
        condition1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1",
            valueType=ValueType.ARRAY,
        )
        condition2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="2",
            valueType=ValueType.ARRAY,
        )
        condition3 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.NOT_NULL,
            value="",
            valueType=ValueType.ARRAY,
        )

        # OR group: OR(store_ids includes any [2], store_ids notEmpty)
        or_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.OR,
            isRoot=False,
            conditions=[condition2, condition3],
            subGroups=[],
        )

        # Root AND group: AND(store_ids includes any [1], OR(...))
        root_condition_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition1],
            subGroups=[or_group],
        )

        filter_tree = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 1",
            targetTable="Store",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_condition_group,
        )

        root_filter_group = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            filters=[filter_tree],
            subGroups=[],
        )

        return ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Rule 1",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[rule_team_id],
            rootFilterGroup=root_filter_group,
        )

    def test_qa_rule1_r1_1(self, mock_db, mock_chat):
        """QA R1-1: storeIds=[1,2] should match Rule 1 and assign to Rule 1 Team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_1(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[1, 2])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]  # Rule matches
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_eval_rules.assert_called_once()
            mock_batch_assign.assert_called_once_with(mock_db, mock_chat, [rule])
            mock_assign_default.assert_not_called()

    def test_qa_rule1_r1_2(self, mock_db, mock_chat):
        """QA R1-2: storeIds=[2] should NOT match Rule 1, assign to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_1(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[2])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []  # No matches
            mock_batch_assign.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_eval_rules.assert_called_once()
            mock_assign_default.assert_called_once_with(mock_db, mock_chat.id, "test_org", remove_outdated_teams=True)

    def test_qa_rule1_r1_3(self, mock_db, mock_chat):
        """QA R1-3: storeIds=[1] should match Rule 1 and assign to Rule 1 Team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_1(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[1])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]  # Rule matches
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule1_r1_4(self, mock_db, mock_chat):
        """QA R1-4: storeIds=[99] should NOT match Rule 1, assign to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_1(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[99])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []  # No matches

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()

    def test_qa_rule1_r1_5(self, mock_db, mock_chat):
        """QA R1-5: storeIds=[] should NOT match Rule 1, assign to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_1(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []  # No matches

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()

    def _create_rule_2(self, rule_team_id: uuid.UUID) -> ChatAssignRuleTreeSchema:
        """Create Rule 2: OR(F2, F3) where F2 = AND(category_1 equals test, AND(number_1 equals 1, datetime_1 not equals 2025-12-11)) and F3 = AND(category_2 includes KEY)."""
        # Filter 2: AND(category_1 equals test, AND(number_1 equals 1, datetime_1 not equals 2025-12-11))
        condition_f2_1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        condition_f2_2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="number_1",
            operator=ConditionOperator.EQUAL,
            value="1",
            valueType=ValueType.NUMBER,
        )
        condition_f2_3 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="datetime_1",
            operator=ConditionOperator.NOT_EQUAL,
            value="2025-12-11",
            valueType=ValueType.DATETIME,
        )

        # Nested AND group: AND(number_1 equals 1, datetime_1 not equals 2025-12-11)
        nested_and_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=False,
            conditions=[condition_f2_2, condition_f2_3],
            subGroups=[],
        )

        # Root AND group for Filter 2
        root_condition_group_f2 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition_f2_1],
            subGroups=[nested_and_group],
        )

        filter_tree_f2 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 2",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_condition_group_f2,
        )

        # Filter 3: AND(category_2 includes KEY)
        condition_f3_1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_2",
            operator=ConditionOperator.INCLUDE,
            value="KEY",
            valueType=ValueType.STRING,
        )

        root_condition_group_f3 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition_f3_1],
            subGroups=[],
        )

        filter_tree_f3 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 3",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_condition_group_f3,
        )

        # Root OR group: OR(F2, F3)
        root_filter_group = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.OR,
            isRoot=True,
            filters=[filter_tree_f2, filter_tree_f3],
            subGroups=[],
        )

        return ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Rule 2",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[rule_team_id],
            rootFilterGroup=root_filter_group,
        )

    def test_qa_rule2_r2_1(self, mock_db, mock_chat):
        """QA R2-1: Both F2 and F3 match, should assign to Rule 2 Team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_2(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "category1": "test",
            "category2": "random_KEY_random",
            "number1": "1",
            "datetime1": "2025-10-10",
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]  # Rule matches
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule2_r2_2(self, mock_db, mock_chat):
        """QA R2-2: F2 fails but F3 matches, should assign to Rule 2 Team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_2(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "category1": "test",
            "category2": "random_KEYYYY_random",
            "number1": "1",
            "datetime1": "2025-12-11",  # This makes F2 fail
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]  # Rule matches via F3
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule2_r2_3(self, mock_db, mock_chat):
        """QA R2-3: Both F2 and F3 fail, should assign to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_2(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "category1": "test",
            "category2": "random__random",  # No KEY
            "number1": "1",
            "datetime1": "2025-12-11",  # This makes F2 fail
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []  # No matches

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()

    def test_qa_rule2_r2_4(self, mock_db, mock_chat):
        """QA R2-4: Only F3 matches (category_2=KEY), should assign to Rule 2 Team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_2(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {"category2": "KEY"}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]  # Rule matches via F3
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule2_r2_5(self, mock_db, mock_chat):
        """QA R2-5: Empty additions, both F2 and F3 fail, should assign to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_2(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []  # No matches

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()

    def _create_rule_3(self, rule_team_id: uuid.UUID) -> ChatAssignRuleTreeSchema:
        """Create Rule 3: AND(F4) where F4 = OR(store_ids includes any [1], store_ids not includes any [2,3], store_ids empty)."""
        condition1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1",
            valueType=ValueType.ARRAY,
        )
        condition2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_DO_NOT_MATCH_ANY,
            value="2 3",
            valueType=ValueType.ARRAY,
        )
        condition3 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.NULL,
            value="",
            valueType=ValueType.ARRAY,
        )

        root_condition_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.OR,
            isRoot=True,
            conditions=[condition1, condition2, condition3],
            subGroups=[],
        )

        filter_tree = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 4",
            targetTable="Store",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_condition_group,
        )

        root_filter_group = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            filters=[filter_tree],
            subGroups=[],
        )

        return ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Rule 3",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[rule_team_id],
            rootFilterGroup=root_filter_group,
        )

    def test_qa_rule3_r3_1(self, mock_db, mock_chat):
        """QA R3-1: storeIds=[1] should match Rule 3."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_3(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[1])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule3_r3_2(self, mock_db, mock_chat):
        """QA R3-2: storeIds=[1,2] should match Rule 3 (first condition matches)."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_3(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[1, 2])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule3_r3_3(self, mock_db, mock_chat):
        """QA R3-3: storeIds=[2,3] should NOT match Rule 3."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_3(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[2, 3])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()

    def test_qa_rule3_r3_4(self, mock_db, mock_chat):
        """QA R3-4: storeIds=[9,11] should match Rule 3 (second condition matches)."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_3(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[9, 11])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule3_r3_5(self, mock_db, mock_chat):
        """QA R3-5: storeIds=[] should match Rule 3 (third condition matches)."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_3(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()


class TestQAStoreTeamAssignment:
    """QA test cases for store/team assignment."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        return db

    @pytest.fixture
    def mock_chat(self):
        """Create a mock chat."""
        chat = MagicMock(spec=Chat)
        chat.id = uuid.uuid4()
        chat.assignedUserId = None
        return chat

    def test_qa_store_s1(self, mock_db, mock_chat):
        """QA S-1: storeIds=[1] should assign to Team 1 and Team 2."""
        crud = CRUDChatAssignment(None)
        favorites = Favorites(operatorId="", storeIds=[1])
        additions = {}

        team1 = MagicMock(spec=Team)
        team1.id = uuid.uuid4()
        team1.name = "Team 1"
        team2 = MagicMock(spec=Team)
        team2.id = uuid.uuid4()
        team2.name = "Team 2"

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.store.validate_store_ids"
            ) as mock_validate_store_ids,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.team.get_teams_by_store_ids"
            ) as mock_get_teams,
            patch.object(crud, "get_assignments_by_chat") as mock_get_assignments,
            patch.object(crud, "_assign_to_team") as mock_assign_team,
        ):
            mock_get.return_value = mock_chat
            mock_validate_store_ids.return_value = [1]
            mock_get_teams.return_value = [team1, team2]
            mock_get_assignments.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.STORE_TEAM,
                team_ids=[team1.id, team2.id],
            )
            assert mock_assign_team.call_count == 2  # Both teams assigned

    def test_qa_store_s2(self, mock_db, mock_chat):
        """QA S-2: storeIds=[2] should assign to Team 3."""
        crud = CRUDChatAssignment(None)
        favorites = Favorites(operatorId="", storeIds=[2])
        additions = {}

        team3 = MagicMock(spec=Team)
        team3.id = uuid.uuid4()
        team3.name = "Team 3"

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.store.validate_store_ids"
            ) as mock_validate_store_ids,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.team.get_teams_by_store_ids"
            ) as mock_get_teams,
            patch.object(crud, "get_assignments_by_chat") as mock_get_assignments,
            patch.object(crud, "_assign_to_team") as mock_assign_team,
        ):
            mock_get.return_value = mock_chat
            mock_validate_store_ids.return_value = [2]
            mock_get_teams.return_value = [team3]
            mock_get_assignments.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.STORE_TEAM,
                team_ids=[team3.id],
            )
            mock_assign_team.assert_called_once_with(mock_db, mock_chat.id, team3)

    def test_qa_store_s3(self, mock_db, mock_chat):
        """QA S-3: Invalid storeIds=[123] should fallback to rule-based assignment."""
        crud = CRUDChatAssignment(None)
        favorites = Favorites(operatorId="", storeIds=[123])
        additions = {}

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.store.validate_store_ids"
            ) as mock_validate_store_ids,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_validate_store_ids.return_value = []  # No valid stores
            mock_get_rule_ids.return_value = []  # No active rules

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()


class TestQAOperatorAssignment:
    """QA test cases for operator assignment."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        return db

    @pytest.fixture
    def mock_chat(self):
        """Create a mock chat."""
        chat = MagicMock(spec=Chat)
        chat.id = uuid.uuid4()
        chat.assignedUserId = None
        return chat

    def test_qa_operator_o1(self, mock_db, mock_chat):
        """QA O-1: Valid operator should be assigned to chat and operator's team."""
        crud = CRUDChatAssignment(None)
        operator_id = uuid.UUID("28dd5d8f-7447-4ddf-8768-d552bbe0050e")
        favorites = Favorites(operatorId=str(operator_id), storeIds=[])

        operator = MagicMock()
        operator.id = operator_id
        operator.roleType = RoleType.OPERATOR
        operator.displayName = "Ebi"
        operator.email = "ebi@example.com"

        team = MagicMock(spec=Team)
        team.id = uuid.uuid4()
        team.name = "Ebi's Team"

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.operator.get_by_organization"
            ) as mock_get_operator,
            patch("app.services.receiver.repository.chat_assignment.repository.operator.is_active") as mock_is_active,
            patch("app.services.receiver.repository.chat_assignment.repository.operator.get_teams") as mock_get_teams,
            patch.object(crud, "_assign_to_operator") as mock_assign_op,
            patch.object(crud, "get_assignments_by_chat") as mock_get_assignments,
            patch.object(crud, "_assign_to_team") as mock_assign_team,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.chat_activity.save_activity_to_db"
            ) as mock_save_activity,
        ):
            mock_get.return_value = mock_chat
            mock_get_operator.return_value = operator
            mock_is_active.return_value = True
            mock_get_teams.return_value = [team]
            mock_get_assignments.return_value = []
            mock_save_activity.return_value = MagicMock()

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                None,
            )

            assert_assignment(
                result,
                ChatAssignmentType.DIRECT_OPERATOR,
                operator_id=operator_id,
                team_ids=[team.id],
            )
            mock_assign_op.assert_called_once()

    def test_qa_operator_o2(self, mock_db, mock_chat):
        """QA O-2: Manager/Admin operator should NOT be assigned, fallback to store/team assignment."""
        crud = CRUDChatAssignment(None)
        operator_id = uuid.uuid4()
        favorites = Favorites(operatorId="2", storeIds=[])

        operator = MagicMock()
        operator.id = operator_id
        operator.roleType = RoleType.ADMIN  # Admin role
        operator.displayName = "Admin"
        operator.email = "admin@example.com"

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.operator.get_by_organization"
            ) as mock_get_operator,
            patch("app.services.receiver.repository.chat_assignment.repository.operator.is_active") as mock_is_active,
            patch.object(crud, "_assign_to_operator") as mock_assign_op,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.store.validate_store_ids"
            ) as mock_validate_store_ids,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_operator.return_value = operator
            mock_is_active.return_value = True
            mock_validate_store_ids.return_value = []  # No valid stores
            mock_get_rule_ids.return_value = []  # No active rules

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                None,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_op.assert_not_called()  # Should skip operator assignment
            mock_assign_default.assert_called_once()  # Fallback to default team

    def test_qa_operator_o3(self, mock_db, mock_chat):
        """QA O-3: Non-existent operator should fallback to store/team assignment."""
        crud = CRUDChatAssignment(None)
        favorites = Favorites(operatorId="123", storeIds=[])

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.operator.get_by_organization"
            ) as mock_get_operator,
            patch.object(crud, "_assign_to_operator") as mock_assign_op,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.store.validate_store_ids"
            ) as mock_validate_store_ids,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_operator.return_value = None  # Operator not found
            mock_validate_store_ids.return_value = []  # No valid stores
            mock_get_rule_ids.return_value = []  # No active rules

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                None,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_op.assert_not_called()  # Should skip operator assignment
            mock_assign_default.assert_called_once()  # Fallback to default team


class TestQARule4:
    """QA test cases for Rule 4 with complex nested filters."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        return db

    @pytest.fixture
    def mock_chat(self):
        """Create a mock chat."""
        chat = MagicMock(spec=Chat)
        chat.id = uuid.uuid4()
        chat.assignedUserId = None
        return chat

    def _create_rule_4(self, rule_team_id: uuid.UUID) -> ChatAssignRuleTreeSchema:
        """Create Rule 4: OR(F5, AND(F6, F7)) where F5 = OR(category_1 not includes BLOCK, AND(category_2 empty, category_3 not empty)), F6 = AND(category_4 matches regex email), F7 = AND(category_5 matches regex alphabet)."""
        # Filter 5: OR(category_1 not includes BLOCK, AND(category_2 empty, category_3 not empty))
        condition_f5_1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.NOT_INCLUDE,
            value="BLOCK",
            valueType=ValueType.STRING,
        )
        condition_f5_2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_2",
            operator=ConditionOperator.NULL,
            value="",
            valueType=ValueType.STRING,
        )
        condition_f5_3 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_3",
            operator=ConditionOperator.NOT_NULL,
            value="",
            valueType=ValueType.STRING,
        )

        nested_and_f5 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=False,
            conditions=[condition_f5_2, condition_f5_3],
            subGroups=[],
        )

        root_condition_group_f5 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.OR,
            isRoot=True,
            conditions=[condition_f5_1],
            subGroups=[nested_and_f5],
        )

        filter_tree_f5 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 5",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_condition_group_f5,
        )

        # Filter 6: AND(category_4 matches regex email)
        condition_f6 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_4",
            operator=ConditionOperator.REGEX,
            value="^[A-Za-z0-9]+@[A-Za-z0-9]+\\.[A-Za-z0-9]+$",
            valueType=ValueType.STRING,
        )

        root_condition_group_f6 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition_f6],
            subGroups=[],
        )

        filter_tree_f6 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 6",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_condition_group_f6,
        )

        # Filter 7: AND(category_5 matches regex alphabet)
        condition_f7 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_5",
            operator=ConditionOperator.REGEX,
            value="^[A-Za-z]+$",
            valueType=ValueType.STRING,
        )

        root_condition_group_f7 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition_f7],
            subGroups=[],
        )

        filter_tree_f7 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 7",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_condition_group_f7,
        )

        # AND(F6, F7) group
        and_group_f6_f7 = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=False,
            filters=[filter_tree_f6, filter_tree_f7],
            subGroups=[],
        )

        # Root OR group: OR(F5, AND(F6, F7))
        root_filter_group = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.OR,
            isRoot=True,
            filters=[filter_tree_f5],
            subGroups=[and_group_f6_f7],
        )

        return ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Rule 4",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[rule_team_id],
            rootFilterGroup=root_filter_group,
        )

    def test_qa_rule4_r4_1(self, mock_db, mock_chat):
        """QA R4-1: F5 matches, should assign to Rule 4 Team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_4(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "category1": "test",
            "category2": "",
            "category3": "test",
            "category4": "user@ligla.com",
            "category5": "abc",
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule4_r4_2(self, mock_db, mock_chat):
        """QA R4-2: F5 fails, F6 matches but F7 fails, should assign to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_4(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "category1": "random_BLOCK",
            "category2": "",
            "category3": "",
            "category4": "user@ligla.com",
            "category5": "123",  # Not alphabet only
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()

    def test_qa_rule4_r4_3(self, mock_db, mock_chat):
        """QA R4-3: F5 matches (first condition), should assign to Rule 4 Team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_4(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "category1": "Block",  # Case sensitive, doesn't include "BLOCK"
            "category2": "",
            "category3": "",
            "category4": "user@ligla.com",
            "category5": "123",
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule4_r4_4(self, mock_db, mock_chat):
        """QA R4-4: F5 matches (first condition), should assign to Rule 4 Team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_4(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "category1": "test",
            "category2": "test",
            "category3": "test",
            "category4": "user",  # Not email format
            "category5": "123",  # Not alphabet only
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]  # F5 matches
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule4_r4_5(self, mock_db, mock_chat):
        """QA R4-5: F5 fails but AND(F6, F7) matches, should assign to Rule 4 Team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_4(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "category1": "BLOCKKKKK",
            "category2": "test",
            "category4": "user@ligla.com",
            "category5": "abc",
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]
            mock_batch_assign.return_value = [rule_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule4_r4_6(self, mock_db, mock_chat):
        """QA R4-6: F5 fails, F6 fails, F7 matches but AND fails, should assign to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_4(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "category1": "BLOCKKKKK",
            "category2": "test",
            "category4": "user",  # Not email
            "category5": "abc",
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()

    def test_qa_rule4_r4_7(self, mock_db, mock_chat):
        """QA R4-7: F5 fails, F6 matches but F7 fails, should assign to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_4(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "category1": "BLOCKKKKK",
            "category2": "test",
            "category4": "user@ligla.com",
            "category5": "abc1234567",  # Contains numbers
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()

    def test_qa_rule4_r4_8(self, mock_db, mock_chat):
        """QA R4-8: All filters fail, should assign to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id = uuid.uuid4()
        rule = self._create_rule_4(rule_team_id)
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "category1": "BLOCKKKKK",
            "category2": "test",
            "category4": "user",  # Not email
            "category5": "abc1234567",  # Contains numbers
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()


class TestQARule5:
    """QA test cases for Rule 5 with numeric and datetime comparisons."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        return db

    @pytest.fixture
    def mock_chat(self):
        """Create a mock chat."""
        chat = MagicMock(spec=Chat)
        chat.id = uuid.uuid4()
        chat.assignedUserId = None
        return chat

    def _create_rule_5(self, rule_team_ids: list[uuid.UUID]) -> ChatAssignRuleTreeSchema:
        """Create Rule 5 tree (simplified; evaluation is mocked in tests)."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="number_10",
            operator=ConditionOperator.GT,
            value="10",
            valueType=ValueType.NUMBER,
        )
        root_condition_group = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition],
            subGroups=[],
        )
        filter_tree = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 8",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_condition_group,
        )
        root_filter_group = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            filters=[filter_tree],
            subGroups=[],
        )
        return ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Rule 5",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=rule_team_ids,
            rootFilterGroup=root_filter_group,
        )

    def test_qa_rule5_r5_1(self, mock_db, mock_chat):
        """QA R5-1: Should match Rule 5 and assign to both teams."""
        crud = CRUDChatAssignment(None)
        rule_team_id_1 = uuid.uuid4()
        rule_team_id_2 = uuid.uuid4()
        rule = self._create_rule_5([rule_team_id_1, rule_team_id_2])
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "number10": 11,
            "number11": 19,
            "number12": 15,
            "number13": 19,
            "number14": 1,
            "number15": 8,
            "datetime5": "2025-12-08",
            "datetime6": "2025-12-11",
            "datetime7": "2025-12-08",
            "datetime8": "2025-12-11",
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]
            mock_batch_assign.return_value = [rule_team_id_1, rule_team_id_2]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id_1, rule_team_id_2],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()

    def test_qa_rule5_r5_2(self, mock_db, mock_chat):
        """QA R5-2: Should not match Rule 5; fallback to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id_1 = uuid.uuid4()
        rule_team_id_2 = uuid.uuid4()
        rule = self._create_rule_5([rule_team_id_1, rule_team_id_2])
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "number10": 1,
            "number11": 21,
            "number12": 14,
            "number13": 20,
            "number14": 5,
            "number15": 10,
            "datetime5": "2025-12-07",
            "datetime6": "2025-12-12",
            "datetime7": "2025-12-07",
            "datetime8": "2025-12-12",
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()

    def test_qa_rule5_r5_3(self, mock_db, mock_chat):
        """QA R5-3: Should not match Rule 5; fallback to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id_1 = uuid.uuid4()
        rule_team_id_2 = uuid.uuid4()
        rule = self._create_rule_5([rule_team_id_1, rule_team_id_2])
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "number10": 1,
            "number11": 19,
            "number12": 15,
            "number13": 19,
            "number14": 1,
            "number15": 8,
            "datetime5": "2025-12-08",
            "datetime6": "2025-12-11",
            "datetime7": "2025-12-08",
            "datetime8": "2025-12-11",
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()

    def test_qa_rule5_r5_4(self, mock_db, mock_chat):
        """QA R5-4: Should not match Rule 5; fallback to default team."""
        crud = CRUDChatAssignment(None)
        rule_team_id_1 = uuid.uuid4()
        rule_team_id_2 = uuid.uuid4()
        rule = self._create_rule_5([rule_team_id_1, rule_team_id_2])
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "number10": 0,
            "number11": 19,
            "number12": 15,
            "number13": 100,
            "number14": 1,
            "number15": 8,
            "datetime5": "2025-12-08",
            "datetime6": "2025-12-11",
            "datetime7": "2025-01-01",
            "datetime8": "2025-12-30",
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(result, ChatAssignmentType.DEFAULT_TEAM)
            mock_assign_default.assert_called_once()

    def test_qa_rule5_r5_5(self, mock_db, mock_chat):
        """QA R5-5: Should match Rule 5 and assign to both teams."""
        crud = CRUDChatAssignment(None)
        rule_team_id_1 = uuid.uuid4()
        rule_team_id_2 = uuid.uuid4()
        rule = self._create_rule_5([rule_team_id_1, rule_team_id_2])
        favorites = Favorites(operatorId="", storeIds=[])
        additions = {
            "number10": 11,
            "number11": 19,
            "number12": 15,
            "number13": 19,
            "number14": "",
            "number15": 8,
            "datetime5": "2025-12-08",
            "datetime6": "2026-11-11",
            "datetime7": "2025-02-08",
            "datetime8": "2027-01-01",
        }

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [rule.id]
            mock_build_trees.return_value = [rule]
            mock_eval_rules.return_value = [rule]
            mock_batch_assign.return_value = [rule_team_id_1, rule_team_id_2]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                additions,
            )

            assert_assignment(
                result,
                ChatAssignmentType.RULE_BASED,
                team_ids=[rule_team_id_1, rule_team_id_2],
                rule_ids=[rule.id],
            )
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()
