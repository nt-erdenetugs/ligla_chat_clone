import { getChatStatusLabel } from '~/common/constants';
import { ActivityType, ActorType, ChatTeamAssignActionsType } from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { ActivityBubbleWrapper, type IChatActivity } from '~/modules/Chat';

type PropsType = {
  activity: IChatActivity;
};

export const ActivityBubble = ({ activity }: PropsType) => {
  const {
    activityType,
    actorType,
    actorUserName,
    newStatus,
    newUserName,
    changedTeamName,
    teamAssignAction,
    createdAt,
  } = activity;

  const { t_chat } = useTranslation();

  const renderActivityMessage = () => {
    switch (activityType) {
      case ActivityType.UserAdded: {
        return t_chat('activity.userAdded');
      }
      case ActivityType.StatusChange: {
        if (actorType === ActorType.System && !newStatus) return t_chat('activity.chatStarted');

        if (!newStatus) return t_chat('activity.unavailable');

        const status = t_chat(`status.${getChatStatusLabel(newStatus)}`);
        return actorType === ActorType.User
          ? t_chat('activity.statusChangedByUser', { actorUserName, status })
          : t_chat('activity.statusChangedBySystem', { status });
      }
      case ActivityType.UserChange: {
        if (!newUserName) return t_chat('activity.unavailable');

        if (actorType === ActorType.System)
          return t_chat('activity.assignedUserChangedBySystem', {
            assignedUserName: newUserName,
          });

        return t_chat('activity.assignedUserChangedByUser', {
          actorUserName,
          assignedUserName: newUserName,
        });
      }
      case ActivityType.TeamsChange: {
        if (!changedTeamName || !teamAssignAction) return t_chat('activity.unavailable');

        const actionKey =
          teamAssignAction === ChatTeamAssignActionsType.Added
            ? actorType === ActorType.User
              ? 'activity.teamAssignedByUser'
              : 'activity.teamAssignedBySystem'
            : 'activity.teamUnassigned';

        return t_chat(actionKey, {
          actorUserName,
          teamName: changedTeamName,
        });
      }
      case ActivityType.UserFollowed: {
        if (actorType === ActorType.System && !newStatus) {
          return t_chat('activity.userUnblocked');
        }

        return t_chat('activity.unavailable');
      }
      case ActivityType.UserFollowedNew: {
        if (actorType === ActorType.System && !newStatus) {
          return t_chat('activity.userFollowed');
        }

        return t_chat('activity.unavailable');
      }
      case ActivityType.UserUnfollowed:
      case ActivityType.EndSession:
      case ActivityType.SessionTimeout: {
        const endedKey = {
          [ActivityType.UserUnfollowed]: 'activity.userBlocked',
          [ActivityType.EndSession]: 'activity.chatEnded',
          [ActivityType.SessionTimeout]: 'activity.sessionTimeout',
        }[activityType];

        if (actorType === ActorType.System && !newStatus) {
          return t_chat(endedKey);
        }

        return t_chat('activity.unavailable');
      }
      default:
        return t_chat('activity.unavailable');
    }
  };

  return (
    <ActivityBubbleWrapper
      actorType={actorType}
      createdAt={createdAt}
      activityText={renderActivityMessage()}
    />
  );
};
