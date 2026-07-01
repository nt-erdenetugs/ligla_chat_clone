import { type SystemUserType } from '~/generated/graphql/types';
import { type IOrganizationBase } from '~/modules/Organizations/types/organization';
import { type ITeamBase } from '~/modules/Teams/types/team';

export interface IUser {
  id: string;
  displayName: string;
  senderName?: Nullable<string>;
  email: string;
  status: string;
  roleType: string;
  organization?: Nullable<
    Pick<IOrganizationBase, 'id' | 'name' | 'displayName' | 'fileUploadLiffId'>
  >;
  systemUserType: SystemUserType;
  pictureUrl?: Nullable<string>;
  qrUrl?: Nullable<string>;
  createdAt?: Nullable<Date>;
  teams?: Nullable<ITeamBase[]>;
}

export interface IEndUser {
  userId: string;
  clientUserId?: Nullable<string>;
  displayName?: Nullable<string>;
  pictureUrl?: Nullable<string>;
  createdAt?: Nullable<Date>;
  updatedAt?: Nullable<Date>;
}

export interface ISender {
  id: string;
  displayName?: Nullable<string>;
  senderName?: Nullable<string>;
  pictureUrl?: Nullable<string>;
}

export interface IOperatorCountObj {
  maxOperatorCount: number;
  operatorCount: number;
}
