import { useEffect, useMemo } from 'react';

import {
  ActiveStatusChip,
  ChipsWrapper,
  LabeledGrid,
  NewLine,
  ShowDialog,
  type ShowProps,
  SkeletonSuspense,
} from '~/common/components';
import { useTranslation } from '~/locales/hooks';
import { Content, useRulesActions } from '~/modules/Rules';
import { uniqueKey } from '~/utils';

export const Show = ({ id, onClose, dialogProps, depth }: ShowProps) => {
  const { targetRule, isFetchingOne, setTargetRule, removeTargetRule } = useRulesActions();
  const { t_management } = useTranslation();

  const teamOptions = useMemo(
    () => (targetRule?.targetTeams || []).map((t) => [t.name, t.id] as [string, string]),
    [targetRule?.targetTeams],
  );

  useEffect(() => {
    setTargetRule(String(id));
  }, [id, setTargetRule]);

  const handleClose = () => {
    removeTargetRule();
    onClose();
  };

  return (
    <ShowDialog
      onClose={handleClose}
      title={t_management('chatAssignRules.formTitle')}
      subTitle={t_management('subtitle.details')}
      isLoading={isFetchingOne}
      {...dialogProps}
    >
      <LabeledGrid
        width={700}
        rows={[
          [t_management('chatAssignRules.name'), targetRule?.name],
          [
            t_management('chatAssignRules.content'),
            targetRule && <Content data={targetRule} depth={depth} />,
          ],
          [t_management('note'), <NewLine key='note' text={targetRule?.note ?? ''} />],
          [
            t_management('chatAssignRules.appliedTeams'),
            <ChipsWrapper
              title={t_management('teams.title')}
              key={uniqueKey()}
              items={teamOptions}
              getChipLabel={(team) => team?.[0]}
              stackProps={{ flexWrap: 'wrap', maxWidth: 550 }}
            />,
          ],
          [
            t_management('status'),
            <SkeletonSuspense isLoading={isFetchingOne} key={uniqueKey()}>
              <ActiveStatusChip status={Boolean(targetRule?.isActive)} />
            </SkeletonSuspense>,
          ],
        ]}
      />
    </ShowDialog>
  );
};
