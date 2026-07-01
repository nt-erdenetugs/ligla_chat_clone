import { registerEnumType } from '@nestjs/graphql';

import { inferEnum, InferEnumType } from '@/drizzle/utils';
import { roletype, userstatus } from '@@/drizzle/enums';

export enum SystemUserType {
  USER = 'USER',
  HYPERVISOR = 'HYPERVISOR',
}

export const UserRoleType = inferEnum(roletype);
export type UserRoleType = InferEnumType<typeof roletype.enumValues>;

export const UserStatusType = inferEnum(userstatus);
export type UserStatusType = InferEnumType<typeof userstatus.enumValues>;

registerEnumType(SystemUserType, {
  name: 'SystemUserType',
});

registerEnumType(UserRoleType, {
  name: 'UserRoleType',
});

registerEnumType(UserStatusType, {
  name: 'UserStatusType',
});
