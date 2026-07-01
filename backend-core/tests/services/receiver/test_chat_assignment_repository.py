#!/usr/bin/env python3
"""Unit tests for chat assignment repository methods."""

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


class TestRuleEvaluation:
    """Test rule evaluation logic."""

    def test_evaluate_rules_against_chat_single_match(self):
        """Test one rule matches."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1 2",
            valueType=ValueType.ARRAY,
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
            name="Test Filter",
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
        rule = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Test Rule",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[uuid.uuid4()],
            rootFilterGroup=root_filter_group,
        )

        crud = CRUDChatAssignment(None)
        favorites = Favorites(storeIds=[1, 2])
        matched_rules = crud._evaluate_rules_against_chat([rule], favorites, None)

        assert len(matched_rules) == 1
        assert matched_rules[0].id == rule.id

    def test_evaluate_rules_against_chat_multiple_matches(self):
        """Test multiple rules match."""
        condition1 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1",
            valueType=ValueType.ARRAY,
        )
        root_condition_group1 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition1],
            subGroups=[],
        )
        filter_tree1 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 1",
            targetTable="Store",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_condition_group1,
        )
        root_filter_group1 = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            filters=[filter_tree1],
            subGroups=[],
        )
        rule1 = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Rule 1",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[uuid.uuid4()],
            rootFilterGroup=root_filter_group1,
        )

        condition2 = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="category_1",
            operator=ConditionOperator.EQUAL,
            value="test",
            valueType=ValueType.STRING,
        )
        root_condition_group2 = ChatAssignConditionGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            conditions=[condition2],
            subGroups=[],
        )
        filter_tree2 = ChatAssignFilterTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Filter 2",
            targetTable="Survey",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            rootConditionGroup=root_condition_group2,
        )
        root_filter_group2 = ChatAssignFilterGroupSchema(
            id=uuid.uuid4(),
            logicalOperator=LogicalOperator.AND,
            isRoot=True,
            filters=[filter_tree2],
            subGroups=[],
        )
        rule2 = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Rule 2",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[uuid.uuid4()],
            rootFilterGroup=root_filter_group2,
        )

        crud = CRUDChatAssignment(None)
        favorites = Favorites(storeIds=[1])
        additions = {"category1": "test"}
        matched_rules = crud._evaluate_rules_against_chat([rule1, rule2], favorites, additions)

        assert len(matched_rules) == 2

    def test_evaluate_rules_against_chat_no_matches(self):
        """Test no rules match."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="99",
            valueType=ValueType.ARRAY,
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
            name="Test Filter",
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
        rule = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Test Rule",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[uuid.uuid4()],
            rootFilterGroup=root_filter_group,
        )

        crud = CRUDChatAssignment(None)
        favorites = Favorites(storeIds=[1])
        matched_rules = crud._evaluate_rules_against_chat([rule], favorites, None)

        assert len(matched_rules) == 0

    def test_evaluate_rules_against_chat_skips_no_target_teams(self):
        """Test rules without target teams are skipped."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1",
            valueType=ValueType.ARRAY,
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
            name="Test Filter",
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
        rule = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Test Rule",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[],  # No target teams
            rootFilterGroup=root_filter_group,
        )

        crud = CRUDChatAssignment(None)
        favorites = Favorites(storeIds=[1])
        matched_rules = crud._evaluate_rules_against_chat([rule], favorites, None)

        assert len(matched_rules) == 0

    def test_evaluate_rules_against_chat_handles_exception(self):
        """Test exception in rule evaluation is handled gracefully."""
        # Create a rule that will cause an exception during evaluation
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1",
            valueType=ValueType.ARRAY,
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
            name="Test Filter",
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
        rule = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Test Rule",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[uuid.uuid4()],
            rootFilterGroup=root_filter_group,
        )

        crud = CRUDChatAssignment(None)

        # Mock evaluate_filter_group to raise an exception
        with patch("app.services.receiver.repository.chat_assignment.evaluate_filter_group") as mock_eval:
            mock_eval.side_effect = Exception("Test exception")
            favorites = Favorites(storeIds=[1])
            matched_rules = crud._evaluate_rules_against_chat([rule], favorites, None)

            # Should handle exception gracefully and return empty list
            assert len(matched_rules) == 0


class TestTeamAssignmentFromRules:
    """Test team assignment from matched rules."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = MagicMock()
        db.execute.return_value.scalars.return_value.all.return_value = []
        db.commit = MagicMock()
        db.rollback = MagicMock()
        return db

    @pytest.fixture
    def mock_chat(self):
        """Create a mock chat."""
        chat = MagicMock(spec=Chat)
        chat.id = uuid.uuid4()
        return chat

    def test_batch_assign_single_team(self, mock_db, mock_chat):
        """Test assign to one team from rule."""
        team_id = uuid.uuid4()
        team = MagicMock(spec=Team)
        team.id = team_id

        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1",
            valueType=ValueType.ARRAY,
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
            name="Test Filter",
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
        rule = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Test Rule",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[team_id],
            rootFilterGroup=root_filter_group,
        )

        # Mock database responses
        mock_db.execute.return_value.scalars.return_value.all.return_value = [team]
        mock_db.execute.return_value.rowcount = 0  # No existing assignments

        crud = CRUDChatAssignment(None)
        crud.get_assignments_by_chat = MagicMock(return_value=[])

        result = crud._batch_assign_chat_to_matched_rule_teams(mock_db, mock_chat, [rule])

        assert set(result) == {team_id}
        mock_db.commit.assert_called_once()

    def test_batch_assign_multiple_teams(self, mock_db, mock_chat):
        """Test assign to multiple teams from multiple rules."""
        team_id1 = uuid.uuid4()
        team_id2 = uuid.uuid4()
        team1 = MagicMock(spec=Team)
        team1.id = team_id1
        team2 = MagicMock(spec=Team)
        team2.id = team_id2

        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1",
            valueType=ValueType.ARRAY,
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
            name="Test Filter",
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
        rule1 = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Rule 1",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[team_id1],
            rootFilterGroup=root_filter_group,
        )
        rule2 = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Rule 2",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[team_id2],
            rootFilterGroup=root_filter_group,
        )

        # Mock database responses
        mock_db.execute.return_value.scalars.return_value.all.return_value = [team1, team2]
        mock_db.execute.return_value.rowcount = 0

        crud = CRUDChatAssignment(None)
        crud.get_assignments_by_chat = MagicMock(return_value=[])

        result = crud._batch_assign_chat_to_matched_rule_teams(mock_db, mock_chat, [rule1, rule2])

        assert set(result) == {team_id1, team_id2}
        mock_db.commit.assert_called_once()

    def test_batch_assign_duplicate_teams(self, mock_db, mock_chat):
        """Test deduplicate teams from multiple rules."""
        team_id = uuid.uuid4()
        team = MagicMock(spec=Team)
        team.id = team_id

        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1",
            valueType=ValueType.ARRAY,
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
            name="Test Filter",
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
        rule1 = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Rule 1",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[team_id],
            rootFilterGroup=root_filter_group,
        )
        rule2 = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Rule 2",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[team_id],  # Same team
            rootFilterGroup=root_filter_group,
        )

        # Mock database responses
        mock_db.execute.return_value.scalars.return_value.all.return_value = [team]
        mock_db.execute.return_value.rowcount = 0

        crud = CRUDChatAssignment(None)
        crud.get_assignments_by_chat = MagicMock(return_value=[])

        result = crud._batch_assign_chat_to_matched_rule_teams(mock_db, mock_chat, [rule1, rule2])

        assert set(result) == {team_id}
        # Should only assign once despite duplicate team in rules
        mock_db.commit.assert_called_once()

    def test_batch_assign_invalid_team_id(self, mock_db, mock_chat):
        """Test invalid team ID handling."""
        team_id = uuid.uuid4()
        invalid_team_id = uuid.uuid4()

        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1",
            valueType=ValueType.ARRAY,
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
            name="Test Filter",
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
        rule = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Test Rule",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[team_id, invalid_team_id],  # One valid, one invalid
            rootFilterGroup=root_filter_group,
        )

        # Mock database - only return valid team
        team = MagicMock(spec=Team)
        team.id = team_id
        mock_db.execute.return_value.scalars.return_value.all.return_value = [team]
        mock_db.execute.return_value.rowcount = 0

        crud = CRUDChatAssignment(None)
        crud.get_assignments_by_chat = MagicMock(return_value=[])

        result = crud._batch_assign_chat_to_matched_rule_teams(mock_db, mock_chat, [rule])

        # Should still succeed with valid team
        assert set(result) == {team_id}
        mock_db.commit.assert_called_once()

    def test_batch_assign_no_target_teams(self, mock_db, mock_chat):
        """Test no target teams returns False."""
        condition = ChatAssignConditionSchema(
            id=uuid.uuid4(),
            field="store_ids",
            operator=ConditionOperator.VALUES_MATCH_ANY,
            value="1",
            valueType=ValueType.ARRAY,
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
            name="Test Filter",
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
        rule = ChatAssignRuleTreeSchema(
            id=uuid.uuid4(),
            organizationName="test_org",
            name="Test Rule",
            isActive=True,
            createdAt=datetime.now(),
            updatedAt=None,
            targetTeams=[],  # No teams
            rootFilterGroup=root_filter_group,
        )

        crud = CRUDChatAssignment(None)
        result = crud._batch_assign_chat_to_matched_rule_teams(mock_db, mock_chat, [rule])

        assert result == []


class TestAssignmentPriorityFlow:
    """Test assignment priority flow logic."""

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

    def test_priority_chat_already_assigned_skipped(self, mock_db, mock_chat):
        """Test already assigned chat skipped."""
        mock_chat.assignedUserId = uuid.uuid4()

        crud = CRUDChatAssignment(None)
        favorites = Favorites(storeIds=[1])

        # Mock repository.chat.get to return the chat
        with patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get:
            mock_get.return_value = mock_chat
            result = crud.create_chat_assignment(mock_db, mock_chat.id, "test_org", "test_user", favorites, None)

            assert isinstance(result, ChatAssignmentResult)
            assert result.success is True
            assert result.assignment_type == ChatAssignmentType.SKIPPED_ALREADY_ASSIGNED
            assert result.operator_id == mock_chat.assignedUserId

    def test_priority_no_favorites_or_additions_default_team(self, mock_db, mock_chat):
        """Test no favorites or additions assigns to default team."""
        crud = CRUDChatAssignment(None)

        # Mock repository.chat.get
        with patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get:
            mock_get.return_value = mock_chat

            # Mock _assign_to_default_team
            with patch.object(crud, "_assign_to_default_team") as mock_assign:
                result = crud.create_chat_assignment(mock_db, mock_chat.id, "test_org", "test_user", None, None)

                assert isinstance(result, ChatAssignmentResult)
                assert result.success is True
                assert result.assignment_type == ChatAssignmentType.DEFAULT_TEAM
                mock_assign.assert_called_once()

    def test_priority_chat_not_found_creates_chat_and_default_team(self, mock_db):
        """When chat does not exist, it should be created and then assigned to default team."""
        crud = CRUDChatAssignment(None)
        chat_id = uuid.uuid4()

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch("app.services.receiver.repository.chat_assignment.repository.chat.create") as mock_create,
            patch.object(crud, "_assign_to_default_team") as mock_assign,
        ):
            # Chat not found first
            mock_get.return_value = None

            # Newly created chat
            chat = MagicMock(spec=Chat)
            chat.id = chat_id
            chat.assignedUserId = None
            mock_create.return_value = chat

            result = crud.create_chat_assignment(
                mock_db,
                chat_id,
                "test_org",
                "end_user",
                None,  # favorites
                None,  # additions
            )

            assert isinstance(result, ChatAssignmentResult)
            assert result.success is True
            assert result.assignment_type == ChatAssignmentType.DEFAULT_TEAM
            mock_get.assert_called_once()
            mock_create.assert_called_once()
            mock_assign.assert_called_once_with(mock_db, chat.id, "test_org")

    def test_priority_operator_assignment_success(self, mock_db, mock_chat):
        """Valid operator in favorites assigns chat to operator and logs activity."""
        crud = CRUDChatAssignment(None)
        operator_id = uuid.uuid4()

        favorites = Favorites(operatorId=str(operator_id), storeIds=[])

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.operator.get_by_organization"
            ) as mock_get_operator,
            patch("app.services.receiver.repository.chat_assignment.repository.operator.is_active") as mock_is_active,
            patch("app.services.receiver.repository.chat_assignment.repository.operator.get_teams") as mock_get_teams,
            patch.object(crud, "_assign_to_operator") as mock_assign_op,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.chat_activity.save_activity_to_db"
            ) as mock_save_activity,
        ):
            mock_get.return_value = mock_chat

            operator = MagicMock()
            operator.id = operator_id
            operator.roleType = RoleType.OPERATOR
            operator.displayName = "Test Operator"
            operator.email = "test@example.com"
            mock_get_operator.return_value = operator
            mock_is_active.return_value = True

            team = MagicMock(spec=Team)
            team.id = uuid.uuid4()
            mock_get_teams.return_value = [team]

            mock_save_activity.return_value = MagicMock()

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                None,
            )

            assert isinstance(result, ChatAssignmentResult)
            assert result.success is True
            assert result.assignment_type == ChatAssignmentType.DIRECT_OPERATOR
            assert result.operator_id == operator_id
            assert result.team_ids == [team.id]
            mock_assign_op.assert_called_once()
            mock_save_activity.assert_called_once()

    def test_priority_operator_assignment_activity_fail_returns_false(self, mock_db, mock_chat):
        """If operator assignment activity cannot be saved, method should return False."""
        crud = CRUDChatAssignment(None)
        operator_id = uuid.uuid4()
        favorites = Favorites(operatorId=str(operator_id), storeIds=[])

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.operator.get_by_organization"
            ) as mock_get_operator,
            patch("app.services.receiver.repository.chat_assignment.repository.operator.is_active") as mock_is_active,
            patch.object(crud, "_assign_to_operator") as mock_assign_op,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.chat_activity.save_activity_to_db"
            ) as mock_save_activity,
        ):
            mock_get.return_value = mock_chat

            operator = MagicMock()
            operator.id = operator_id
            operator.roleType = RoleType.OPERATOR
            operator.displayName = "Test Operator"
            operator.email = "test@example.com"
            mock_get_operator.return_value = operator
            mock_is_active.return_value = True

            # Simulate failure to save activity
            mock_save_activity.return_value = None

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                None,
            )

            # Should detect failure and return False with ERROR type
            assert isinstance(result, ChatAssignmentResult)
            assert result.success is False
            assert result.assignment_type == ChatAssignmentType.ERROR
            mock_assign_op.assert_called_once()
            mock_save_activity.assert_called_once()

    def test_priority_admin_operator_skips_direct_assignment(self, mock_db, mock_chat):
        """ADMIN/MANAGER operators in favorites should not be directly assigned to chat."""
        crud = CRUDChatAssignment(None)
        operator_id = uuid.uuid4()
        favorites = Favorites(operatorId=str(operator_id), storeIds=[1])

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.operator.get_by_organization"
            ) as mock_get_operator,
            patch("app.services.receiver.repository.chat_assignment.repository.operator.is_active") as mock_is_active,
            patch.object(crud, "_assign_to_operator") as mock_assign_op,
            patch.object(crud, "get_assignments_by_chat") as mock_get_assignments,
            patch.object(crud, "_assign_to_team") as mock_assign_team,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.store.validate_store_ids"
            ) as mock_validate_store_ids,
            patch(
                "app.services.receiver.repository.chat_assignment.repository.team.get_teams_by_store_ids"
            ) as mock_get_teams,
        ):
            mock_get.return_value = mock_chat

            operator = MagicMock()
            operator.id = operator_id
            operator.roleType = RoleType.ADMIN
            operator.displayName = "Admin"
            operator.email = "admin@example.com"
            mock_get_operator.return_value = operator
            mock_is_active.return_value = True

            # Mock get_assignments_by_chat to return empty list (no existing assignments)
            mock_get_assignments.return_value = []

            # Make store-based assignment possible
            mock_validate_store_ids.return_value = [1]
            team = MagicMock(spec=Team)
            team.id = uuid.uuid4()
            mock_get_teams.return_value = [team]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                None,
            )

            # Direct operator assignment should be skipped for ADMIN
            mock_assign_op.assert_not_called()
            # But store-based assignment path should still succeed via STORE_TEAM
            assert isinstance(result, ChatAssignmentResult)
            assert result.success is True
            assert result.assignment_type == ChatAssignmentType.STORE_TEAM
            assert result.team_ids == [team.id]
            # Verify team assignment was called
            mock_assign_team.assert_called_once()

    def test_priority_no_active_rules_assigns_default_team(self, mock_db, mock_chat):
        """If there are no active rules, fall back to default team with remove_outdated_teams=True."""
        crud = CRUDChatAssignment(None)
        favorites = Favorites(storeIds=[], operatorId=None)

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                {},  # additions present so we get to rule path
            )

            assert isinstance(result, ChatAssignmentResult)
            assert result.success is True
            assert result.assignment_type == ChatAssignmentType.DEFAULT_TEAM
            mock_assign_default.assert_called_once_with(mock_db, mock_chat.id, "test_org", remove_outdated_teams=True)

    def test_priority_rule_based_no_matches_assigns_default_team(self, mock_db, mock_chat):
        """When rules exist but none match, assign to default team."""
        crud = CRUDChatAssignment(None)
        favorites = Favorites(storeIds=[], operatorId=None)

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [uuid.uuid4()]
            mock_build_trees.return_value = ["tree1"]
            mock_eval_rules.return_value = []  # no matches

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                {},  # additions present
            )

            assert isinstance(result, ChatAssignmentResult)
            assert result.success is True
            assert result.assignment_type == ChatAssignmentType.DEFAULT_TEAM
            mock_assign_default.assert_called_once_with(mock_db, mock_chat.id, "test_org", remove_outdated_teams=True)

    def test_priority_rule_based_matches_but_no_teams_falls_back_to_default(self, mock_db, mock_chat):
        """When rules match but no valid teams are assigned, fall back to default team."""
        crud = CRUDChatAssignment(None)
        favorites = Favorites(storeIds=[], operatorId=None)

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [uuid.uuid4()]
            mock_build_trees.return_value = ["tree1"]
            matched_rule = MagicMock()
            matched_rule.id = uuid.uuid4()
            mock_eval_rules.return_value = [matched_rule]

            # Simulate failure to assign any teams from matched rules
            mock_batch_assign.return_value = []

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                {},  # additions present
            )

            assert isinstance(result, ChatAssignmentResult)
            assert result.success is True
            assert result.assignment_type == ChatAssignmentType.DEFAULT_TEAM
            assert result.rule_ids == [matched_rule.id]
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_called_once_with(mock_db, mock_chat.id, "test_org", remove_outdated_teams=True)

    def test_priority_rule_based_matches_and_assigns_teams(self, mock_db, mock_chat):
        """When rules match and teams are assigned, do not call default team assignment."""
        crud = CRUDChatAssignment(None)
        favorites = Favorites(storeIds=[], operatorId=None)

        with (
            patch("app.services.receiver.repository.chat_assignment.repository.chat.get") as mock_get,
            patch.object(crud, "_get_active_rule_ids_by_organization") as mock_get_rule_ids,
            patch.object(crud, "_build_rule_trees_batch") as mock_build_trees,
            patch.object(crud, "_evaluate_rules_against_chat") as mock_eval_rules,
            patch.object(crud, "_batch_assign_chat_to_matched_rule_teams") as mock_batch_assign,
            patch.object(crud, "_assign_to_default_team") as mock_assign_default,
        ):
            mock_get.return_value = mock_chat
            mock_get_rule_ids.return_value = [uuid.uuid4()]
            mock_build_trees.return_value = ["tree1"]
            matched_rule = MagicMock()
            matched_rule.id = uuid.uuid4()
            mock_eval_rules.return_value = [matched_rule]

            assigned_team_id = uuid.uuid4()
            mock_batch_assign.return_value = [assigned_team_id]

            result = crud.create_chat_assignment(
                mock_db,
                mock_chat.id,
                "test_org",
                "end_user",
                favorites,
                {},  # additions present
            )

            assert isinstance(result, ChatAssignmentResult)
            assert result.success is True
            assert result.assignment_type == ChatAssignmentType.RULE_BASED
            assert result.rule_ids == [matched_rule.id]
            assert result.team_ids == [assigned_team_id]
            mock_batch_assign.assert_called_once()
            mock_assign_default.assert_not_called()
