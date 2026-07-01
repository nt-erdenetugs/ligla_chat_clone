import { type InfoField, type ITeamsInChat } from '~/modules/Chat';
import { type ITeamBase } from '~/modules/Teams';
import { formatYYYYMMDDHHmm } from '~/plugins';

export const getDisplayNames = (displayName: string = '') => {
  const defaultName = 'unknown name';

  if (!displayName.trim()) {
    return {
      nameFirstChars: defaultName.charAt(0).toUpperCase(),
      fullName: defaultName,
    };
  }

  return {
    fullName: displayName,
  };
};

type IsOperatorInOtherTeamsParams = {
  isAdmin: boolean;
  operatorId: string;
  teams: ITeamBase[];
  teamsInChat: ITeamsInChat[];
};

export const isOperatorInOtherTeams = (params: IsOperatorInOtherTeamsParams) => {
  const { isAdmin, teams, teamsInChat, operatorId } = params;

  if (isAdmin) return false;

  const assignedTeamIds = teams.map((team) => team.id) || [];
  const unassignedTeams = teamsInChat.filter((team) => !assignedTeamIds.includes(team.id));
  const assignedTeams = teamsInChat.filter((team) => assignedTeamIds.includes(team.id));

  const isOperatorInAssignedTeams = assignedTeams.some((team) =>
    team.operators.some((operator) => operator.id === operatorId),
  );

  if (isOperatorInAssignedTeams) return false;

  return unassignedTeams.some((team) =>
    team.operators.some((operator) => operator.id === operatorId),
  );
};

export const formatFieldValue = (field: InfoField): string => {
  if (!field.value) return '-';

  const isDateTimeField = field.columnName.toLowerCase().includes('datetime');

  if (isDateTimeField) {
    const formattedDate = formatYYYYMMDDHHmm(field.value);
    if (!formattedDate || formattedDate === 'Invalid datetime') {
      return String(field.value);
    }
    return formattedDate;
  }

  return String(field.value);
};
