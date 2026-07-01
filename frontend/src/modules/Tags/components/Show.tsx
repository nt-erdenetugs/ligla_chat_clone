import { useEffect } from 'react';

import {
  ShowDialog,
  LabeledGrid,
  type ShowProps,
  ActiveStatusChip,
  SkeletonSuspense,
} from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import { useTagActions } from '~/modules/Tags';
import { uniqueKey } from '~/utils';

export const Show = ({ id, onClose, dialogProps }: ShowProps) => {
  const { targetTag, isFetchingOne, setTargetTag } = useTagActions();
  const { t, t_management } = useTranslation();

  useEffect(() => {
    setTargetTag(String(id));
  }, [id, setTargetTag]);

  return (
    <ShowDialog
      onClose={onClose}
      title={t_management('tags.title')}
      subTitle={t_management('subtitle.details')}
      cancelText={t('actions.close')}
      isLoading={isFetchingOne}
      {...dialogProps}
    >
      <LabeledGrid
        rows={[
          [
            t_management('tags.name'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              {targetTag?.name}
            </SkeletonSuspense>,
          ],
          [
            t_management('status'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              <ActiveStatusChip status={Boolean(targetTag?.isActive)} />
            </SkeletonSuspense>,
          ],
        ]}
      />
    </ShowDialog>
  );
};
