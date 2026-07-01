import { useState, useEffect, useCallback } from 'react';

import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router';

import {
  CreateChatAssignRuleDocument,
  type CreateChatAssignRuleMutation,
  ChatAssignRuleDocument,
  type ChatAssignRuleQuery,
  ChatAssignRulesDocument,
  type ChatAssignRulesQuery,
  UpdateChatAssignRuleDocument,
  type UpdateChatAssignRuleMutation,
  DeleteChatAssignRuleDocument,
  type DeleteChatAssignRuleMutation,
  type ChatAssignRule,
  type CreateChatAssignRuleInput,
  type UpdateChatAssignRuleInput,
  type ChatAssignFilterGroup,
  type CreateFilterGroupInput,
} from '~/generated/graphql/types';
import { useTranslation } from '~/locales/hooks';
import { PAGES, PAGES_PATH_MAP } from '~/routes/sidebar';
import { onError } from '~/utils';

import { FilterGroupItemType, isGroup, withKeyAndType, type IFilterGroup, type Inputs } from '..';

export type MappedChatAssignRule = Inputs & Pick<ChatAssignRule, 'id' | 'targetTeams'>;

const mapFilterGroup = (group: IFilterGroup): CreateFilterGroupInput => {
  const filterIds: string[] = [];
  const subGroups: CreateFilterGroupInput[] = [];

  for (const item of group.items) {
    if (isGroup(item)) {
      subGroups.push(mapFilterGroup(item));
    } else {
      filterIds.push(item.id);
    }
  }

  const input: CreateFilterGroupInput = {
    filterIds,
    logicalOperator: group.logicalOperator,
  };

  if (subGroups.length > 0) {
    input.subGroups = subGroups;
  }

  return input;
};

export const mapInputsToChatAssignRuleInput = (inputs: Inputs, id?: string) => {
  const baseData = {
    name: inputs.name,
    note: inputs.note || undefined,
    targetTeamIds: inputs.targetTeamIds.length > 0 ? inputs.targetTeamIds : undefined,
    rootFilterGroup:
      inputs.rootFilterGroup.items.length > 0 ? mapFilterGroup(inputs.rootFilterGroup) : undefined,
  };

  return id
    ? ({ ...baseData, id, isActive: inputs.isActive } as UpdateChatAssignRuleInput)
    : (baseData as CreateChatAssignRuleInput);
};

export const useRulesActions = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { t_toasts } = useTranslation();
  const navigate = useNavigate();

  const [rules, setRules] = useState<ChatAssignRule[]>([]);
  const [targetRule, _setTargetRule] = useState<Nullish<MappedChatAssignRule>>(null);

  const { data: rulesData, loading: isFetchingAll } =
    useQuery<ChatAssignRulesQuery>(ChatAssignRulesDocument);

  const [getRule, { data: ruleData, loading: isFetchingOne, error: getRuleError }] =
    useLazyQuery<ChatAssignRuleQuery>(ChatAssignRuleDocument, { errorPolicy: 'all' });

  const [_createRule, { loading: isCreating }] = useMutation<CreateChatAssignRuleMutation>(
    CreateChatAssignRuleDocument,
    {
      refetchQueries: ['chatAssignRules'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('chatAssignRules.success.create'), { variant: 'success' });
      },
      onError,
    },
  );

  const [_updateRule, { loading: isUpdating }] = useMutation<UpdateChatAssignRuleMutation>(
    UpdateChatAssignRuleDocument,
    {
      refetchQueries: ['chatAssignRules'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('chatAssignRules.success.update'), { variant: 'success' });
      },
      onError,
    },
  );

  const [_disableRule, { loading: isDeleting }] = useMutation<DeleteChatAssignRuleMutation>(
    DeleteChatAssignRuleDocument,
    {
      refetchQueries: ['chatAssignRules'],
      onCompleted: () => {
        enqueueSnackbar(t_toasts('chatAssignRules.success.delete'), { variant: 'success' });
      },
      onError,
    },
  );

  const disableRule = async (id: string) => {
    await _disableRule({
      variables: {
        id,
      },
    });
  };

  const mapRule = (rule: ChatAssignRule): MappedChatAssignRule => {
    const { rootFilterGroup } = rule;

    const aggregateGroup = (rootGroup: ChatAssignFilterGroup): IFilterGroup => {
      return withKeyAndType(
        {
          ...rootGroup,
          items: [
            ...(rootGroup.filters ?? []).map((f) => withKeyAndType(f, FilterGroupItemType.Filter)),
            ...(rootGroup.subGroups ?? []).map((sub) => aggregateGroup(sub)),
          ],
        },
        FilterGroupItemType.Group,
      );
    };

    return {
      ...rule,
      targetTeamIds: rule.targetTeams.map((t) => t.id),
      rootFilterGroup: aggregateGroup(rootFilterGroup),
    };
  };

  useEffect(() => {
    if (!rulesData) return;

    setRules(rulesData.chatAssignRules.items);
  }, [rulesData]);

  useEffect(() => {
    if (!ruleData) return;

    _setTargetRule(mapRule(ruleData.chatAssignRule));
  }, [ruleData]);

  useEffect(() => {
    if (getRuleError) {
      console.error(getRuleError.message);
      enqueueSnackbar(getRuleError.message, { variant: 'error' });
      navigate(`/${PAGES_PATH_MAP[PAGES.ASSIGN_RULES]}`, { replace: true });
    }
  }, [getRuleError, navigate, enqueueSnackbar]);

  const setTargetRule = useCallback(
    (id: string) => {
      const currentData = rules.find((rule) => rule.id === id);
      if (currentData) return _setTargetRule(mapRule(currentData));

      getRule({ variables: { id } });
    },
    [getRule, rules],
  );

  const removeTargetRule = () => {
    _setTargetRule(null);
  };

  const createRule = async (inputs: Inputs) => {
    const variables = {
      createChatAssignRuleInput: mapInputsToChatAssignRuleInput(inputs),
    };

    await _createRule({ variables });
  };

  const updateRule = async (inputs: Inputs) => {
    if (!targetRule?.id) {
      enqueueSnackbar(t_toasts('chatAssignRules.error.noRuleSelected'), { variant: 'error' });
      return;
    }

    const variables = {
      updateChatAssignRuleInput: mapInputsToChatAssignRuleInput(inputs, targetRule.id),
    };

    await _updateRule({ variables });
  };

  const toggleRuleStatus = async (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;

    await _updateRule({
      variables: {
        updateChatAssignRuleInput: {
          id,
          isActive: !rule.isActive,
        },
      },
    });
  };

  return {
    rules,
    targetRule,
    isFetchingAll,
    isFetchingOne,
    isCreating,
    isUpdating,
    isDeleting,
    setTargetRule,
    removeTargetRule,
    createRule,
    updateRule,
    disableRule,
    toggleRuleStatus,
  };
};
