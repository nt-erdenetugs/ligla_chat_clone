import { useCallback, useMemo, useState } from 'react';

import { type OptionValueType } from '~/common/components';
import { CHAT_FILTER_STORAGE_KEY } from '~/common/constants';
import { QUERY_RESPONSE_KEYS, useInfiniteQuery } from '~/common/hooks/useInfiniteQuery';
import { useAuthContext } from '~/context/AuthContext';
import {
  AllSelectableOperatorsDocument,
  type AllSelectableOperatorsQuery,
  ChatStatus,
  ManagersDocument,
  type ManagersQuery,
  UserRoleType,
  type AdminOperatorsQuery,
  AdminOperatorsDocument,
  type CursorPaginatedTagsQuery,
  CursorPaginatedTagsDocument,
  type ChatFilterInput,
} from '~/generated/graphql/types';
import { useTeamQueries } from '~/modules/Teams';
import { type IUser } from '~/modules/Users';
import { convertEmptyArrayToNull, isObject, isUser } from '~/utils';

import { ChatFiltersType, type IChatFilters } from '../types';

export type FilterItem = OptionValueType<string> & {
  roleType?: string;
};

export type FilterCategoriesType = Record<ChatFiltersType, { labelKey: string; count: number }>;

export type UseChatFiltersType = {
  filters: IChatFilters;
  filtersOptions: Record<ChatFiltersType, FilterItem[]>;
  filterCategories: FilterCategoriesType;
  isFiltersApplied: boolean;
  isFetchingAllOptions: boolean;
  setFilters: <T extends keyof IChatFilters>(filterType: T, value: IChatFilters[T]) => void;
  applyFilters: (filters: IChatFilters) => void;
  clearFilters: () => void;
  initializeFilters: () => void;
};

export const defaultFilters: IChatFilters = {
  tags: [],
  teams: [],
  statuses: [],
  users: [],
  includeUnassigned: false,
};

export const getMeFilters = (userId: string) => ({
  ...defaultFilters,
  [ChatFiltersType.Users]: [userId],
});

export const isFiltersEmpty = (filters: IChatFilters) => {
  const { includeUnassigned, statuses, tags, teams, users } = filters;

  return (
    !includeUnassigned &&
    statuses.length === 0 &&
    tags.length === 0 &&
    teams.length === 0 &&
    users.length === 0
  );
};

const mapToOption = <T extends { id: string; name: string } | ChatStatus | IUser>(
  data: T,
): FilterItem => {
  if (typeof data === 'string') {
    return { value: data, label: data };
  }

  if (isUser(data)) {
    const { id, displayName, roleType } = data;
    return { value: id, label: displayName, roleType };
  }

  const { id, name } = data;

  return { value: id, label: name };
};

const STATUS_FILTER_OPTIONS = Object.values(ChatStatus).map(mapToOption);

const validateStatuses = (selectedStatuses: string[]) =>
  selectedStatuses.filter((status) => STATUS_FILTER_OPTIONS.some((s) => s.value === status));

const validateUsersInTeams = (user: IUser, teamIds: string[]) =>
  user.teams?.some((team) => teamIds.includes(team.id));

const validateBoolean = (data: any) => (typeof data === 'boolean' ? data : false);

const isValidChatFilters = (data: unknown): data is IChatFilters => {
  return (
    isObject(data) &&
    Object.values(ChatFiltersType).every(
      (key) =>
        Array.isArray((data as Record<string, unknown>)[key]) &&
        (data as Record<string, unknown[]>)[key].every((item) => typeof item === 'string'),
    ) &&
    typeof (data as IChatFilters).includeUnassigned === 'boolean'
  );
};

export function useChatFilters(getChats: (filters: ChatFilterInput) => void): UseChatFiltersType {
  const { isAdminUser } = useAuthContext();
  const { selectableTeamsForChatFilter, isFetchingTeamsForChatFilter } = useTeamQueries();

  const { data: allSelectableOperators, loading: isFetchingAllSelectableOperators } =
    useInfiniteQuery<
      typeof QUERY_RESPONSE_KEYS.allSelectableOperators,
      AllSelectableOperatorsQuery
    >(AllSelectableOperatorsDocument, QUERY_RESPONSE_KEYS.allSelectableOperators, {
      pickAll: true,
    });

  const { data: managers, loading: isFetchingAllManagers } = useInfiniteQuery<
    typeof QUERY_RESPONSE_KEYS.managers,
    ManagersQuery
  >(ManagersDocument, QUERY_RESPONSE_KEYS.managers, {
    pickAll: true,
    skipInitialFetch: !isAdminUser,
  });

  const { data: adminOperators, loading: isFetchingAdminOperators } = useInfiniteQuery<
    typeof QUERY_RESPONSE_KEYS.adminOperators,
    AdminOperatorsQuery
  >(AdminOperatorsDocument, QUERY_RESPONSE_KEYS.adminOperators, {
    pickAll: true,
    skipInitialFetch: !isAdminUser,
  });

  const { data: tags, loading: isFetchingAllTags } = useInfiniteQuery<
    typeof QUERY_RESPONSE_KEYS.cursorPaginatedTags,
    CursorPaginatedTagsQuery
  >(CursorPaginatedTagsDocument, QUERY_RESPONSE_KEYS.cursorPaginatedTags, { pickAll: true });

  const [filters, _setFilters] = useState(defaultFilters);
  const [isFiltersApplied, setIsFiltersApplied] = useState(false);

  const isFetchingAllOptions = useMemo(
    () =>
      isFetchingAllTags ||
      isFetchingTeamsForChatFilter ||
      isFetchingAllSelectableOperators ||
      isFetchingAllManagers ||
      isFetchingAdminOperators,
    [
      isFetchingAllManagers,
      isFetchingAllSelectableOperators,
      isFetchingAllTags,
      isFetchingTeamsForChatFilter,
      isFetchingAdminOperators,
    ],
  );

  const teamFilterOptions = useMemo(
    () => selectableTeamsForChatFilter.map(mapToOption),
    [selectableTeamsForChatFilter],
  );

  const tagFilterOptions = useMemo(
    () => tags?.filter((tag) => tag.isActive).map(mapToOption) || [],
    [tags],
  );

  const allUsersOptions = useMemo(() => {
    const managerOperators = managers?.filter(
      (manager) => manager.roleType === UserRoleType.ManagerOperator,
    );
    return [...(managerOperators || []), ...(allSelectableOperators || [])];
  }, [allSelectableOperators, managers]);

  const getUserFilterOptions = useCallback(
    (teamIds = filters[ChatFiltersType.Teams]) => {
      const users = isAdminUser ? [...allUsersOptions, ...(adminOperators ?? [])] : allUsersOptions;

      return (
        teamIds.length > 0 ? users.filter((user) => validateUsersInTeams(user, teamIds)) : users
      ).map(mapToOption);
    },
    [filters, allUsersOptions, isAdminUser, adminOperators],
  );

  const filtersOptions: Record<ChatFiltersType, FilterItem[]> = useMemo(
    () => ({
      teams: teamFilterOptions,
      tags: tagFilterOptions,
      statuses: STATUS_FILTER_OPTIONS,
      users: getUserFilterOptions(),
    }),
    [tagFilterOptions, teamFilterOptions, getUserFilterOptions],
  );

  const filterCategories: FilterCategoriesType = useMemo(
    () => ({
      [ChatFiltersType.Teams]: {
        labelKey: 'teams.title',
        count: filters[ChatFiltersType.Teams].length,
      },
      [ChatFiltersType.Users]: {
        labelKey: 'users.title',
        count: filters[ChatFiltersType.Users].length + (filters.includeUnassigned === true ? 1 : 0),
      },
      [ChatFiltersType.Statuses]: {
        labelKey: 'status',
        count: filters[ChatFiltersType.Statuses].length,
      },
      [ChatFiltersType.Tags]: {
        labelKey: 'tags.title',
        count: filters[ChatFiltersType.Tags].length,
      },
    }),
    [filters],
  );

  const validateUsers = useCallback(
    (selectedUsers: string[], teamIds: string[]) => {
      const availableUserOptions = getUserFilterOptions(teamIds);
      return selectedUsers.filter((userId) =>
        availableUserOptions.some((option) => option.value === userId),
      );
    },
    [getUserFilterOptions],
  );

  const validateTeams = useCallback(
    (selectedTeams: string[]) =>
      selectedTeams.filter((teamId) => teamFilterOptions.some((option) => option.value === teamId)),
    [teamFilterOptions],
  );

  const validateTags = useCallback(
    (selectedTags: string[]) =>
      selectedTags.filter((tagId) => tagFilterOptions.some((tag) => tag.value === tagId)),
    [tagFilterOptions],
  );

  // Update validateFilters to include all validations
  const validateFilters = useCallback(
    (filters: IChatFilters): IChatFilters => {
      const { statuses, tags, teams, users, includeUnassigned } = filters;

      const validatedTeams = validateTeams(teams);

      return {
        teams: validateTeams(teams),
        users: validateUsers(users, validatedTeams),
        statuses: validateStatuses(statuses),
        tags: validateTags(tags),
        includeUnassigned: validateBoolean(includeUnassigned),
      };
    },
    [validateTags, validateTeams, validateUsers],
  );

  const validateAndSaveFilters = useCallback(
    (filters: IChatFilters) => {
      const validatedFilters = validateFilters(filters);
      localStorage.setItem(CHAT_FILTER_STORAGE_KEY, JSON.stringify(validatedFilters));
      return validatedFilters;
    },
    [validateFilters],
  );

  const applyFilters = useCallback(
    (filters: IChatFilters) => {
      const { teams, users, tags, statuses, includeUnassigned } = validateFilters(filters);

      getChats({
        teamIds: convertEmptyArrayToNull(teams),
        userIds: convertEmptyArrayToNull(users),
        tagIds: convertEmptyArrayToNull(tags),
        includeUnassigned: includeUnassigned ?? null,
        statuses: convertEmptyArrayToNull(statuses as ChatStatus[]),
      });
    },
    [getChats, validateFilters],
  );

  const setFilters = useCallback(
    <T extends keyof IChatFilters>(filterType: T, value: IChatFilters[T]) => {
      _setFilters((prev) => {
        const newFilters = validateAndSaveFilters({ ...prev, [filterType]: value });
        applyFilters(newFilters);
        return newFilters;
      });
    },
    [applyFilters, validateAndSaveFilters],
  );

  const clearFilters = useCallback(() => {
    _setFilters(defaultFilters);
    applyFilters(defaultFilters);
    localStorage.removeItem(CHAT_FILTER_STORAGE_KEY);
  }, [applyFilters]);

  const initializeFilters = useCallback(() => {
    try {
      if (isFiltersApplied) return;

      const savedFilters = localStorage.getItem(CHAT_FILTER_STORAGE_KEY);

      if (!savedFilters) {
        _setFilters(defaultFilters);
        return setIsFiltersApplied(true);
      }

      const parsedFilters = JSON.parse(savedFilters) as unknown;

      if (!isValidChatFilters(parsedFilters)) {
        throw new Error('Chat filters in localStorage is not valid!');
      }

      // Ensure we have the necessary data loaded before validation
      if (isFetchingAllOptions) return;
      const validatedFilters = validateFilters(parsedFilters);

      setIsFiltersApplied(true);
      _setFilters(validatedFilters);
    } catch {
      setIsFiltersApplied(true);
      _setFilters(defaultFilters);
      localStorage.removeItem(CHAT_FILTER_STORAGE_KEY);
    }
  }, [isFetchingAllOptions, isFiltersApplied, validateFilters]);

  return {
    filters,
    filtersOptions,
    filterCategories,
    isFiltersApplied,
    isFetchingAllOptions,
    setFilters,
    applyFilters,
    clearFilters,
    initializeFilters,
  };
}
