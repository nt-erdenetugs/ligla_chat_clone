import { useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

import {
  ShowDialog,
  LabeledGrid,
  type ShowProps,
  ActiveStatusChip,
  SkeletonSuspense,
} from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import { useAttributesActions } from '~/modules/Attributes';
import { uniqueKey } from '~/utils';

export const Show = ({ id, onClose, dialogProps }: ShowProps) => {
  const { targetAttribute, isFetchingOne, setTargetAttribute } = useAttributesActions();

  const { t, t_management } = useTranslation();

  useEffect(() => {
    setTargetAttribute(String(id));
  }, [id, setTargetAttribute]);

  return (
    <ShowDialog
      onClose={onClose}
      title={t_management('attributes.title')}
      subTitle={t_management('subtitle.details')}
      cancelText={t('actions.cancel')}
      isLoading={isFetchingOne}
      {...dialogProps}
    >
      <LabeledGrid
        rows={[
          [
            t_management('attributes.name'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              {targetAttribute?.name}
            </SkeletonSuspense>,
          ],
          [
            t_management('status'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              <ActiveStatusChip status={Boolean(targetAttribute?.isActive)} enableToggle={false} />
            </SkeletonSuspense>,
          ],
          [
            t_management('attributes.type'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              {targetAttribute?.type}
            </SkeletonSuspense>,
          ],
          targetAttribute?.type === 'selection'
            ? [
                t_management('attributes.selectOptions'),
                <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Array.isArray(targetAttribute?.selectOption)
                      ? targetAttribute.selectOption.map((option) => (
                          <Chip
                            key={uniqueKey()}
                            label={String(option.value)}
                            variant='outlined'
                            color='primary'
                          />
                        ))
                      : t_management('-')}
                  </Box>
                </SkeletonSuspense>,
              ]
            : undefined,
          [
            t_management('attributes.isEncrypted'),
            <SkeletonSuspense key={uniqueKey()} isLoading={isFetchingOne}>
              {targetAttribute?.isEncryptionEnabled ? t_management('yes') : t_management('no')}
            </SkeletonSuspense>,
          ],
        ]}
        sx={{
          py: 3,
          my: 3,
        }}
      />
    </ShowDialog>
  );
};
