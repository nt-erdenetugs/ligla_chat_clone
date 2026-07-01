import { type IStore } from '~/modules/Stores';
import { type IUser } from '~/modules/Users';

export interface ITeamBase {
  id: string;
  name: string;
  createdAt?: Nullable<Date>;
}

export interface ITeamChatSetting {
  id: string;
  teamSettingId: string;
  viewAllChatsEnabled: boolean;
}

export interface ITeamSetting {
  id: string;
  teamId: string;
  teamChatSetting: Nullable<ITeamChatSetting>;
}

export interface ITeam extends ITeamBase {
  isActive: boolean;
  managers: IUser[];
  operators: IUser[];
  stores: IStore[];
  isDefault: boolean;
  teamSetting: Nullable<ITeamSetting>;
}
