import { useEffect } from 'react';

import { Stack, Typography } from '@mui/material';

import { ShowDialog, LabeledGrid, type ShowProps, SkeletonSuspense } from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import { useStoreActions } from '~/modules/Stores';
import { formatYYYYMMDDHHmmss } from '~/plugins';
import { uniqueKey } from '~/utils';

export const Show = ({ id, onClose, dialogProps }: ShowProps) => {
  const { targetStore, isFetchingOne, setTargetStore, removeTargetStore } = useStoreActions();

  const { t, t_management } = useTranslation();

  useEffect(() => {
    setTargetStore(String(id));
  }, [id, setTargetStore]);

  const handleClose = () => {
    onClose();
    removeTargetStore();
  };

  return (
    <ShowDialog
      onClose={handleClose}
      title={t_management('stores.title')}
      subTitle={t_management('subtitle.details')}
      cancelText={t('actions.close')}
      isLoading={isFetchingOne}
      editDisabled
      {...dialogProps}
    >
      <LabeledGrid
        rows={[
          [
            t_management('stores.liglaStoreID'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              {targetStore?.liglaStoreId}
            </SkeletonSuspense>,
          ],
          [
            t_management('stores.name'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              {targetStore?.name}
            </SkeletonSuspense>,
          ],
          [
            t_management('stores.locationArea'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              {targetStore?.areaName}
            </SkeletonSuspense>,
          ],
          [
            t_management('stores.facilityType'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              {targetStore?.typeName}
            </SkeletonSuspense>,
          ],
          [
            t_management('stores.displayPeriod'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              <Stack gap={1}>
                <Stack direction='row' gap={1}>
                  <Typography color='grey.500'>{t('actions.start')}:</Typography>
                  {formatYYYYMMDDHHmmss(targetStore?.startsAt) || '-'}
                </Stack>
                <Stack direction='row' gap={1}>
                  <Typography color='grey.500'>{t('actions.end')}:</Typography>
                  {formatYYYYMMDDHHmmss(targetStore?.endsAt) || '-'}
                </Stack>
              </Stack>
            </SkeletonSuspense>,
          ],
          [
            t_management('stores.note'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              {targetStore?.note}
            </SkeletonSuspense>,
          ],
        ]}
      />
    </ShowDialog>
  );
};
