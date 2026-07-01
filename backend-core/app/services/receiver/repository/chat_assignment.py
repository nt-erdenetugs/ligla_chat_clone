import enum
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import delete, desc, func, insert, select
from sqlalchemy.orm import Session, selectinload

from app.common.crud_base import CRUDBase
from app.common.errors import ChatAssignmentError, ExternalAPIError, raise_error
from app.common.utils import get_logger
from app.config.settings import settings
from app.db.models import (
    ActivityType,
    Attribute,
    Chat,
    ChatActivity,
    ChatActivityActorType,
    ChatAssignConditionGroup,
    ChatAssignConditionGroupClosure,
    ChatAssignFilter,
    ChatAssignFilterGroup,
    ChatAssignFilterGroupClosure,
    ChatAssignRule,
    ChatAttributeValue,
    ChatMessage,
    ChatTags,
    ChatTeamAssignment,
    EndUser,
    Note,
    Organization,
    RoleType,
    SurveyData,
    Team,
)
from app.services.receiver import repository, schemas
from app.services.receiver.helper.chat_assignment import evaluate_filter_group
from app.services.receiver.helper.tree_builder import build_closure_tree

logger = get_logger(__name__)


class ChatAssignmentType(enum.StrEnum):
    """High-level assignment path result. Useful for function testing."""

    SKIPPED_ALREADY_ASSIGNED = "skipped_already_assigned"
    DIRECT_OPERATOR = "direct_operator"
    STORE_TEAM = "store_team"
    RULE_BASED = "rule_based"
    DEFAULT_TEAM = "default_team"
    ERROR = "error"


@dataclass
class ChatAssignmentResult:
    """Detailed result of chat assignment."""

    success: bool
    assignment_type: ChatAssignmentType
    operator_id: uuid.UUID | None = None
    team_ids: list[uuid.UUID] = field(default_factory=list)
    rule_ids: list[uuid.UUID] = field(default_factory=list)
    reason: str | None = None


@dataclass
class DeleteResult:
    """Result of chat deletion operation."""

    success: bool
    deleted_chat_id: uuid.UUID
    deleted_messages_count: int
    deleted_activities_count: int
    deleted_notes_count: int
    deleted_chat_attributes_count: int
    deleted_attributes_count: int
    deleted_tags_count: int
    deleted_team_assignments_count: int
    end_user_deleted: bool
    deleted_survey_count: int


class CRUDChatAssignment(
    CRUDBase[ChatTeamAssignment, schemas.ChatTeamAssignmentCreate, schemas.ChatTeamAssignmentUpdate]
):
    def get_by_chat_and_team(self, db: Session, chat_id: uuid.UUID, team_id: uuid.UUID) -> ChatTeamAssignment | None:
        stmt = select(self.model).where(self.model.chatId == chat_id, self.model.teamId == team_id)
        return db.execute(stmt).scalar_one_or_none()

    def get_assignments_by_chat(self, db: Session, chat_id: uuid.UUID) -> list[ChatTeamAssignment]:
        stmt = select(self.model).where(self.model.chatId == chat_id)
        return list(db.execute(stmt).scalars().all())

    def _assign_to_default_team(
        self, db: Session, chat_id: uuid.UUID, organization: str, remove_outdated_teams: bool = False
    ):
        logger.info(
            "Assigning chat to default team",
            extra={
                "chat_id": str(chat_id),
                "organization": organization,
            },
        )

        default_team = repository.team.get_default_team(db)
        if not default_team:
            raise_error(
                ChatAssignmentError(
                    f"Default team not found for organization {organization}",
                    chat_id=str(chat_id),
                )
            )

        if remove_outdated_teams:
            self._remove_outdated_teams(db, chat_id, [])

        self._assign_to_team(db, chat_id, default_team)

        logger.info(
            "Chat assigned to default team successfully",
            extra={
                "chat_id": str(chat_id),
                "organization": organization,
                "team_id": str(default_team.id),
                "team_name": default_team.name,
            },
        )

    def _assign_to_team(self, db: Session, chat_id: uuid.UUID, team: Team | None):
        if not team:
            logger.warning(
                "No valid team provided for assignment",
                extra={
                    "chat_id": str(chat_id),
                },
            )
            return

        existing_assignment = self.get_by_chat_and_team(db, chat_id, team.id)
        if existing_assignment:
            logger.info(
                "Chat already assigned to team, skipping reassignment",
                extra={
                    "chat_id": str(chat_id),
                    "team_id": str(team.id),
                    "team_name": team.name,
                },
            )
            return

        logger.info(
            "Creating team assignment",
            extra={
                "chat_id": str(chat_id),
                "team_id": str(team.id),
                "team_name": team.name,
            },
        )

        assignment_data = schemas.ChatTeamAssignmentCreate(chatId=chat_id, teamId=team.id)
        self.create(db, assignment_data)

        logger.info(
            "Chat successfully assigned to team",
            extra={
                "chat_id": str(chat_id),
                "team_id": str(team.id),
                "team_name": team.name,
            },
        )

    def _remove_outdated_teams(self, db: Session, chat_id: uuid.UUID, new_team_ids: list[uuid.UUID]):
        existing_assignments = self.get_assignments_by_chat(db, chat_id)

        logger.info(
            "Checking for outdated team assignments",
            extra={
                "chat_id": str(chat_id),
                "existing_team_count": len(existing_assignments),
                "new_team_count": len(new_team_ids),
            },
        )

        outdated_team_ids = [
            assignment.teamId for assignment in existing_assignments if assignment.teamId not in new_team_ids
        ]

        if outdated_team_ids:
            stmt = delete(ChatTeamAssignment).where(
                ChatTeamAssignment.chatId == chat_id, ChatTeamAssignment.teamId.in_(outdated_team_ids)
            )
            result = db.execute(stmt)
            removed_count = result.rowcount

            for team_id in outdated_team_ids:
                logger.info(
                    "Removing outdated team assignment",
                    extra={
                        "chat_id": str(chat_id),
                        "team_id": str(team_id),
                    },
                )

            logger.info(
                "Outdated team assignments removed",
                extra={
                    "chat_id": str(chat_id),
                    "removed_count": removed_count,
                },
            )

    def _assign_to_operator(self, db: Session, chat: Chat, operator_id: uuid.UUID, organization: str):
        logger.info(
            "Assigning chat to operator",
            extra={
                "chat_id": str(chat.id),
                "operator_id": str(operator_id),
                "organization": organization,
            },
        )

        operator = repository.operator.get_one(db, operator_id)

        if not operator:
            logger.warning(
                "Operator not found, falling back to default team",
                extra={
                    "chat_id": str(chat.id),
                    "operator_id": str(operator_id),
                    "organization": organization,
                },
            )
            return self._assign_to_default_team(db, chat.id, organization)

        if not repository.operator.is_active(db, operator.id):
            logger.info(
                "Operator is inactive, assigning to operator's teams or default",
                extra={
                    "chat_id": str(chat.id),
                    "operator_id": str(operator_id),
                    "operator_email": operator.auth.email,
                },
            )
            self._assign_to_operator_teams_or_default(db, organization, chat, operator_id)
            return

        chat.assignedUserId = operator.id
        operator_teams = repository.operator.get_teams(db, operator_id)
        team_ids = [team.id for team in operator_teams]

        logger.info(
            "Operator teams retrieved",
            extra={
                "chat_id": str(chat.id),
                "operator_id": str(operator_id),
                "team_count": len(operator_teams),
            },
        )

        self._remove_outdated_teams(db, chat.id, team_ids)

        if not team_ids:
            logger.info(
                "Operator %s has no active team relations. Falling back to default team assignment for chat %s.",
                operator.auth.email,
                chat.id,
            )
            self._assign_to_default_team(db, chat.id, organization)
            return

        for team in operator_teams:
            self._assign_to_team(db, chat.id, team)

        logger.info(
            "Chat successfully assigned to operator",
            extra={
                "chat_id": str(chat.id),
                "operator_id": str(operator_id),
                "operator_email": operator.auth.email,
                "team_count": len(operator_teams),
            },
        )

    def _assign_to_operator_teams_or_default(self, db: Session, organization: str, chat: Chat, operator_id: uuid.UUID):
        logger.debug(
            "Attempting to assign chat to operator's teams",
            extra={
                "chat_id": str(chat.id),
                "operator_id": str(operator_id),
            },
        )

        operator_teams = repository.operator.get_teams(db, operator_id)

        if operator_teams:
            team_ids = [team.id for team in operator_teams]
            self._remove_outdated_teams(db, chat.id, team_ids)
            for team in operator_teams:
                self._assign_to_team(db, chat.id, team)

            logger.info(
                "Chat assigned to operator's related teams",
                extra={
                    "chat_id": str(chat.id),
                    "operator_id": str(operator_id),
                    "team_count": len(operator_teams),
                },
            )
        else:
            logger.warning(
                "No related teams found for operator, assigning to default team",
                extra={
                    "chat_id": str(chat.id),
                    "operator_id": str(operator_id),
                },
            )
            self._assign_to_default_team(db, chat.id, organization)

    def _evaluate_rules_against_chat(
        self,
        rule_trees: list[schemas.ChatAssignRuleTreeSchema],
        favorites: schemas.Favorites | None,
        additions: Any | None,
    ) -> list[schemas.ChatAssignRuleTreeSchema]:
        """
        Evaluate all rule trees against chat data and return matched rules.
        """
        matched_rules: list[schemas.ChatAssignRuleTreeSchema] = []

        for idx, rule in enumerate(rule_trees):
            try:
                is_matched = evaluate_filter_group(rule.rootFilterGroup, favorites, additions)
                logger.info(
                    f"Evaluating rule {idx + 1}/{len(rule_trees)}: Rule {rule.id} matched={is_matched}",
                    extra={
                        "rule_id": str(rule.id),
                        "matched": is_matched,
                    },
                )

                if not is_matched:
                    continue

                if not rule.targetTeams:
                    logger.warning(
                        f"Rule {rule.id} matched but has no target teams. Skipping this rule.",
                        extra={"rule_id": str(rule.id)},
                    )
                    continue

                matched_rules.append(rule)

            except Exception as e:
                logger.warning(
                    f"Error evaluating rule {rule.id}: {e}",
                    extra={
                        "rule_id": str(rule.id),
                        "error_type": type(e).__name__,
                    },
                )
                continue

        return matched_rules

    def _batch_assign_chat_to_matched_rule_teams(
        self, db: Session, chat: Chat, matched_rules: list[schemas.ChatAssignRuleTreeSchema]
    ) -> list[uuid.UUID]:
        """
        Batch assign chat to all teams from all matched rules.

        Returns list of team IDs that are assigned to the chat.
        """
        try:
            all_team_ids: set[uuid.UUID] = set()

            for rule in matched_rules or []:
                if rule.targetTeams:
                    all_team_ids.update(rule.targetTeams)

            if not all_team_ids:
                logger.warning(
                    "No target teams found in matched rules",
                    extra={
                        "chat_id": str(chat.id),
                        "matched_rules_count": len(matched_rules),
                    },
                )
                return []

            self._remove_outdated_teams(db, chat.id, [])

            team_ids_list = list(all_team_ids)

            logger.info(
                "Batch assigning chat to teams from matched rules",
                extra={
                    "chat_id": str(chat.id),
                    "matched_rules_count": len(matched_rules),
                    "total_team_ids_count": len(team_ids_list),
                },
            )

            # Batch fetch all valid teams
            teams = db.execute(select(Team).where(Team.id.in_(team_ids_list))).scalars().all()
            valid_team_ids = {team.id for team in teams}

            # Log missing teams
            missing_team_ids = all_team_ids - valid_team_ids
            if missing_team_ids:
                logger.warning(
                    "Some teams not found",
                    extra={
                        "chat_id": str(chat.id),
                        "missing_team_ids": [str(tid) for tid in missing_team_ids],
                    },
                )

            # Get existing assignments
            existing_assignments = self.get_assignments_by_chat(db, chat.id)
            existing_team_ids = {assignment.teamId for assignment in existing_assignments}

            # Determine which teams need to be assigned (not already assigned)
            teams_to_assign = valid_team_ids - existing_team_ids

            if not teams_to_assign:
                logger.info(
                    "Chat already assigned to all target teams",
                    extra={
                        "chat_id": str(chat.id),
                        "team_count": len(valid_team_ids),
                    },
                )
                # Nothing new assigned, but all valid_team_ids are already linked
                return list(valid_team_ids)

            # Batch create new assignments using bulk insert
            assignment_values = [{"chatId": chat.id, "teamId": team_id} for team_id in teams_to_assign]
            stmt = insert(ChatTeamAssignment).values(assignment_values)
            db.execute(stmt)
            db.commit()

            logger.info(
                "Chat successfully assigned to teams from matched rules",
                extra={
                    "chat_id": str(chat.id),
                    "new_assignments_count": len(teams_to_assign),
                },
            )

            return list(valid_team_ids)

        except Exception as exc:
            db.rollback()

            logger.exception(
                "Failed to batch assign chat to teams",
                extra={
                    "chat_id": str(chat.id),
                    "error": str(exc),
                },
            )

            return []

    def create_chat_assignment(
        self,
        db: Session,
        chat_id: uuid.UUID,
        organization: str,
        end_user_id: str,
        favorites: schemas.Favorites | None = None,
        additions: Any | None = None,
    ) -> ChatAssignmentResult:
        logger.info(
            "Creating chat assignment",
            extra={
                "chat_id": str(chat_id),
                "organization": organization,
                "end_user_id": end_user_id,
                "has_favorites": favorites is not None,
                "has_additions": additions is not None,
                "operator_id": str(favorites.operator_id) if favorites and favorites.operator_id else None,
                "store_ids_count": len(favorites.store_ids) if favorites and favorites.store_ids else 0,
            },
        )

        chat = repository.chat.get(db, chat_id)
        if not chat:
            logger.info(
                "Chat not found, creating new chat",
                extra={
                    "chat_id": str(chat_id),
                    "organization": organization,
                    "end_user_id": end_user_id,
                },
            )
            chat_create = schemas.ChatCreate(
                endUserId=end_user_id,
                assignedUserId=favorites.operator_id if favorites else None,
            )
            chat = repository.chat.create(db, obj_in=chat_create)
            logger.info(
                "Chat created successfully",
                extra={
                    "chat_id": str(chat.id),
                    "organization": organization,
                    "end_user_id": end_user_id,
                },
            )

        if chat.assignedUserId:
            logger.info(
                "Chat is already assigned to operator. Skipping chat assignment.",
                extra={
                    "chat_id": str(chat.id),
                    "organization": organization,
                    "assigned_operator_id": chat.assignedUserId,
                },
            )
            return ChatAssignmentResult(
                success=True,
                assignment_type=ChatAssignmentType.SKIPPED_ALREADY_ASSIGNED,
                operator_id=chat.assignedUserId,
            )

        if not favorites and not additions:
            logger.info(
                "No favorites or additions provided, assigning to default team",
                extra={
                    "chat_id": str(chat.id),
                    "organization": organization,
                },
            )
            self._assign_to_default_team(db, chat.id, organization)
            return ChatAssignmentResult(
                success=True,
                assignment_type=ChatAssignmentType.DEFAULT_TEAM,
            )

        if favorites and favorites.operator_id:
            logger.info(
                "Attempting operator assignment from favorites",
                extra={
                    "chat_id": str(chat.id),
                    "operator_id": str(favorites.operator_id),
                    "organization": organization,
                },
            )
            operator = repository.operator.get_one(db, favorites.operator_id)

            if operator and repository.operator.is_active(db, operator.id):
                if operator.roleType in [RoleType.ADMIN, RoleType.MANAGER]:
                    logger.warning(
                        "Operator is an ADMIN/MANAGER and cannot be assigned to a chat. Skipping direct assignment.",
                        extra={
                            "chat_id": str(chat.id),
                            "operator_id": str(favorites.operator_id),
                            "role_type": operator.roleType.value,
                        },
                    )

                else:
                    if chat.assignedUserId and chat.assignedUserId == operator.id:
                        logger.info(
                            "Chat already assigned to this operator",
                            extra={
                                "chat_id": str(chat.id),
                                "operator_id": str(favorites.operator_id),
                            },
                        )
                        return ChatAssignmentResult(
                            success=True,
                            assignment_type=ChatAssignmentType.DIRECT_OPERATOR,
                            operator_id=operator.id,
                        )

                    old_assigned_user_id = chat.assignedUserId
                    self._assign_to_operator(db, chat, favorites.operator_id, organization)

                    activity = schemas.ChatActivityCreate(
                        chatId=chat.id,
                        activityType=ActivityType.USER_CHANGE,
                        actorType=ChatActivityActorType.SYSTEM,
                        oldUserId=old_assigned_user_id,
                        newUserId=operator.id,
                        newUserName=operator.displayName,
                    )

                    chat_activity = repository.chat_activity.save_activity_to_db(db, obj_in=activity)
                    if not chat_activity:
                        logger.error(
                            "Failed to save chat operator assignment activity",
                            extra={
                                "chat_id": str(chat.id),
                                "operator_id": str(favorites.operator_id),
                            },
                        )
                        return ChatAssignmentResult(
                            success=False,
                            assignment_type=ChatAssignmentType.ERROR,
                            operator_id=operator.id,
                            reason="operator_activity_save_failed",
                        )

                    logger.info(
                        "Chat assigned to operator and related teams successfully",
                        extra={
                            "chat_id": str(chat.id),
                            "operator_id": str(favorites.operator_id),
                            "operator_email": operator.auth.email,
                        },
                    )

                    operator_teams = repository.operator.get_teams(db, operator.id)
                    team_ids = [team.id for team in operator_teams]

                    return ChatAssignmentResult(
                        success=True,
                        assignment_type=ChatAssignmentType.DIRECT_OPERATOR,
                        operator_id=operator.id,
                        team_ids=team_ids,
                    )
            else:
                logger.warning(
                    "Operator not found or inactive, falling back to store/team assignment",
                    extra={
                        "chat_id": str(chat.id),
                        "organization": organization,
                        "operator_id": str(favorites.operator_id),
                    },
                )

        if favorites and favorites.store_ids:
            logger.info(
                "Attempting store team assignment for chat",
                extra={
                    "chat_id": str(chat_id),
                    "store_ids_count": len(favorites.store_ids),
                    "organization": organization,
                },
            )

            valid_store_ids = repository.store.validate_store_ids(db, favorites.store_ids)
            if valid_store_ids:
                teams_assigned = False
                assigned_teams: list[dict[str, Any]] = []

                teams = repository.team.get_teams_by_store_ids(db, valid_store_ids)
                if teams:
                    self._remove_outdated_teams(db, chat.id, [])
                    for team in teams:
                        self._assign_to_team(db, chat.id, team)
                        teams_assigned = True
                        assigned_teams.append({"team_id": str(team.id)})

                if teams_assigned:
                    logger.info(
                        "Chat assigned to teams for valid stores",
                        extra={
                            "chat_id": str(chat.id),
                            "valid_store_ids_count": len(valid_store_ids),
                            "assigned_teams_count": len(assigned_teams),
                        },
                    )
                    return ChatAssignmentResult(
                        success=True,
                        assignment_type=ChatAssignmentType.STORE_TEAM,
                        team_ids=[team.id for team in teams],
                    )
                else:
                    logger.info(
                        "Valid stores found, but no corresponding teams. Proceeding with rule-based assignment.",
                        extra={
                            "chat_id": str(chat.id),
                            "organization": organization,
                            "valid_store_ids_count": len(valid_store_ids),
                        },
                    )
            else:
                logger.info(
                    "No valid store team assignment found. Proceeding with rule-based assignment.",
                    extra={
                        "chat_id": str(chat.id),
                        "organization": organization,
                    },
                )

        logger.info(
            "Attempting rule based assignment for chat",
            extra={
                "chat_id": str(chat.id),
                "organization": organization,
            },
        )

        rule_ids = self._get_active_rule_ids_by_organization(db)

        if not rule_ids:
            logger.info(
                "No active rules found for organization. Assigning to Default Team.",
                extra={
                    "chat_id": str(chat.id),
                    "organization": organization,
                },
            )
            self._assign_to_default_team(db, chat.id, organization, remove_outdated_teams=True)
            return ChatAssignmentResult(
                success=True,
                assignment_type=ChatAssignmentType.DEFAULT_TEAM,
                rule_ids=[],
                reason="no_active_rules",
            )

        logger.info(
            f"Found {len(rule_ids)} active rules for organization '{organization}'",
            extra={
                "organization": organization,
                "rule_count": len(rule_ids),
            },
        )

        # Batch load all rule trees
        rule_trees = self._build_rule_trees_batch(db, rule_ids)

        # Evaluate all rules and collect matched ones
        matched_rules = self._evaluate_rules_against_chat(rule_trees, favorites, additions)

        if not matched_rules:
            logger.info(
                "No matching rule found for chat. Assigning to Default Team.",
                extra={
                    "chat_id": str(chat.id),
                    "organization": organization,
                    "total_rules_evaluated": len(rule_trees),
                },
            )
            self._assign_to_default_team(db, chat.id, organization, remove_outdated_teams=True)
            return ChatAssignmentResult(
                success=True,
                assignment_type=ChatAssignmentType.DEFAULT_TEAM,
                rule_ids=[],
                reason="no_matching_rules",
            )

        # Batch assign all teams from all matched rules
        assigned_team_ids = self._batch_assign_chat_to_matched_rule_teams(db, chat, matched_rules)

        if assigned_team_ids:
            logger.info(
                "Chat assigned to teams from matched rules",
                extra={
                    "chat_id": str(chat.id),
                    "organization": organization,
                    "matched_rules_count": len(matched_rules),
                },
            )
            return ChatAssignmentResult(
                success=True,
                assignment_type=ChatAssignmentType.RULE_BASED,
                team_ids=assigned_team_ids,
                rule_ids=[rule.id for rule in matched_rules],
            )

        logger.info(
            "Matched rules found but no valid teams assigned. Assigning to Default Team.",
            extra={
                "chat_id": str(chat.id),
                "organization": organization,
                "matched_rules_count": len(matched_rules),
            },
        )
        self._assign_to_default_team(db, chat.id, organization, remove_outdated_teams=True)
        return ChatAssignmentResult(
            success=True,
            assignment_type=ChatAssignmentType.DEFAULT_TEAM,
            rule_ids=[rule.id for rule in matched_rules],
            reason="matched_rules_but_no_valid_teams",
        )

    def _fetch_rule_with_related(self, db: Session, rule_id: uuid.UUID) -> ChatAssignRule:
        return (
            db.execute(
                select(ChatAssignRule)
                .where(ChatAssignRule.id == rule_id)
                .options(
                    selectinload(ChatAssignRule.groups).selectinload(ChatAssignFilterGroup.filters),
                    selectinload(ChatAssignRule.targetTeams),
                )
            )
            .scalars()
            .one()
        )

    def _fetch_filter_with_related(self, db: Session, filter_id: uuid.UUID) -> ChatAssignFilter:
        return (
            db.execute(
                select(ChatAssignFilter)
                .where(ChatAssignFilter.id == filter_id)
                .options(
                    selectinload(ChatAssignFilter.groups).selectinload(ChatAssignConditionGroup.conditions),
                )
            )
            .scalars()
            .one()
        )

    def _load_filter_closure_edges(self, db: Session, rule_id: uuid.UUID):
        return list(
            db.execute(
                select(ChatAssignFilterGroupClosure)
                .where(ChatAssignFilterGroupClosure.ruleId == rule_id)
                .order_by(ChatAssignFilterGroupClosure.depth)
            )
            .scalars()
            .all()
        )

    def _load_condition_closure_edges(self, db: Session, filter_id: uuid.UUID):
        return list(
            db.execute(
                select(ChatAssignConditionGroupClosure)
                .where(ChatAssignConditionGroupClosure.filterId == filter_id)
                .order_by(ChatAssignConditionGroupClosure.depth)
            )
            .scalars()
            .all()
        )

    def _fetch_rules_with_related_batch(
        self, db: Session, rule_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, ChatAssignRule]:
        """Batch fetch all rules with their related groups, filters, and target teams."""
        if not rule_ids:
            return {}
        rules = (
            db.execute(
                select(ChatAssignRule)
                .where(ChatAssignRule.id.in_(rule_ids))
                .options(
                    selectinload(ChatAssignRule.groups).selectinload(ChatAssignFilterGroup.filters),
                    selectinload(ChatAssignRule.targetTeams),
                )
            )
            .scalars()
            .all()
        )
        return {rule.id: rule for rule in rules}

    def _load_filter_closure_edges_batch(
        self, db: Session, rule_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, list[ChatAssignFilterGroupClosure]]:
        """Batch fetch all filter closure edges for multiple rules."""
        if not rule_ids:
            return {}
        closure_rows = (
            db.execute(
                select(ChatAssignFilterGroupClosure)
                .where(ChatAssignFilterGroupClosure.ruleId.in_(rule_ids))
                .order_by(ChatAssignFilterGroupClosure.ruleId, ChatAssignFilterGroupClosure.depth)
            )
            .scalars()
            .all()
        )
        # Group closure rows by rule_id
        result: dict[uuid.UUID, list[ChatAssignFilterGroupClosure]] = {rule_id: [] for rule_id in rule_ids}
        for row in closure_rows:
            result[row.ruleId].append(row)
        return result

    def _fetch_filters_with_related_batch(
        self, db: Session, filter_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, ChatAssignFilter]:
        """Batch fetch all filters with their related groups and conditions."""
        if not filter_ids:
            return {}
        filters = (
            db.execute(
                select(ChatAssignFilter)
                .where(ChatAssignFilter.id.in_(filter_ids))
                .options(
                    selectinload(ChatAssignFilter.groups).selectinload(ChatAssignConditionGroup.conditions),
                )
            )
            .scalars()
            .all()
        )
        return {filter.id: filter for filter in filters}

    def _load_condition_closure_edges_batch(
        self, db: Session, filter_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, list[ChatAssignConditionGroupClosure]]:
        """Batch fetch all condition closure edges for multiple filters."""
        if not filter_ids:
            return {}
        closure_rows = (
            db.execute(
                select(ChatAssignConditionGroupClosure)
                .where(ChatAssignConditionGroupClosure.filterId.in_(filter_ids))
                .order_by(ChatAssignConditionGroupClosure.filterId, ChatAssignConditionGroupClosure.depth)
            )
            .scalars()
            .all()
        )
        # Group closure rows by filter_id
        result: dict[uuid.UUID, list[ChatAssignConditionGroupClosure]] = {filter_id: [] for filter_id in filter_ids}
        for row in closure_rows:
            result[row.filterId].append(row)
        return result

    def _build_rule_tree(
        self,
        db: Session,
        rule_id: uuid.UUID,
        rule: ChatAssignRule | None = None,
        closure_rows: list[ChatAssignFilterGroupClosure] | None = None,
        filters_cache: dict[uuid.UUID, schemas.ChatAssignFilterTreeSchema] | None = None,
    ) -> schemas.ChatAssignRuleTreeSchema:
        """Build a rule tree. If rule, closure_rows, and filters_cache are provided, uses them instead of querying."""
        if rule is None:
            rule = self._fetch_rule_with_related(db, rule_id)
        if closure_rows is None:
            closure_rows = self._load_filter_closure_edges(db, rule_id)

        groups_by_id = {group.id: group for group in rule.groups}
        root_group = next((group for group in rule.groups if group.isRoot), None)

        if root_group is None:
            raise ValueError("ChatAssignRule is missing a root filter group")

        def build_group_schema(node: ChatAssignFilterGroup, children: list[schemas.ChatAssignFilterGroupSchema]):
            if filters_cache is not None:
                # Use pre-built filter trees from cache
                filters = [
                    filters_cache[filter_item.filterId]
                    for filter_item in node.filters
                    if filter_item.filterId in filters_cache
                ]
            else:
                # Fallback to individual queries
                filters = [self._build_filter_tree(db, filter_item.filterId) for filter_item in node.filters]
            return schemas.ChatAssignFilterGroupSchema(
                id=node.id,
                logicalOperator=node.logicalOperator,
                isRoot=node.isRoot,
                filters=filters,
                subGroups=children,
            )

        root_tree = build_closure_tree(
            root_id=root_group.id,
            nodes=groups_by_id,
            closure_rows=closure_rows,
            ancestor_key=lambda row: row.ancestorGroupId,
            descendant_key=lambda row: row.descendantGroupId,
            depth_key=lambda row: row.depth,
            build_tree_node=build_group_schema,
        )

        return schemas.ChatAssignRuleTreeSchema(
            id=rule.id,
            name=rule.name,
            note=rule.note,
            isActive=rule.isActive,
            createdAt=rule.createdAt,
            updatedAt=rule.updatedAt,
            targetTeams=[target.teamId for target in rule.targetTeams],
            rootFilterGroup=root_tree,
        )

    def _build_filter_tree(
        self,
        db: Session,
        filter_id: uuid.UUID,
        filter: ChatAssignFilter | None = None,
        closure_rows: list[ChatAssignConditionGroupClosure] | None = None,
    ) -> schemas.ChatAssignFilterTreeSchema:
        """Build a filter tree. If filter and closure_rows are provided, uses them instead of querying."""
        if filter is None:
            filter = self._fetch_filter_with_related(db, filter_id)
        if closure_rows is None:
            closure_rows = self._load_condition_closure_edges(db, filter_id)

        groups_by_id = {group.id: group for group in filter.groups}
        root_group = next((group for group in filter.groups if group.isRoot), None)
        if root_group is None:
            raise ValueError("ChatAssignFilter is missing a root condition group")

        def build_group_schema(node: ChatAssignConditionGroup, children: list[schemas.ChatAssignConditionGroupSchema]):
            return schemas.ChatAssignConditionGroupSchema(
                id=node.id,
                logicalOperator=node.logicalOperator,
                isRoot=node.isRoot,
                conditions=[
                    schemas.ChatAssignConditionSchema(
                        id=condition.id,
                        field=condition.field,
                        operator=condition.operator,
                        value=condition.value,
                        valueType=condition.valueType,
                    )
                    for condition in node.conditions
                ],
                subGroups=children,
            )

        root_tree = build_closure_tree(
            root_id=root_group.id,
            nodes=groups_by_id,
            closure_rows=closure_rows,
            ancestor_key=lambda row: row.ancestorGroupId,
            descendant_key=lambda row: row.descendantGroupId,
            depth_key=lambda row: row.depth,
            build_tree_node=build_group_schema,
        )

        return schemas.ChatAssignFilterTreeSchema(
            id=filter.id,
            name=filter.name,
            targetTable=filter.targetTable,
            note=filter.note,
            isActive=filter.isActive,
            createdAt=filter.createdAt,
            updatedAt=filter.updatedAt,
            rootConditionGroup=root_tree,
        )

    def _build_rule_trees_batch(self, db: Session, rule_ids: list[uuid.UUID]) -> list[schemas.ChatAssignRuleTreeSchema]:
        """
        Batch build all rule trees.
        This method loads all required data in batch queries and then builds the trees.
        """
        if not rule_ids:
            return []

        # Step 1: Batch fetch all rules with their related data (groups, filters, targetTeams)
        rules_dict = self._fetch_rules_with_related_batch(db, rule_ids)

        # Step 2: Batch fetch all filter closure edges for all rules
        filter_closure_edges_dict = self._load_filter_closure_edges_batch(db, rule_ids)

        # Step 3: Extract all filter_ids from all rules
        filter_ids: set[uuid.UUID] = set()
        for rule in rules_dict.values():
            for group in rule.groups:
                for filter_item in group.filters:
                    filter_ids.add(filter_item.filterId)

        # Step 4: Batch fetch all filters with their related data (groups, conditions)
        filters_dict = self._fetch_filters_with_related_batch(db, list(filter_ids))

        # Step 5: Batch fetch all condition closure edges for all filters
        condition_closure_edges_dict = self._load_condition_closure_edges_batch(db, list(filter_ids))

        # Step 6: Build all filter trees using cached data
        filters_cache: dict[uuid.UUID, schemas.ChatAssignFilterTreeSchema] = {}
        for filter_id, filter_obj in filters_dict.items():
            closure_rows = condition_closure_edges_dict.get(filter_id, [])
            try:
                filter_tree = self._build_filter_tree(db, filter_id, filter=filter_obj, closure_rows=closure_rows)
                filters_cache[filter_id] = filter_tree
            except Exception as e:
                logger.warning(
                    f"Error building filter tree for filter {filter_id}: {e}",
                    extra={"filter_id": str(filter_id), "error_type": type(e).__name__},
                )
                # Continue with other filters even if one fails

        # Step 7: Build all rule trees using cached data
        rule_trees: list[schemas.ChatAssignRuleTreeSchema] = []
        for rule_id in rule_ids:
            if rule_id not in rules_dict:
                logger.warning(f"Rule {rule_id} not found in batch fetch results")
                continue

            rule_obj = rules_dict[rule_id]
            closure_rows = filter_closure_edges_dict.get(rule_id, [])

            try:
                rule_tree = self._build_rule_tree(
                    db, rule_id, rule=rule_obj, closure_rows=closure_rows, filters_cache=filters_cache
                )
                rule_trees.append(rule_tree)
            except Exception as e:
                logger.warning(
                    f"Error building rule tree for rule {rule_id}: {e}",
                    extra={"rule_id": str(rule_id), "error_type": type(e).__name__},
                )
                # Continue with other rules even if one fails

        return rule_trees

    def _get_active_rule_ids_by_organization(self, db: Session) -> list[uuid.UUID]:
        stmt = (
            select(ChatAssignRule.id).where(ChatAssignRule.isActive.is_(True)).order_by(desc(ChatAssignRule.createdAt))
        )
        result = db.execute(stmt)
        return [row[0] for row in result.all()]

    def delete_chat(self, db: Session, chat_id: uuid.UUID, organization: Organization) -> DeleteResult:
        """
        Completely deletes a chat and all related data following SQL cleanup steps.
        Used for cleaning up dummy/test data after UAT testing.

        Deletes all related data in proper order to avoid foreign key violations:
        1. chatAttributeValue records
        2. chatTags records
        3. chatTeamAssignment records
        4. chatActivity records
        5. chatMessage records
        6. note records
        7. attribute records
        8. chat record itself
        9. endUser record (only if no other chats exist for this user)
        10. surveyData records for deleted endUsers

        Args:
            db: Database session with tenant schema translation
            chat_id: UUID of the chat to delete
            organization: Organization object

        Returns:
            DeleteResult: Detailed result of the deletion operation

        Raises:
            ChatAssignmentError: If chat not found or doesn't belong to organization
        """
        logger.info(
            "Deleting chat and all related data",
            extra={
                "chat_id": str(chat_id),
                "organization": organization.name,
            },
        )

        # Validate chat exists in tenant schema
        chat = repository.chat.get(db, chat_id)
        if not chat:
            raise_error(
                ChatAssignmentError(
                    f"Chat not found for organization {organization.name}",
                    chat_id=str(chat_id),
                )
            )

        try:
            resp = repository.chat.close_chat_session(chat.endUserId, organization)
            if not resp:
                raise Exception("responded with empty response")
            logger.info(
                "Successfully closed chat session",
                extra={"endUserId": chat.endUserId, "chat_id": str(chat_id)},
            )
        except Exception as e:
            ExternalAPIError(settings.LIGLA_MESSAGE_CLOSE_ENDPOINT_PATH, 500, f"{e}").log()

        # Track deletion counts
        deleted_messages_count = 0
        deleted_activities_count = 0
        deleted_notes_count = 0
        deleted_chat_attributes_count = 0
        deleted_attributes_count = 0
        deleted_tags_count = 0
        deleted_team_assignments_count = 0

        # Step 1: Delete chatAttributeValue records (references chatId and attributeId)
        stmt = delete(ChatAttributeValue).where(ChatAttributeValue.chatId == chat_id)
        result = db.execute(stmt)
        deleted_chat_attributes_count = result.rowcount

        # Step 2: Delete chatTags records
        stmt = delete(ChatTags).where(ChatTags.chatId == chat_id)
        result = db.execute(stmt)
        deleted_tags_count = result.rowcount

        # Step 3: Delete chatTeamAssignment records
        stmt = delete(ChatTeamAssignment).where(ChatTeamAssignment.chatId == chat_id)
        result = db.execute(stmt)
        deleted_team_assignments_count = result.rowcount

        # Step 4: Delete chatActivity records

        stmt = delete(ChatActivity).where(ChatActivity.chatId == chat_id)
        result = db.execute(stmt)
        deleted_activities_count = result.rowcount

        # Step 5: Delete chatMessage records
        stmt = delete(ChatMessage).where(ChatMessage.chatId == chat_id)
        result = db.execute(stmt)
        deleted_messages_count = result.rowcount

        # Step 6: Delete note records
        stmt = delete(Note).where(Note.chatId == chat_id)
        result = db.execute(stmt)
        deleted_notes_count = result.rowcount

        # Step 7: Delete attribute records
        stmt = delete(Attribute).where(Attribute.chatId == chat_id)
        result = db.execute(stmt)
        deleted_attributes_count = result.rowcount

        # Step 8: Finally, delete the chat record itself
        stmt = delete(Chat).where(Chat.id == chat_id)
        result = db.execute(stmt)
        deleted_chat_count = result.rowcount

        if deleted_chat_count != 1:
            raise_error(
                ChatAssignmentError(
                    f"Expected to delete 1 chat, but deleted {deleted_chat_count}",
                    chat_id=str(chat_id),
                )
            )

        # Step 9: Check if endUser should be deleted (only if no other chats exist for this user)
        end_user_id = chat.endUserId
        end_user_deleted = False
        deleted_survey_count = 0

        if end_user_id:
            # Check if this endUser has any other chats
            other_chats_count = db.execute(
                select(func.count())
                .select_from(Chat)
                .where(Chat.endUserId == end_user_id, Chat.id != chat_id)  # Exclude the chat we're deleting
            ).scalar_one()

            if other_chats_count == 0:
                # Step 10: Delete surveyData related to the endUser BEFORE deleting the endUser
                # (due to foreign key constraints)
                stmt = delete(SurveyData).where(SurveyData.endUserId == end_user_id)
                survey_data_result = db.execute(stmt)
                deleted_survey_count = survey_data_result.rowcount

                # Now safe to delete endUser since no foreign key constraints remain
                stmt = delete(EndUser).where(EndUser.userId == end_user_id)
                result = db.execute(stmt)
                end_user_deleted = result.rowcount > 0
        else:
            deleted_survey_count = 0

        logger.info(
            "Chat and all related data deleted successfully",
            extra={
                "chat_id": str(chat_id),
                "organization": organization.name,
                "deleted_messages_count": deleted_messages_count,
                "deleted_activities_count": deleted_activities_count,
                "deleted_notes_count": deleted_notes_count,
                "deleted_chat_attributes_count": deleted_chat_attributes_count,
                "deleted_attributes_count": deleted_attributes_count,
                "deleted_tags_count": deleted_tags_count,
                "deleted_team_assignments_count": deleted_team_assignments_count,
                "end_user_deleted": end_user_deleted,
                "deleted_survey_count": deleted_survey_count,
            },
        )

        return DeleteResult(
            success=True,
            deleted_chat_id=chat_id,
            deleted_messages_count=deleted_messages_count,
            deleted_activities_count=deleted_activities_count,
            deleted_notes_count=deleted_notes_count,
            deleted_chat_attributes_count=deleted_chat_attributes_count,
            deleted_attributes_count=deleted_attributes_count,
            deleted_tags_count=deleted_tags_count,
            deleted_team_assignments_count=deleted_team_assignments_count,
            end_user_deleted=end_user_deleted,
            deleted_survey_count=deleted_survey_count,
        )


chat_assignment = CRUDChatAssignment(ChatTeamAssignment)
