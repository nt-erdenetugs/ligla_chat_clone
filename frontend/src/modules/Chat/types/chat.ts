import {
  type ChatTeamAssignActionsType,
  type ActivityType,
  type ActorType,
  type ChatStatus,
  type SenderType,
} from '~/generated/graphql/types';
import { type IAttributeValue } from '~/modules/Attributes';
import { type ITag } from '~/modules/Tags';
import { type ITeamBase } from '~/modules/Teams';
import { type ISender, type IUser, type IEndUser } from '~/modules/Users';

export interface IChatTeamAssignment {
  id: string;
  chatId: string;
  createdAt?: Nullable<Date>;
  teamId: string;
  team: ITeamBase;
}

export interface IChatMessage {
  id: string;
  chatId: string;
  content: string;
  createdAt: Date;
  previewImageUrl?: Nullable<string>;
  sender: ISender;
  senderId: string;
  senderType: SenderType;
  type: string;
  isDelivered?: boolean;
  isDelivering?: boolean;
  isRetrying?: boolean;
  isDeleting?: boolean;
  messageId?: Nullable<string>;
  isUnsent?: boolean;
  contentUrl?: Nullable<string>;
  duration?: Nullable<number>;
  latitude?: Nullable<number>;
  longitude?: Nullable<number>;
  quoteToken?: string;
  quotedMessageId?: string;
  quotedMessage?: IChatMessage;
}

export type IChatMessageUpdatePayload = {
  chatId: string;
  messageId: string;
} & Partial<IChatMessage>;

export interface IChatActivity {
  id: string;
  chatId: string;
  activityType: ActivityType;
  actorType: ActorType;
  actorId?: Nullable<string>;
  actorUserName?: Nullable<string>;
  oldStatus?: Nullable<ChatStatus>;
  newStatus?: Nullable<ChatStatus>;
  oldUserId?: Nullable<string>;
  newUserId?: Nullable<string>;
  oldUserName?: Nullable<string>;
  newUserName?: Nullable<string>;
  changedTeamId?: Nullable<string>;
  changedTeamName?: Nullable<string>;
  teamAssignAction?: Nullable<ChatTeamAssignActionsType>;
  createdAt: Date;
}
export interface IChatTag {
  id: string;
  chatId: ID;
  tagId: string;
  createdAt: Date;
  tag: ITag;
}

export interface IChatNote {
  id: string;
  chatId: ID;
  noteValue: string;
  createdAt: Date;
  updatedAt?: Nullable<Date>;
  user: IUser;
}

export interface IChat {
  id: string;
  chatTeamAssignment: IChatTeamAssignment[];
  chatMessages: IChatMessage[];
  chatActivities: IChatActivity[];
  chatUnreadCount: number;
  chatAttributeValues: IAttributeValue[];
  chatStatus: ChatStatus;
  chatTags: IChatTag[];
  latestMessageTimestamp?: Nullable<Date>;
  latestReadTimestamp?: Nullable<Date>;
  createdAt: Date;
  endUser: IEndUser;
  endUserId: string;
  assignedUserId?: Nullable<string>;
  assignedUser?: Nullable<IUser>;
  sessionActive: boolean;
  isUserBlocked: boolean;
}

export type ID = IChat['id'];

export interface ITeamsInChat {
  id: string;
  name: string;
  operators: IUser[];
  isDefault: boolean;
}

export enum ChatFiltersType {
  Tags = 'tags',
  Users = 'users',
  Teams = 'teams',
  Statuses = 'statuses',
}

export type IChatFilters = Record<ChatFiltersType, string[]> & {
  includeUnassigned: boolean;
};
