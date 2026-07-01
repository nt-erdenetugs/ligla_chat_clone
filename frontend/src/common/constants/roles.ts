import { UserRoleType } from '~/generated/graphql/types';

export const enum Role {
  HYPERVISOR = 'HYPERVISOR',
  USER = 'USER',
}

export const UserRoleTypes: string[] = Object.values(UserRoleType);

export const adminRoles: string[] = [UserRoleType.Admin, UserRoleType.AdminOperator];
export const managerRoles: string[] = [UserRoleType.Manager, UserRoleType.ManagerOperator];
export const adminManagerRoles: string[] = [...adminRoles, ...managerRoles];
export const operatorRoles: string[] = [UserRoleType.Operator];
export const allOperatorRoles: string[] = [
  UserRoleType.Operator,
  UserRoleType.AdminOperator,
  UserRoleType.ManagerOperator,
];

const ROLE_LABELS: Record<string, string> = {
  [UserRoleType.Admin]: 'admin',
  [UserRoleType.AdminOperator]: 'adminOperator',
  [UserRoleType.Manager]: 'manager',
  [UserRoleType.ManagerOperator]: 'managerOperator',
  [UserRoleType.Operator]: 'operator',
};

export const getRoleLabel = (role: string): string => {
  return ROLE_LABELS[role] || '';
};
