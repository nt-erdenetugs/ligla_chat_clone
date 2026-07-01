import { useEffect, useState } from 'react';

import { Chip } from '@mui/material';
import { useSearchParams } from 'react-router';
import SimpleBar from 'simplebar-react';

import {
  type ShowProps,
  ActiveStatusChip,
  SkeletonSuspense,
  ShowDialog,
  LabeledGrid,
  NewLine,
} from '~/common/components';
import { ACTION_PARAM_KEY, ACTIONS_TYPE } from '~/common/constants';
import { useTranslation } from '~/locales/hooks';
import { uniqueKey } from '~/utils';

import { ConditionsBuilder, FilterForm, useFiltersActions, useForm } from '..';

type ShowFilterProps = ShowProps & {
  disableUrlParams?: boolean;
};

export const Show = ({ id, dialogProps, onClose, disableUrlParams = true }: ShowFilterProps) => {
  const { targetFilter, isFetchingOne, setTargetFilter, removeTargetFilter } = useFiltersActions();
  const { t_management } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    if (!id) return;

    setTargetFilter(String(id));
  }, [id, setTargetFilter]);

  const { control } = useForm({
    values: targetFilter
      ? {
          name: targetFilter.name,
          targetTable: targetFilter.targetTable,
          note: targetFilter.note ?? '',
          isActive: targetFilter.isActive,
          rootConditionGroup: targetFilter.rootConditionGroup,
        }
      : undefined,
  });

  const handleEdit = () => {
    if (disableUrlParams) return setShowEdit(true);

    const { actionKey, paramSuffix } = dialogProps || {};
    searchParams.set(
      actionKey || ACTION_PARAM_KEY,
      `${ACTIONS_TYPE.EDIT}${paramSuffix ? paramSuffix : ''}`,
    );
    setSearchParams(searchParams);
  };

  const handleClose = () => {
    removeTargetFilter();
    onClose();
  };

  return (
    <>
      <ShowDialog
        open
        onClose={handleClose}
        onEdit={handleEdit}
        title={t_management('chatAssignFilters.formTitle')}
        subTitle={t_management('subtitle.details')}
        isLoading={isFetchingOne}
        sx={{ zIndex: (theme) => theme.zIndex.modal }}
      >
        <LabeledGrid
          width='max-content'
          maxWidth='50vw'
          rows={[
            [t_management('chatAssignFilters.name'), targetFilter?.name],
            [
              t_management('chatAssignFilters.targetTable'),
              <Chip
                key='targetTable'
                sx={{ width: '5.5rem', fontWeight: 'bold', fontSize: '0.75rem' }}
                label={t_management(`chatAssignFilters.${targetFilter?.targetTable.toLowerCase()}`)}
              />,
            ],
            [
              <SimpleBar key='conditions' forceVisible='x'>
                <ConditionsBuilder control={control} readOnly />
              </SimpleBar>,
            ],
            [t_management('note'), <NewLine key='note' text={targetFilter?.note ?? ''} />],
            [
              t_management('status'),
              <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
                <ActiveStatusChip status={Boolean(targetFilter?.isActive)} />
              </SkeletonSuspense>,
            ],
          ]}
        />
      </ShowDialog>
      {showEdit && <FilterForm id={id} onClose={() => setShowEdit(false)} />}
    </>
  );
};
