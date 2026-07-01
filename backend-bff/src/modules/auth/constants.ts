import { UserRoleType, SystemUserType } from '@/modules/user/enums';

export const SALT_OR_ROUNDS = 10;

export const adminRoles: string[] = [UserRoleType.ADMIN, UserRoleType.ADMIN_OPERATOR];
export const managerRoles: string[] = [UserRoleType.MANAGER, UserRoleType.MANAGER_OPERATOR];
export const operatorRoles: string[] = [UserRoleType.OPERATOR];
export const adminManagerRoles: string[] = [...adminRoles, ...managerRoles];
export const managerOperatorRoles: string[] = [...managerRoles, ...operatorRoles];
export const allUserRoles: string[] = [...adminRoles, ...managerRoles, ...operatorRoles];
export const allOperatorRoles: string[] = [
  ...operatorRoles,
  UserRoleType.ADMIN_OPERATOR,
  UserRoleType.MANAGER_OPERATOR,
];
export const allNonOperatorRoles: string[] = [UserRoleType.ADMIN, UserRoleType.MANAGER];
export const adminAndHypervisorRoles: string[] = [...adminRoles, SystemUserType.HYPERVISOR];
export const adminManagerAndHypervisorRoles: string[] = [
  ...adminManagerRoles,
  SystemUserType.HYPERVISOR,
];
export const allUserRolesAndHypervisor: string[] = [...allUserRoles, SystemUserType.HYPERVISOR];
