import { UserStatusType } from '~/common/constants';
import { useTranslation } from '~/locales/hooks';
import { type IUser } from '~/modules/Users';

export type ChipColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning';

const DEFAULT_STATUS_COLORS: Record<UserStatusType, ChipColor> = {
  [UserStatusType.ACTIVE]: 'success',
  [UserStatusType.INACTIVE]: 'secondary',
  [UserStatusType.LOCKED]: 'error',
  [UserStatusType.PENDING]: 'warning',
};

type propType = {
  status: string;
  customStatusColors?: Partial<Record<UserStatusType, ChipColor>>;
  fallbackColor?: ChipColor;
};
export const useUserChip = () => {
  const { t_management } = useTranslation();

  const getUserStatusChipColor = ({
    status,
    customStatusColors = {},
    fallbackColor = 'default',
  }: propType): ChipColor => {
    const statusColors: Record<UserStatusType, ChipColor> = {
      ...DEFAULT_STATUS_COLORS,
      ...customStatusColors,
    };
    return statusColors[status as UserStatusType] ?? fallbackColor;
  };

  const getChipLabelWithStatus = (
    user: Pick<IUser, 'displayName' | 'email' | 'status'>,
  ): string => {
    const userNameOrEmail = user.displayName || user.email;
    return user.status === UserStatusType.ACTIVE
      ? userNameOrEmail
      : `${userNameOrEmail} (${t_management(user.status.toLowerCase())})`;
  };

  return {
    getUserStatusChipColor,
    getChipLabelWithStatus,
  };
};
