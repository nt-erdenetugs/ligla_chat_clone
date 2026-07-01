import { type IUser } from '~/modules/Users';

export interface IOrganizationBase {
  id: string;
  name: string;
  displayName: string;
  description?: Nullable<string>;
  maxOperator: number;
  apiKey: string;
  loginLiffId: Nullable<string>;
  fileUploadLiffId?: Nullable<string>;
  isActive: boolean;
}

export interface IOrganization extends IOrganizationBase {
  users?: Nullable<IUser[]>;
  operatorCount?: Nullable<number>;
}
