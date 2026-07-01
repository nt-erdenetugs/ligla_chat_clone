import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** The `Any` scalar type represents any JSON value */
  Any: { input: any; output: any; }
  /** The `BigInt` scalar type represents non-fractional signed whole numeric values. */
  BigInt: { input: any; output: any; }
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: any; output: any; }
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: { input: any; output: any; }
};

/** Defines whether the chat activity is a status change or an assignee change */
export enum ActivityType {
  EndSession = 'END_SESSION',
  SessionTimeout = 'SESSION_TIMEOUT',
  StatusChange = 'STATUS_CHANGE',
  TeamsChange = 'TEAMS_CHANGE',
  UserAdded = 'USER_ADDED',
  UserChange = 'USER_CHANGE',
  UserFollowed = 'USER_FOLLOWED',
  UserFollowedNew = 'USER_FOLLOWED_NEW',
  UserUnfollowed = 'USER_UNFOLLOWED'
}

/** Defines whether the chat activity actor is system or user */
export enum ActorType {
  System = 'SYSTEM',
  User = 'USER'
}

export type Attribute = {
  __typename?: 'Attribute';
  chatId?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  isEncryptionEnabled: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  selectOption?: Maybe<Array<SelectOption>>;
  type?: Maybe<AttributeType>;
};

export enum AttributeType {
  Boolean = 'boolean',
  Calendar = 'calendar',
  Date = 'date',
  Datetime = 'datetime',
  Number = 'number',
  Selection = 'selection',
  String = 'string',
  Time = 'time'
}

export type AttributeValue = {
  __typename?: 'AttributeValue';
  attributeId: Scalars['String']['output'];
  chatId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  user: BaseUser;
  userId: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type AttributesWithCount = {
  __typename?: 'AttributesWithCount';
  count: Scalars['Int']['output'];
  items: Array<Attribute>;
};

export type Auth = {
  __typename?: 'Auth';
  accessToken: Scalars['String']['output'];
};

export type BaseOrganization = {
  __typename?: 'BaseOrganization';
  displayName: Scalars['String']['output'];
  fileUploadLiffId?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type BaseTeam = {
  __typename?: 'BaseTeam';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type BaseUser = {
  __typename?: 'BaseUser';
  displayName: Scalars['String']['output'];
  id: Scalars['String']['output'];
  senderName?: Maybe<Scalars['String']['output']>;
};

export type Chat = {
  __typename?: 'Chat';
  assignedUser?: Maybe<User>;
  assignedUserId?: Maybe<Scalars['String']['output']>;
  chatActivities: Array<ChatActivity>;
  chatAttributeValues: Array<AttributeValue>;
  chatMessages: Array<ChatMessage>;
  chatStatus: ChatStatus;
  chatTags: Array<ChatTag>;
  chatTeamAssignment: Array<ChatTeamAssignment>;
  chatUnreadCount: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  endUser: EndUser;
  endUserId: Scalars['String']['output'];
  id: Scalars['String']['output'];
  isUserBlocked: Scalars['Boolean']['output'];
  latestMessageTimestamp?: Maybe<Scalars['DateTime']['output']>;
  latestReadTimestamp?: Maybe<Scalars['DateTime']['output']>;
  sessionActive: Scalars['Boolean']['output'];
};

export type ChatActivity = {
  __typename?: 'ChatActivity';
  activityType: ActivityType;
  actorId?: Maybe<Scalars['String']['output']>;
  actorType: ActorType;
  actorUserName?: Maybe<Scalars['String']['output']>;
  changedTeamId?: Maybe<Scalars['String']['output']>;
  changedTeamName?: Maybe<Scalars['String']['output']>;
  chatId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  newStatus?: Maybe<ChatStatus>;
  newUserId?: Maybe<Scalars['String']['output']>;
  newUserName?: Maybe<Scalars['String']['output']>;
  oldStatus?: Maybe<ChatStatus>;
  oldUserId?: Maybe<Scalars['String']['output']>;
  oldUserName?: Maybe<Scalars['String']['output']>;
  teamAssignAction?: Maybe<ChatTeamAssignActionsType>;
};

export type ChatAssignCondition = {
  __typename?: 'ChatAssignCondition';
  field: Scalars['String']['output'];
  operator: ConditionOperator;
  value?: Maybe<Scalars['String']['output']>;
  valueObjects?: Maybe<Array<ConditionValue>>;
  valueType: ValueType;
};

export type ChatAssignConditionGroup = {
  __typename?: 'ChatAssignConditionGroup';
  conditions: Array<ChatAssignCondition>;
  logicalOperator: LogicalOperator;
  subGroups?: Maybe<Array<ChatAssignConditionGroup>>;
};

export type ChatAssignFilter = {
  __typename?: 'ChatAssignFilter';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  rootConditionGroup: ChatAssignConditionGroup;
  targetTable: FilterTargetType;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type ChatAssignFilterGroup = {
  __typename?: 'ChatAssignFilterGroup';
  filters: Array<ChatAssignFilterItem>;
  id: Scalars['String']['output'];
  logicalOperator: LogicalOperator;
  subGroups?: Maybe<Array<ChatAssignFilterGroup>>;
};

export type ChatAssignFilterItem = {
  __typename?: 'ChatAssignFilterItem';
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  targetTable: FilterTargetType;
};

export type ChatAssignFiltersWithCount = {
  __typename?: 'ChatAssignFiltersWithCount';
  count: Scalars['Int']['output'];
  items: Array<ChatAssignFilter>;
};

export type ChatAssignInput = {
  assignedUserId: Scalars['String']['input'];
  chatId: Scalars['String']['input'];
};

export type ChatAssignRule = {
  __typename?: 'ChatAssignRule';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  rootFilterGroup: ChatAssignFilterGroup;
  targetTeams: Array<BaseTeam>;
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type ChatAssignRulesWithCount = {
  __typename?: 'ChatAssignRulesWithCount';
  count: Scalars['Int']['output'];
  items: Array<ChatAssignRule>;
};

export type ChatCursorPaginatedResponse = {
  __typename?: 'ChatCursorPaginatedResponse';
  hasMore: Scalars['Boolean']['output'];
  items: Array<Chat>;
  nextCursorCreatedAt?: Maybe<Scalars['DateTime']['output']>;
  nextCursorDateParam?: Maybe<Scalars['DateTime']['output']>;
  nextCursorId?: Maybe<Scalars['String']['output']>;
  nextCursorIntParam?: Maybe<Scalars['Int']['output']>;
};

export type ChatFile = {
  __typename?: 'ChatFile';
  chatId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedBy?: Maybe<Scalars['String']['output']>;
  fileName: Scalars['String']['output'];
  fileSize: Scalars['BigInt']['output'];
  fileType: FileType;
  gcsObjectKey: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  mimeType: Scalars['String']['output'];
  originalFileName: Scalars['String']['output'];
  scanResult?: Maybe<Scalars['String']['output']>;
  status: FileStatus;
  storageFolder: FileFolder;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  uploaderEndUserId?: Maybe<Scalars['String']['output']>;
  uploaderEndUserName?: Maybe<Scalars['String']['output']>;
  uploaderOperatorId?: Maybe<Scalars['String']['output']>;
  uploaderOperatorName?: Maybe<Scalars['String']['output']>;
};

export type ChatFileDownloadUrlResponse = {
  __typename?: 'ChatFileDownloadUrlResponse';
  fileName: Scalars['String']['output'];
  mimeType: Scalars['String']['output'];
  signedUrl: Scalars['String']['output'];
};

export type ChatFileListResponse = {
  __typename?: 'ChatFileListResponse';
  hasMore: Scalars['Boolean']['output'];
  items: Array<ChatFile>;
  nextCursorCreatedAt?: Maybe<Scalars['DateTime']['output']>;
  nextCursorId?: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type ChatFileUploadResponse = {
  __typename?: 'ChatFileUploadResponse';
  chatFile: ChatFile;
  signedUrl: Scalars['String']['output'];
};

export type ChatFilterInput = {
  includeUnassigned?: InputMaybe<Scalars['Boolean']['input']>;
  statuses?: InputMaybe<Array<ChatStatus>>;
  tagIds?: InputMaybe<Array<Scalars['String']['input']>>;
  teamIds?: InputMaybe<Array<Scalars['String']['input']>>;
  userIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type ChatItem = {
  __typename?: 'ChatItem';
  activity?: Maybe<ChatActivity>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  itemType: ChatItemType;
  message?: Maybe<ChatMessage>;
};

export type ChatItemCursorPaginatedResponse = {
  __typename?: 'ChatItemCursorPaginatedResponse';
  hasMore: Scalars['Boolean']['output'];
  items: Array<ChatItem>;
  nextCursorCreatedAt?: Maybe<Scalars['DateTime']['output']>;
  nextCursorDateParam?: Maybe<Scalars['DateTime']['output']>;
  nextCursorId?: Maybe<Scalars['String']['output']>;
  nextCursorIntParam?: Maybe<Scalars['Int']['output']>;
};

/** Type of chat item (message or activity) */
export enum ChatItemType {
  Activity = 'ACTIVITY',
  Message = 'MESSAGE'
}

export type ChatLatestReadInput = {
  chatId: Scalars['String']['input'];
  timestamp: Scalars['DateTime']['input'];
};

export type ChatMessage = {
  __typename?: 'ChatMessage';
  chatId: Scalars['String']['output'];
  content: Scalars['String']['output'];
  contentUrl?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  duration?: Maybe<Scalars['Float']['output']>;
  id: Scalars['String']['output'];
  isDelivered: Scalars['Boolean']['output'];
  isUnsent: Scalars['Boolean']['output'];
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
  markAsReadToken?: Maybe<Scalars['String']['output']>;
  messageId?: Maybe<Scalars['String']['output']>;
  previewImageUrl?: Maybe<Scalars['String']['output']>;
  quoteToken?: Maybe<Scalars['String']['output']>;
  quotedMessageId?: Maybe<Scalars['String']['output']>;
  sender: Sender;
  senderId: Scalars['String']['output'];
  senderType: SenderType;
  type: ChatMessageType;
};

export type ChatMessageInput = {
  chatId: Scalars['String']['input'];
  message: ChatMessageToEndUser;
};

export type ChatMessageToEndUser = {
  flex?: InputMaybe<FlexMessageInput>;
  text?: InputMaybe<Scalars['String']['input']>;
  type: ChatMessageType;
};

export enum ChatMessageType {
  Audio = 'AUDIO',
  File = 'FILE',
  Flex = 'FLEX',
  Image = 'IMAGE',
  Location = 'LOCATION',
  Sticker = 'STICKER',
  Text = 'TEXT',
  Video = 'VIDEO'
}

export type ChatNote = {
  __typename?: 'ChatNote';
  chatId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  noteValue: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  user: BaseUser;
  userId: Scalars['String']['output'];
};

export type ChatReplyMessageTemplate = {
  __typename?: 'ChatReplyMessageTemplate';
  content: Scalars['String']['output'];
  contentUrl?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  previewImageUrl?: Maybe<Scalars['String']['output']>;
  type: ChatMessageType;
  updatedBy?: Maybe<Scalars['String']['output']>;
};

export type ChatReplySchedule = {
  __typename?: 'ChatReplySchedule';
  chatReplyScheduleCustomDates: Array<Scalars['DateTime']['output']>;
  chatReplyScheduleTimeRanges: Array<ChatReplyScheduleTimeRange>;
  id: Scalars['ID']['output'];
  scheduleType: ChatReplyScheduleType;
};

export type ChatReplyScheduleTimeRange = {
  __typename?: 'ChatReplyScheduleTimeRange';
  endTime: Scalars['String']['output'];
  startTime: Scalars['String']['output'];
  timeRangeType: ChatReplyTimeRangeType;
};

export enum ChatReplyScheduleType {
  CustomDate = 'CUSTOM_DATE',
  Friday = 'FRIDAY',
  Holidays = 'HOLIDAYS',
  Monday = 'MONDAY',
  Saturday = 'SATURDAY',
  Sunday = 'SUNDAY',
  Thursday = 'THURSDAY',
  Tuesday = 'TUESDAY',
  Wednesday = 'WEDNESDAY'
}

export type ChatReplySetting = {
  __typename?: 'ChatReplySetting';
  chatReplySchedules: Array<ChatReplySchedule>;
  chatReplySettingMessages: Array<ChatReplySettingMessage>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  updatedBy?: Maybe<Scalars['String']['output']>;
};

export type ChatReplySettingMessage = {
  __typename?: 'ChatReplySettingMessage';
  chatReplyMessageTemplate: ChatReplyMessageTemplate;
  timeRangeType: ChatReplyTimeRangeType;
};

export enum ChatReplyTimeRangeType {
  ActiveTime = 'ACTIVE_TIME',
  Default = 'DEFAULT'
}

export enum ChatStatus {
  Addressing = 'ADDRESSING',
  Done = 'DONE',
  Pending = 'PENDING'
}

export type ChatStatusInput = {
  chatId: Scalars['String']['input'];
  status: ChatStatus;
};

export type ChatTag = {
  __typename?: 'ChatTag';
  chatId: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  tag: Tag;
  tagId: Scalars['String']['output'];
};

export type ChatTagInput = {
  chatId: Scalars['String']['input'];
  tagId: Scalars['String']['input'];
};

export enum ChatTeamAssignActionsType {
  Added = 'ADDED',
  Removed = 'REMOVED'
}

export type ChatTeamAssignInput = {
  chatId: Scalars['String']['input'];
  teamId: Scalars['String']['input'];
};

export type ChatTeamAssignment = {
  __typename?: 'ChatTeamAssignment';
  chatId: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['String']['output'];
  team: BaseTeam;
  teamId: Scalars['String']['output'];
};

export enum ConditionOperator {
  Equal = 'EQUAL',
  Gt = 'GT',
  Gte = 'GTE',
  Include = 'INCLUDE',
  Lt = 'LT',
  Lte = 'LTE',
  NotEqual = 'NOT_EQUAL',
  NotInclude = 'NOT_INCLUDE',
  NotNull = 'NOT_NULL',
  Null = 'NULL',
  Regex = 'REGEX',
  ValuesDoNotMatchAny = 'VALUES_DO_NOT_MATCH_ANY',
  ValuesMatchAny = 'VALUES_MATCH_ANY'
}

export type ConditionValue = {
  __typename?: 'ConditionValue';
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type ConfirmChatFileUploadEndUserInput = {
  fileId: Scalars['String']['input'];
};

export type ConfirmChatFileUploadInput = {
  fileId: Scalars['String']['input'];
};

export type ConfirmChatFileUploadResponse = {
  __typename?: 'ConfirmChatFileUploadResponse';
  chatFile: ChatFile;
  success: Scalars['Boolean']['output'];
};

export type CreateAttributeInput = {
  isEncryptionEnabled?: Scalars['Boolean']['input'];
  name: Scalars['String']['input'];
  selectOptions?: InputMaybe<Array<SelectOptionInput>>;
  type?: AttributeType;
};

export type CreateChatAssignFilterInput = {
  name: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  rootConditionGroup: CreateConditionGroupInput;
  targetTable: FilterTargetType;
};

export type CreateChatAssignRuleInput = {
  name: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  rootFilterGroup: CreateFilterGroupInput;
  targetTeamIds: Array<Scalars['String']['input']>;
};

export type CreateChatAttributeValueInput = {
  attributeId: Scalars['String']['input'];
  chatId: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type CreateChatNoteInput = {
  chatId: Scalars['String']['input'];
  noteValue: Scalars['String']['input'];
};

export type CreateChatReplyScheduleInput = {
  customDates?: InputMaybe<Array<Scalars['DateTime']['input']>>;
  scheduleType: ChatReplyScheduleType;
  timeRanges: Array<CreateChatReplyScheduleTimeRangeInput>;
};

export type CreateChatReplyScheduleTimeRangeInput = {
  endTime: Scalars['String']['input'];
  startTime: Scalars['String']['input'];
  timeRangeType: ChatReplyTimeRangeType;
};

export type CreateChatReplySettingInput = {
  isActive: Scalars['Boolean']['input'];
  messages: Array<CreateChatReplySettingMessageInput>;
  schedules: Array<CreateChatReplyScheduleInput>;
};

export type CreateChatReplySettingMessageInput = {
  messageTemplate: ChatMessageToEndUser;
  timeRangeType: ChatReplyTimeRangeType;
};

export type CreateConditionGroupInput = {
  conditions: Array<CreateConditionInput>;
  logicalOperator: LogicalOperator;
  subGroups?: InputMaybe<Array<CreateConditionGroupInput>>;
};

export type CreateConditionInput = {
  field: Scalars['String']['input'];
  operator: ConditionOperator;
  value?: InputMaybe<Scalars['String']['input']>;
  valueType: ValueType;
};

export type CreateFilterGroupInput = {
  filterIds: Array<Scalars['String']['input']>;
  logicalOperator: LogicalOperator;
  subGroups?: InputMaybe<Array<CreateFilterGroupInput>>;
};

export type CreateOrganizationInput = {
  apiKey: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  displayName: Scalars['String']['input'];
  emails?: InputMaybe<Array<Scalars['String']['input']>>;
  fileUploadLiffId: Scalars['String']['input'];
  loginLiffId: Scalars['String']['input'];
  maxOperator: Scalars['Int']['input'];
  name: Scalars['String']['input'];
};

export type CreateTagInput = {
  name: Scalars['String']['input'];
};

export type CreateTeamInput = {
  managerIds?: InputMaybe<Array<Scalars['String']['input']>>;
  name: Scalars['String']['input'];
  operatorIds?: InputMaybe<Array<Scalars['String']['input']>>;
  storeIds?: InputMaybe<Array<Scalars['String']['input']>>;
  teamSetting?: InputMaybe<TeamSettingInput>;
};

export type CreateUserInput = {
  displayName: Scalars['String']['input'];
  email: Scalars['String']['input'];
  roleType: UserRoleType;
  senderName?: InputMaybe<Scalars['String']['input']>;
  teamIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export enum CursorDirection {
  Backward = 'BACKWARD',
  Forward = 'FORWARD'
}

export type DeleteChatFileEndUserInput = {
  fileId: Scalars['String']['input'];
};

export type DeleteChatFileInput = {
  fileId: Scalars['String']['input'];
};

export type DeleteChatFileResponse = {
  __typename?: 'DeleteChatFileResponse';
  success: Scalars['Boolean']['output'];
};

export type DeleteMessageInput = {
  chatId: Scalars['String']['input'];
  messageId: Scalars['String']['input'];
};

export type DownloadChatFileEndUserInput = {
  fileId: Scalars['String']['input'];
};

export type EndUser = {
  __typename?: 'EndUser';
  clientUserId?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  displayName?: Maybe<Scalars['String']['output']>;
  pictureUrl?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  userId: Scalars['String']['output'];
};

export enum FileFolder {
  Failed = 'FAILED',
  Pending = 'PENDING',
  Processed = 'PROCESSED'
}

export enum FileStatus {
  Deleted = 'DELETED',
  PendingScan = 'PENDING_SCAN',
  Scanned = 'SCANNED',
  Uploading = 'UPLOADING',
  VirusDetected = 'VIRUS_DETECTED'
}

export enum FileType {
  Archive = 'ARCHIVE',
  Audio = 'AUDIO',
  Document = 'DOCUMENT',
  Image = 'IMAGE',
  Video = 'VIDEO'
}

export type FilterInput = {
  refineConditions?: InputMaybe<Array<FilterOptionInput>>;
  searchValue?: InputMaybe<Scalars['String']['input']>;
};

export type FilterOptionInput = {
  condition?: InputMaybe<Scalars['String']['input']>;
  searchItem?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['Any']['input']>;
};

export enum FilterTargetType {
  Store = 'STORE',
  Survey = 'SURVEY'
}

export type FlexMessageInput = {
  altText: Scalars['String']['input'];
  contents: Scalars['JSONObject']['input'];
};

export enum LogicalOperator {
  And = 'AND',
  Or = 'OR'
}

export type LoginInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type MemberFeed = {
  __typename?: 'MemberFeed';
  columnAlias: Scalars['String']['output'];
  columnName: MemberFeedColumnType;
  value?: Maybe<Scalars['String']['output']>;
};

export type MemberFeedColumn = {
  __typename?: 'MemberFeedColumn';
  alias: Scalars['String']['output'];
  isEnabled: Scalars['Boolean']['output'];
  name: MemberFeedColumnType;
};

export enum MemberFeedColumnType {
  Category_1 = 'category_1',
  Category_2 = 'category_2',
  Category_3 = 'category_3',
  Category_4 = 'category_4',
  Category_5 = 'category_5',
  Category_6 = 'category_6',
  Category_7 = 'category_7',
  Category_8 = 'category_8',
  Category_9 = 'category_9',
  Category_10 = 'category_10',
  Category_11 = 'category_11',
  Category_12 = 'category_12',
  Category_13 = 'category_13',
  Category_14 = 'category_14',
  Category_15 = 'category_15',
  Category_16 = 'category_16',
  Category_17 = 'category_17',
  Category_18 = 'category_18',
  Category_19 = 'category_19',
  Category_20 = 'category_20',
  Category_21 = 'category_21',
  Category_22 = 'category_22',
  Category_23 = 'category_23',
  Category_24 = 'category_24',
  Category_25 = 'category_25',
  Datetime_1 = 'datetime_1',
  Datetime_2 = 'datetime_2',
  Datetime_3 = 'datetime_3',
  Datetime_4 = 'datetime_4',
  Datetime_5 = 'datetime_5',
  Datetime_6 = 'datetime_6',
  Datetime_7 = 'datetime_7',
  Datetime_8 = 'datetime_8',
  Datetime_9 = 'datetime_9',
  Datetime_10 = 'datetime_10',
  Datetime_11 = 'datetime_11',
  Datetime_12 = 'datetime_12',
  Datetime_13 = 'datetime_13',
  Datetime_14 = 'datetime_14',
  Datetime_15 = 'datetime_15',
  Number_1 = 'number_1',
  Number_2 = 'number_2',
  Number_3 = 'number_3',
  Number_4 = 'number_4',
  Number_5 = 'number_5',
  Number_6 = 'number_6',
  Number_7 = 'number_7',
  Number_8 = 'number_8',
  Number_9 = 'number_9',
  Number_10 = 'number_10',
  Number_11 = 'number_11',
  Number_12 = 'number_12',
  Number_13 = 'number_13',
  Number_14 = 'number_14',
  Number_15 = 'number_15'
}

export type Mutation = {
  __typename?: 'Mutation';
  addChatTag: Chat;
  assignOperatorToChat: ChatActivity;
  assignTeamToChat: ChatActivity;
  changeChatStatus: ChatActivity;
  confirmChatFileUpload: ConfirmChatFileUploadResponse;
  confirmChatFileUploadForEndUser: ConfirmChatFileUploadResponse;
  createAttribute: Attribute;
  createChatAssignFilter: ChatAssignFilter;
  createChatAssignRule: ChatAssignRule;
  createChatReplySetting: ChatReplySetting;
  createNote: ChatNote;
  createOrganization: Organization;
  createTag: Tag;
  createTeam: Team;
  createUser: User;
  deleteChatAssignFilter: ChatAssignFilter;
  deleteChatAssignRule: ChatAssignRule;
  deleteChatFile: DeleteChatFileResponse;
  deleteChatFileForEndUser: DeleteChatFileResponse;
  deleteChatMessage: Scalars['Boolean']['output'];
  disableAttribute: Attribute;
  disableTag: Tag;
  disableTeam: Team;
  fillChatAttributeValue: AttributeValue;
  login: Auth;
  loginToHypervisor: Auth;
  removeChatTag: Chat;
  removeNote: ChatNote;
  removeTeamFromChat: ChatActivity;
  removeUser: Scalars['Boolean']['output'];
  requestPasswordReset: Scalars['Boolean']['output'];
  requestReInvite: Scalars['Boolean']['output'];
  resetPassword: User;
  resetPasswordByToken: ResetPasswordByTokenResponse;
  retrySendMessage: ChatMessage;
  sendFileUploadedMessage: ChatMessage;
  sendMessage: ChatMessage;
  sendMessageToLigla: ChatMessage;
  sendUploadLink: ChatMessage;
  toggleAttributeStatus: Attribute;
  toggleOrganizationStatus: Organization;
  toggleTagStatus: Tag;
  toggleTeamStatus: Team;
  toggleUserStatus: User;
  updateAttribute: Attribute;
  updateChatAssignFilter: ChatAssignFilter;
  updateChatAssignRule: ChatAssignRule;
  updateChatLatestRead: Chat;
  updateChatReplySetting: ChatReplySetting;
  updateChatTags: Chat;
  updateDisplayName: User;
  updateMemberFeedSetting: Array<MemberFeedColumn>;
  updateNote: ChatNote;
  updateOrganization: Organization;
  updateSenderName: User;
  updateSurveySetting: Array<SurveyColumn>;
  updateTag: Tag;
  updateTeam: Team;
  updateUser: User;
  uploadChatFile: ChatFileUploadResponse;
  uploadChatFileForEndUser: ChatFileUploadResponse;
};


export type MutationAddChatTagArgs = {
  chatTagInput: ChatTagInput;
};


export type MutationAssignOperatorToChatArgs = {
  chatAssignInput: ChatAssignInput;
};


export type MutationAssignTeamToChatArgs = {
  chatTeamAssignInput: ChatTeamAssignInput;
};


export type MutationChangeChatStatusArgs = {
  chatStatusInput: ChatStatusInput;
};


export type MutationConfirmChatFileUploadArgs = {
  input: ConfirmChatFileUploadInput;
};


export type MutationConfirmChatFileUploadForEndUserArgs = {
  input: ConfirmChatFileUploadEndUserInput;
};


export type MutationCreateAttributeArgs = {
  createAttributeInput: CreateAttributeInput;
};


export type MutationCreateChatAssignFilterArgs = {
  createChatAssignFilterInput: CreateChatAssignFilterInput;
};


export type MutationCreateChatAssignRuleArgs = {
  createChatAssignRuleInput: CreateChatAssignRuleInput;
};


export type MutationCreateChatReplySettingArgs = {
  createChatReplySettingInput: CreateChatReplySettingInput;
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateNoteArgs = {
  createNoteInput: CreateChatNoteInput;
};


export type MutationCreateOrganizationArgs = {
  createOrganizationInput: CreateOrganizationInput;
};


export type MutationCreateTagArgs = {
  createTagInput: CreateTagInput;
};


export type MutationCreateTeamArgs = {
  createTeamInput: CreateTeamInput;
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateUserArgs = {
  createUserInput: CreateUserInput;
};


export type MutationDeleteChatAssignFilterArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteChatAssignRuleArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteChatFileArgs = {
  input: DeleteChatFileInput;
};


export type MutationDeleteChatFileForEndUserArgs = {
  input: DeleteChatFileEndUserInput;
};


export type MutationDeleteChatMessageArgs = {
  deleteMessageInput: DeleteMessageInput;
};


export type MutationDisableAttributeArgs = {
  id: Scalars['String']['input'];
};


export type MutationDisableTagArgs = {
  id: Scalars['String']['input'];
};


export type MutationDisableTeamArgs = {
  id: Scalars['String']['input'];
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationFillChatAttributeValueArgs = {
  createChatAttributeValueInput: CreateChatAttributeValueInput;
};


export type MutationLoginArgs = {
  loginInput: LoginInput;
};


export type MutationLoginToHypervisorArgs = {
  loginInput: LoginInput;
};


export type MutationRemoveChatTagArgs = {
  chatTagInput: ChatTagInput;
};


export type MutationRemoveNoteArgs = {
  chatId: Scalars['String']['input'];
  id: Scalars['String']['input'];
};


export type MutationRemoveTeamFromChatArgs = {
  chatTeamAssignInput: ChatTeamAssignInput;
};


export type MutationRemoveUserArgs = {
  id: Scalars['String']['input'];
};


export type MutationRequestPasswordResetArgs = {
  email: Scalars['String']['input'];
};


export type MutationRequestReInviteArgs = {
  email: Scalars['String']['input'];
};


export type MutationResetPasswordArgs = {
  resetPasswordInput: ResetPasswordInput;
};


export type MutationResetPasswordByTokenArgs = {
  resetPasswordByTokenInput: ResetPasswordByTokenInput;
};


export type MutationRetrySendMessageArgs = {
  retryMessageInput: RetryMessageInput;
};


export type MutationSendFileUploadedMessageArgs = {
  input: SendFileUploadedMessageInput;
};


export type MutationSendMessageArgs = {
  chatMessageInput: ChatMessageInput;
};


export type MutationSendMessageToLiglaArgs = {
  chatId: Scalars['String']['input'];
  messageId: Scalars['String']['input'];
};


export type MutationSendUploadLinkArgs = {
  input: ShareUploadLinkInput;
};


export type MutationToggleAttributeStatusArgs = {
  id: Scalars['String']['input'];
};


export type MutationToggleOrganizationStatusArgs = {
  name: Scalars['String']['input'];
};


export type MutationToggleTagStatusArgs = {
  id: Scalars['String']['input'];
};


export type MutationToggleTeamStatusArgs = {
  id: Scalars['String']['input'];
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationToggleUserStatusArgs = {
  id: Scalars['String']['input'];
};


export type MutationUpdateAttributeArgs = {
  updateAttributeInput: UpdateAttributeInput;
};


export type MutationUpdateChatAssignFilterArgs = {
  updateChatAssignFilterInput: UpdateChatAssignFilterInput;
};


export type MutationUpdateChatAssignRuleArgs = {
  updateChatAssignRuleInput: UpdateChatAssignRuleInput;
};


export type MutationUpdateChatLatestReadArgs = {
  chatLatestReadInput: ChatLatestReadInput;
};


export type MutationUpdateChatReplySettingArgs = {
  updateChatReplySettingInput: UpdateChatReplySettingInput;
};


export type MutationUpdateChatTagsArgs = {
  updateChatTagsInput: UpdateChatTagsInput;
};


export type MutationUpdateDisplayNameArgs = {
  updateDisplayNameInput: UpdateDisplayNameInput;
};


export type MutationUpdateMemberFeedSettingArgs = {
  updateMemberFeedSettingInput: UpdateMemberFeedSettingInput;
};


export type MutationUpdateNoteArgs = {
  updateNoteInput: UpdateChatNoteInput;
};


export type MutationUpdateOrganizationArgs = {
  updateOrganizationInput: UpdateOrganizationInput;
};


export type MutationUpdateSenderNameArgs = {
  updateSenderNameInput: UpdateSenderNameInput;
};


export type MutationUpdateSurveySettingArgs = {
  updateSurveySettingInput: UpdateSurveySettingInput;
};


export type MutationUpdateTagArgs = {
  updateTagInput: UpdateTagInput;
};


export type MutationUpdateTeamArgs = {
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
  updateTeamInput: UpdateTeamInput;
};


export type MutationUpdateUserArgs = {
  updateUserInput: UpdateUserInput;
};


export type MutationUploadChatFileArgs = {
  input: UploadChatFileInput;
};


export type MutationUploadChatFileForEndUserArgs = {
  input: UploadChatFileEndUserInput;
};

export type Organization = {
  __typename?: 'Organization';
  apiKey: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  fileUploadLiffId?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  loginLiffId?: Maybe<Scalars['String']['output']>;
  maxOperator: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  operatorCount: Scalars['Int']['output'];
  users?: Maybe<Array<User>>;
};

export type OrganizationsWithCount = {
  __typename?: 'OrganizationsWithCount';
  count: Scalars['Int']['output'];
  items: Array<Organization>;
};

export type Query = {
  __typename?: 'Query';
  adminOperators: UserCursorPaginatedResponse;
  allSelectableOperators: UserCursorPaginatedResponse;
  attribute: Attribute;
  attributes: AttributesWithCount;
  chatAssignFilter: ChatAssignFilter;
  chatAssignFiltersWithCount: ChatAssignFiltersWithCount;
  chatAssignRule: ChatAssignRule;
  chatAssignRules: ChatAssignRulesWithCount;
  chatCount: Scalars['Int']['output'];
  chatData: ChatItemCursorPaginatedResponse;
  chatFileDownloadUrlForEndUser: ChatFileDownloadUrlResponse;
  chatFiles: ChatFileListResponse;
  chatFilesForEndUser: ChatFileListResponse;
  chatHistory?: Maybe<Chat>;
  chatReplySetting?: Maybe<ChatReplySetting>;
  chats: ChatCursorPaginatedResponse;
  checkUserExists: Scalars['Boolean']['output'];
  cursorPaginatedTags: TagCursorPaginatedResponse;
  managers: UserCursorPaginatedResponse;
  maxOperatorCount: Scalars['Int']['output'];
  me: User;
  memberFeedColumns: Array<MemberFeedColumn>;
  memberFeeds?: Maybe<Array<MemberFeed>>;
  notes: Array<ChatNote>;
  operatorCount: Scalars['Int']['output'];
  organization: Organization;
  organizations: OrganizationsWithCount;
  selectableChatAssignFilters: Array<ChatAssignFilterItem>;
  selectableTeams: Array<SelectableTeam>;
  selectableTeamsForChatFilter: Array<SelectableTeam>;
  store: Store;
  stores: StoresWithCount;
  storesCursor: StoreCursorPaginatedResponse;
  surveyColumns: Array<SurveyColumn>;
  surveys?: Maybe<Array<Survey>>;
  tag: Tag;
  tags: TagsWithCount;
  team: Team;
  teams: TeamsWithCount;
  teamsInChat: Array<Team>;
  unassignedChatCount: Scalars['Int']['output'];
  user: User;
  users: UsersWithCount;
  verifyPasswordResetToken: Scalars['Boolean']['output'];
};


export type QueryAdminOperatorsArgs = {
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDateParam?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDirection?: CursorDirection;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorIntParam?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryAllSelectableOperatorsArgs = {
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDateParam?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDirection?: CursorDirection;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorIntParam?: InputMaybe<Scalars['Int']['input']>;
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryAttributeArgs = {
  id: Scalars['String']['input'];
};


export type QueryAttributesArgs = {
  filter?: InputMaybe<FilterInput>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryChatAssignFilterArgs = {
  id: Scalars['String']['input'];
};


export type QueryChatAssignFiltersWithCountArgs = {
  filter?: InputMaybe<FilterInput>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryChatAssignRuleArgs = {
  id: Scalars['String']['input'];
};


export type QueryChatAssignRulesArgs = {
  filter?: InputMaybe<FilterInput>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryChatDataArgs = {
  chatId: Scalars['String']['input'];
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDateParam?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDirection?: CursorDirection;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorIntParam?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryChatFileDownloadUrlForEndUserArgs = {
  input: DownloadChatFileEndUserInput;
};


export type QueryChatFilesArgs = {
  chatId: Scalars['String']['input'];
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDateParam?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDirection?: CursorDirection;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorIntParam?: InputMaybe<Scalars['Int']['input']>;
  endUserId: Scalars['String']['input'];
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryChatFilesForEndUserArgs = {
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDateParam?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDirection?: CursorDirection;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorIntParam?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryChatHistoryArgs = {
  id: Scalars['String']['input'];
};


export type QueryChatReplySettingArgs = {
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryChatsArgs = {
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDateParam?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDirection?: CursorDirection;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorIntParam?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<ChatFilterInput>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryCheckUserExistsArgs = {
  email: Scalars['String']['input'];
};


export type QueryCursorPaginatedTagsArgs = {
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDateParam?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDirection?: CursorDirection;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorIntParam?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryManagersArgs = {
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDateParam?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDirection?: CursorDirection;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorIntParam?: InputMaybe<Scalars['Int']['input']>;
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMemberFeedsArgs = {
  clientUserId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryNotesArgs = {
  chatId: Scalars['String']['input'];
};


export type QueryOrganizationArgs = {
  name: Scalars['String']['input'];
};


export type QueryOrganizationsArgs = {
  filter?: InputMaybe<FilterInput>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryStoreArgs = {
  id: Scalars['String']['input'];
};


export type QueryStoresArgs = {
  filter?: InputMaybe<FilterInput>;
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryStoresCursorArgs = {
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDateParam?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDirection?: CursorDirection;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorIntParam?: InputMaybe<Scalars['Int']['input']>;
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySurveysArgs = {
  chatId: Scalars['String']['input'];
};


export type QueryTagArgs = {
  id: Scalars['String']['input'];
};


export type QueryTagsArgs = {
  filter?: InputMaybe<FilterInput>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryTeamArgs = {
  id: Scalars['String']['input'];
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryTeamsArgs = {
  filter?: InputMaybe<FilterInput>;
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryTeamsInChatArgs = {
  chatId: Scalars['String']['input'];
};


export type QueryUserArgs = {
  id: Scalars['String']['input'];
};


export type QueryUsersArgs = {
  filter?: InputMaybe<FilterInput>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryVerifyPasswordResetTokenArgs = {
  token: Scalars['String']['input'];
};

export type ResetPasswordByTokenInput = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export type ResetPasswordByTokenResponse = {
  __typename?: 'ResetPasswordByTokenResponse';
  success: Scalars['Boolean']['output'];
  warning?: Maybe<Scalars['String']['output']>;
};

export type ResetPasswordInput = {
  currentPassword: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
};

export type RetryMessageInput = {
  chatId: Scalars['String']['input'];
  messageId: Scalars['String']['input'];
};

export type SelectOption = {
  __typename?: 'SelectOption';
  id: Scalars['String']['output'];
  label?: Maybe<Scalars['String']['output']>;
  value: Scalars['String']['output'];
};

export type SelectOptionInput = {
  id?: InputMaybe<Scalars['String']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  value: Scalars['String']['input'];
};

export type SelectableTeam = {
  __typename?: 'SelectableTeam';
  id: Scalars['String']['output'];
  isDefault: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
};

export type SendFileUploadedMessageInput = {
  altText?: InputMaybe<Scalars['String']['input']>;
  chatId: Scalars['String']['input'];
  fileName: Scalars['String']['input'];
};

export type Sender = {
  __typename?: 'Sender';
  displayName?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  pictureUrl?: Maybe<Scalars['String']['output']>;
  senderName?: Maybe<Scalars['String']['output']>;
};

/** Defines whether the sender is an end-user or operator */
export enum SenderType {
  EndUser = 'END_USER',
  Operator = 'OPERATOR',
  System = 'SYSTEM'
}

export type ShareUploadLinkInput = {
  chatId: Scalars['String']['input'];
};

export type Store = {
  __typename?: 'Store';
  areaName?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  endsAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  liglaStoreId?: Maybe<Scalars['Float']['output']>;
  name: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  startsAt?: Maybe<Scalars['DateTime']['output']>;
  typeName?: Maybe<Scalars['String']['output']>;
};

export type StoreCursorPaginatedResponse = {
  __typename?: 'StoreCursorPaginatedResponse';
  hasMore: Scalars['Boolean']['output'];
  items: Array<Store>;
  nextCursorCreatedAt?: Maybe<Scalars['DateTime']['output']>;
  nextCursorDateParam?: Maybe<Scalars['DateTime']['output']>;
  nextCursorId?: Maybe<Scalars['String']['output']>;
  nextCursorIntParam?: Maybe<Scalars['Int']['output']>;
};

export type StoresWithCount = {
  __typename?: 'StoresWithCount';
  count: Scalars['Int']['output'];
  items: Array<Store>;
};

export type Survey = {
  __typename?: 'Survey';
  columnAlias: Scalars['String']['output'];
  columnName: SurveyColumnType;
  value?: Maybe<Scalars['String']['output']>;
};

export type SurveyColumn = {
  __typename?: 'SurveyColumn';
  alias: Scalars['String']['output'];
  isEnabled: Scalars['Boolean']['output'];
  name: SurveyColumnType;
};

export enum SurveyColumnType {
  Category_1 = 'category_1',
  Category_2 = 'category_2',
  Category_3 = 'category_3',
  Category_4 = 'category_4',
  Category_5 = 'category_5',
  Category_6 = 'category_6',
  Category_7 = 'category_7',
  Category_8 = 'category_8',
  Category_9 = 'category_9',
  Category_10 = 'category_10',
  Category_11 = 'category_11',
  Category_12 = 'category_12',
  Category_13 = 'category_13',
  Category_14 = 'category_14',
  Category_15 = 'category_15',
  Category_16 = 'category_16',
  Category_17 = 'category_17',
  Category_18 = 'category_18',
  Category_19 = 'category_19',
  Category_20 = 'category_20',
  Category_21 = 'category_21',
  Category_22 = 'category_22',
  Category_23 = 'category_23',
  Category_24 = 'category_24',
  Category_25 = 'category_25',
  Datetime_1 = 'datetime_1',
  Datetime_2 = 'datetime_2',
  Datetime_3 = 'datetime_3',
  Datetime_4 = 'datetime_4',
  Datetime_5 = 'datetime_5',
  Datetime_6 = 'datetime_6',
  Datetime_7 = 'datetime_7',
  Datetime_8 = 'datetime_8',
  Datetime_9 = 'datetime_9',
  Datetime_10 = 'datetime_10',
  Datetime_11 = 'datetime_11',
  Datetime_12 = 'datetime_12',
  Datetime_13 = 'datetime_13',
  Datetime_14 = 'datetime_14',
  Datetime_15 = 'datetime_15',
  Number_1 = 'number_1',
  Number_2 = 'number_2',
  Number_3 = 'number_3',
  Number_4 = 'number_4',
  Number_5 = 'number_5',
  Number_6 = 'number_6',
  Number_7 = 'number_7',
  Number_8 = 'number_8',
  Number_9 = 'number_9',
  Number_10 = 'number_10',
  Number_11 = 'number_11',
  Number_12 = 'number_12',
  Number_13 = 'number_13',
  Number_14 = 'number_14',
  Number_15 = 'number_15'
}

export enum SystemUserType {
  Hypervisor = 'HYPERVISOR',
  User = 'USER'
}

export type Tag = {
  __typename?: 'Tag';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
};

export type TagCursorPaginatedResponse = {
  __typename?: 'TagCursorPaginatedResponse';
  hasMore: Scalars['Boolean']['output'];
  items: Array<Tag>;
  nextCursorCreatedAt?: Maybe<Scalars['DateTime']['output']>;
  nextCursorDateParam?: Maybe<Scalars['DateTime']['output']>;
  nextCursorId?: Maybe<Scalars['String']['output']>;
  nextCursorIntParam?: Maybe<Scalars['Int']['output']>;
};

export type TagsWithCount = {
  __typename?: 'TagsWithCount';
  count: Scalars['Int']['output'];
  items: Array<Tag>;
};

export type Team = {
  __typename?: 'Team';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  isDefault: Scalars['Boolean']['output'];
  managers: Array<User>;
  name: Scalars['String']['output'];
  operators: Array<User>;
  stores: Array<Store>;
  teamSetting?: Maybe<TeamSetting>;
};

export type TeamChatSetting = {
  __typename?: 'TeamChatSetting';
  id: Scalars['String']['output'];
  teamSettingId: Scalars['String']['output'];
  viewAllChatsEnabled: Scalars['Boolean']['output'];
};

export type TeamChatSettingInput = {
  viewAllChatsEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};

export type TeamSetting = {
  __typename?: 'TeamSetting';
  id: Scalars['String']['output'];
  teamChatSetting?: Maybe<TeamChatSetting>;
  teamId: Scalars['String']['output'];
};

export type TeamSettingInput = {
  teamChatSetting?: InputMaybe<TeamChatSettingInput>;
};

export type TeamsWithCount = {
  __typename?: 'TeamsWithCount';
  count: Scalars['Int']['output'];
  items: Array<Team>;
};

export type UpdateAttributeInput = {
  id: Scalars['String']['input'];
  isActive: Scalars['Boolean']['input'];
  name: Scalars['String']['input'];
  selectOptions?: InputMaybe<Array<SelectOptionInput>>;
  type?: AttributeType;
};

export type UpdateChatAssignFilterInput = {
  id: Scalars['String']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  rootConditionGroup?: InputMaybe<CreateConditionGroupInput>;
  targetTable?: InputMaybe<FilterTargetType>;
};

export type UpdateChatAssignRuleInput = {
  id: Scalars['String']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  rootFilterGroup?: InputMaybe<CreateFilterGroupInput>;
  targetTeamIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UpdateChatNoteInput = {
  chatId: Scalars['String']['input'];
  id: Scalars['String']['input'];
  noteValue: Scalars['String']['input'];
};

export type UpdateChatReplySettingInput = {
  id: Scalars['String']['input'];
  isActive: Scalars['Boolean']['input'];
  messages: Array<CreateChatReplySettingMessageInput>;
  schedules: Array<CreateChatReplyScheduleInput>;
};

export type UpdateChatTagsInput = {
  chatId: Scalars['String']['input'];
  tagIds: Array<Scalars['String']['input']>;
};

export type UpdateDisplayNameInput = {
  displayName: Scalars['String']['input'];
};

export type UpdateMemberFeedSettingInput = {
  enabledColumns: Array<MemberFeedColumnType>;
};

export type UpdateOrganizationInput = {
  apiKey?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  emails?: InputMaybe<Array<Scalars['String']['input']>>;
  fileUploadLiffId?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  loginLiffId?: InputMaybe<Scalars['String']['input']>;
  maxOperator?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateSenderNameInput = {
  senderName: Scalars['String']['input'];
};

export type UpdateSurveySettingInput = {
  enabledColumns: Array<SurveyColumnType>;
};

export type UpdateTagInput = {
  id: Scalars['String']['input'];
  isActive: Scalars['Boolean']['input'];
  name: Scalars['String']['input'];
};

export type UpdateTeamInput = {
  id: Scalars['String']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  managerIds?: InputMaybe<Array<Scalars['String']['input']>>;
  name?: InputMaybe<Scalars['String']['input']>;
  operatorIds?: InputMaybe<Array<Scalars['String']['input']>>;
  storeIds?: InputMaybe<Array<Scalars['String']['input']>>;
  teamSetting?: InputMaybe<TeamSettingInput>;
};

export type UpdateUserInput = {
  displayName: Scalars['String']['input'];
  id: Scalars['String']['input'];
  roleType: UserRoleType;
  senderName?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};

export type UploadChatFileEndUserInput = {
  fileName: Scalars['String']['input'];
  fileSize: Scalars['BigInt']['input'];
  fileType: FileType;
  mimeType: Scalars['String']['input'];
};

export type UploadChatFileInput = {
  chatId: Scalars['String']['input'];
  fileName: Scalars['String']['input'];
  fileSize: Scalars['BigInt']['input'];
  fileType: FileType;
  mimeType: Scalars['String']['input'];
};

export type User = {
  __typename?: 'User';
  createdAt: Scalars['DateTime']['output'];
  displayName: Scalars['String']['output'];
  email: Scalars['String']['output'];
  id: Scalars['String']['output'];
  organization?: Maybe<BaseOrganization>;
  pictureUrl?: Maybe<Scalars['String']['output']>;
  qrUrl?: Maybe<Scalars['String']['output']>;
  roleType: Scalars['String']['output'];
  senderName?: Maybe<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  systemUserType: SystemUserType;
  teams?: Maybe<Array<BaseTeam>>;
};

export type UserCursorPaginatedResponse = {
  __typename?: 'UserCursorPaginatedResponse';
  hasMore: Scalars['Boolean']['output'];
  items: Array<User>;
  nextCursorCreatedAt?: Maybe<Scalars['DateTime']['output']>;
  nextCursorDateParam?: Maybe<Scalars['DateTime']['output']>;
  nextCursorId?: Maybe<Scalars['String']['output']>;
  nextCursorIntParam?: Maybe<Scalars['Int']['output']>;
};

export enum UserRoleType {
  Admin = 'ADMIN',
  AdminOperator = 'ADMIN_OPERATOR',
  Manager = 'MANAGER',
  ManagerOperator = 'MANAGER_OPERATOR',
  Operator = 'OPERATOR'
}

export type UsersWithCount = {
  __typename?: 'UsersWithCount';
  count: Scalars['Int']['output'];
  items: Array<User>;
};

export enum ValueType {
  Array = 'ARRAY',
  Boolean = 'BOOLEAN',
  Datetime = 'DATETIME',
  Number = 'NUMBER',
  String = 'STRING'
}

export type AttributeFragmentFragment = { __typename?: 'Attribute', id: string, name: string, type?: AttributeType | null, isActive: boolean, isEncryptionEnabled: boolean, createdAt: any, chatId?: string | null, selectOption?: Array<{ __typename?: 'SelectOption', id: string, value: string, label?: string | null }> | null };

export type ChatAttributeValueFragmentFragment = { __typename?: 'AttributeValue', id: string, value: string, chatId: string, attributeId: string, userId: string, createdAt: any, user: { __typename?: 'BaseUser', id: string, displayName: string } };

export type AttributeQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type AttributeQuery = { __typename?: 'Query', attribute: { __typename?: 'Attribute', id: string, name: string, type?: AttributeType | null, isActive: boolean, isEncryptionEnabled: boolean, createdAt: any, chatId?: string | null, selectOption?: Array<{ __typename?: 'SelectOption', id: string, value: string, label?: string | null }> | null } };

export type AttributesQueryVariables = Exact<{ [key: string]: never; }>;


export type AttributesQuery = { __typename?: 'Query', attributes: { __typename?: 'AttributesWithCount', count: number, items: Array<{ __typename?: 'Attribute', id: string, name: string, type?: AttributeType | null, isActive: boolean, isEncryptionEnabled: boolean, createdAt: any, chatId?: string | null, selectOption?: Array<{ __typename?: 'SelectOption', id: string, value: string, label?: string | null }> | null }> } };

export type PaginatedAttributesQueryVariables = Exact<{
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<FilterInput>;
}>;


export type PaginatedAttributesQuery = { __typename?: 'Query', attributes: { __typename?: 'AttributesWithCount', count: number, items: Array<{ __typename?: 'Attribute', id: string, name: string, type?: AttributeType | null, isActive: boolean, isEncryptionEnabled: boolean, createdAt: any, chatId?: string | null, selectOption?: Array<{ __typename?: 'SelectOption', id: string, value: string, label?: string | null }> | null }> } };

export type CreateAttributeMutationVariables = Exact<{
  createAttributeInput: CreateAttributeInput;
}>;


export type CreateAttributeMutation = { __typename?: 'Mutation', createAttribute: { __typename?: 'Attribute', id: string, name: string, type?: AttributeType | null, isActive: boolean, isEncryptionEnabled: boolean, createdAt: any, chatId?: string | null, selectOption?: Array<{ __typename?: 'SelectOption', id: string, value: string, label?: string | null }> | null } };

export type UpdateAttributeMutationVariables = Exact<{
  updateAttributeInput: UpdateAttributeInput;
}>;


export type UpdateAttributeMutation = { __typename?: 'Mutation', updateAttribute: { __typename?: 'Attribute', id: string, name: string, type?: AttributeType | null, isActive: boolean, isEncryptionEnabled: boolean, createdAt: any, chatId?: string | null, selectOption?: Array<{ __typename?: 'SelectOption', id: string, value: string, label?: string | null }> | null } };

export type ToggleAttributeStatusMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type ToggleAttributeStatusMutation = { __typename?: 'Mutation', toggleAttributeStatus: { __typename?: 'Attribute', id: string, name: string, type?: AttributeType | null, isActive: boolean, isEncryptionEnabled: boolean, createdAt: any, chatId?: string | null, selectOption?: Array<{ __typename?: 'SelectOption', id: string, value: string, label?: string | null }> | null } };

export type DisableAttributeMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DisableAttributeMutation = { __typename?: 'Mutation', disableAttribute: { __typename?: 'Attribute', id: string, name: string, type?: AttributeType | null, isActive: boolean, isEncryptionEnabled: boolean, createdAt: any, chatId?: string | null, selectOption?: Array<{ __typename?: 'SelectOption', id: string, value: string, label?: string | null }> | null } };

export type FillChatAttributeValueMutationVariables = Exact<{
  createChatAttributeValueInput: CreateChatAttributeValueInput;
}>;


export type FillChatAttributeValueMutation = { __typename?: 'Mutation', fillChatAttributeValue: { __typename?: 'AttributeValue', id: string, value: string, chatId: string, attributeId: string, userId: string, createdAt: any, user: { __typename?: 'BaseUser', id: string, displayName: string } } };

export type LoginMutationVariables = Exact<{
  loginInput: LoginInput;
}>;


export type LoginMutation = { __typename?: 'Mutation', login: { __typename?: 'Auth', accessToken: string } };

export type LoginToHypervisorMutationVariables = Exact<{
  loginInput: LoginInput;
}>;


export type LoginToHypervisorMutation = { __typename?: 'Mutation', loginToHypervisor: { __typename?: 'Auth', accessToken: string } };

export type ResetPasswordByTokenMutationVariables = Exact<{
  resetPasswordByTokenInput: ResetPasswordByTokenInput;
}>;


export type ResetPasswordByTokenMutation = { __typename?: 'Mutation', resetPasswordByToken: { __typename?: 'ResetPasswordByTokenResponse', success: boolean, warning?: string | null } };

export type RequestPasswordResetMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type RequestPasswordResetMutation = { __typename?: 'Mutation', requestPasswordReset: boolean };

export type RequestReInviteMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type RequestReInviteMutation = { __typename?: 'Mutation', requestReInvite: boolean };

export type VerifyPasswordResetTokenQueryVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type VerifyPasswordResetTokenQuery = { __typename?: 'Query', verifyPasswordResetToken: boolean };

export type EndUserFragmentFragment = { __typename?: 'EndUser', userId: string, clientUserId?: string | null, displayName?: string | null, pictureUrl?: string | null, createdAt: any, updatedAt?: any | null };

export type ChatTeamAssignmentFragmentFragment = { __typename?: 'ChatTeamAssignment', id: string, chatId: string, createdAt?: any | null, teamId: string, team: { __typename?: 'BaseTeam', id: string, name: string, createdAt: any } };

export type ChatMessageFragmentFragment = { __typename?: 'ChatMessage', id: string, chatId: string, content: string, createdAt: any, previewImageUrl?: string | null, contentUrl?: string | null, senderId: string, senderType: SenderType, type: ChatMessageType, isDelivered: boolean, sender: { __typename?: 'Sender', id: string, displayName?: string | null, senderName?: string | null, pictureUrl?: string | null } };

export type ChatActivityFragmentFragment = { __typename?: 'ChatActivity', id: string, chatId: string, activityType: ActivityType, actorType: ActorType, actorId?: string | null, actorUserName?: string | null, oldStatus?: ChatStatus | null, newStatus?: ChatStatus | null, oldUserId?: string | null, newUserId?: string | null, oldUserName?: string | null, newUserName?: string | null, changedTeamId?: string | null, changedTeamName?: string | null, teamAssignAction?: ChatTeamAssignActionsType | null, createdAt: any };

export type ChatItemFragmentFragment = { __typename?: 'ChatItem', id: string, createdAt: any, itemType: ChatItemType, activity?: { __typename?: 'ChatActivity', id: string, chatId: string, activityType: ActivityType, actorType: ActorType, actorId?: string | null, actorUserName?: string | null, oldStatus?: ChatStatus | null, newStatus?: ChatStatus | null, oldUserId?: string | null, newUserId?: string | null, oldUserName?: string | null, newUserName?: string | null, changedTeamId?: string | null, changedTeamName?: string | null, teamAssignAction?: ChatTeamAssignActionsType | null, createdAt: any } | null, message?: { __typename?: 'ChatMessage', id: string, chatId: string, content: string, createdAt: any, previewImageUrl?: string | null, contentUrl?: string | null, senderId: string, senderType: SenderType, type: ChatMessageType, isDelivered: boolean, sender: { __typename?: 'Sender', id: string, displayName?: string | null, senderName?: string | null, pictureUrl?: string | null } } | null };

export type ChatTagFragmentFragment = { __typename?: 'ChatTag', id: string, chatId: string, tagId: string, createdAt: any, tag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } };

export type ChatNoteFragmentFragment = { __typename?: 'ChatNote', id: string, chatId: string, noteValue: string, createdAt: any, updatedAt?: any | null, user: { __typename?: 'BaseUser', id: string, displayName: string } };

export type ChatFileListItemFragmentFragment = { __typename?: 'ChatFile', id: string, chatId: string, fileName: string, originalFileName: string, fileSize: any, mimeType: string, status: FileStatus, createdAt: any, uploaderOperatorId?: string | null, uploaderEndUserId?: string | null, uploaderOperatorName?: string | null, uploaderEndUserName?: string | null };

export type ChatsFragmentFragment = { __typename?: 'Chat', id: string, assignedUserId?: string | null, chatUnreadCount: number, endUserId: string, chatStatus: ChatStatus, latestMessageTimestamp?: any | null, latestReadTimestamp?: any | null, sessionActive: boolean, isUserBlocked: boolean, createdAt: any, assignedUser?: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } | null, chatTeamAssignment: Array<{ __typename?: 'ChatTeamAssignment', id: string, chatId: string, createdAt?: any | null, teamId: string, team: { __typename?: 'BaseTeam', id: string, name: string, createdAt: any } }>, chatMessages: Array<{ __typename?: 'ChatMessage', id: string, chatId: string, content: string, createdAt: any, previewImageUrl?: string | null, contentUrl?: string | null, senderId: string, senderType: SenderType, type: ChatMessageType, isDelivered: boolean, sender: { __typename?: 'Sender', id: string, displayName?: string | null, senderName?: string | null, pictureUrl?: string | null } }>, endUser: { __typename?: 'EndUser', userId: string, clientUserId?: string | null, displayName?: string | null, pictureUrl?: string | null, createdAt: any, updatedAt?: any | null }, chatAttributeValues: Array<{ __typename?: 'AttributeValue', id: string, value: string, chatId: string, attributeId: string, userId: string, createdAt: any, user: { __typename?: 'BaseUser', id: string, displayName: string } }>, chatTags: Array<{ __typename?: 'ChatTag', id: string, chatId: string, tagId: string, createdAt: any, tag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } }> };

export type ChatFragmentFragment = { __typename?: 'Chat', id: string, assignedUserId?: string | null, endUserId: string, chatStatus: ChatStatus, latestMessageTimestamp?: any | null, latestReadTimestamp?: any | null, sessionActive: boolean, isUserBlocked: boolean, createdAt: any, assignedUser?: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } | null, chatTeamAssignment: Array<{ __typename?: 'ChatTeamAssignment', id: string, chatId: string, createdAt?: any | null, teamId: string, team: { __typename?: 'BaseTeam', id: string, name: string, createdAt: any } }>, endUser: { __typename?: 'EndUser', userId: string, clientUserId?: string | null, displayName?: string | null, pictureUrl?: string | null, createdAt: any, updatedAt?: any | null }, chatAttributeValues: Array<{ __typename?: 'AttributeValue', id: string, value: string, chatId: string, attributeId: string, userId: string, createdAt: any, user: { __typename?: 'BaseUser', id: string, displayName: string } }>, chatTags: Array<{ __typename?: 'ChatTag', id: string, chatId: string, tagId: string, createdAt: any, tag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } }> };

export type ChatsQueryVariables = Exact<{
  filter?: InputMaybe<ChatFilterInput>;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDateParam?: InputMaybe<Scalars['DateTime']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}>;


export type ChatsQuery = { __typename?: 'Query', chats: { __typename?: 'ChatCursorPaginatedResponse', nextCursorId?: string | null, nextCursorCreatedAt?: any | null, nextCursorDateParam?: any | null, hasMore: boolean, items: Array<{ __typename?: 'Chat', id: string, assignedUserId?: string | null, chatUnreadCount: number, endUserId: string, chatStatus: ChatStatus, latestMessageTimestamp?: any | null, latestReadTimestamp?: any | null, sessionActive: boolean, isUserBlocked: boolean, createdAt: any, assignedUser?: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } | null, chatTeamAssignment: Array<{ __typename?: 'ChatTeamAssignment', id: string, chatId: string, createdAt?: any | null, teamId: string, team: { __typename?: 'BaseTeam', id: string, name: string, createdAt: any } }>, chatMessages: Array<{ __typename?: 'ChatMessage', id: string, chatId: string, content: string, createdAt: any, previewImageUrl?: string | null, contentUrl?: string | null, senderId: string, senderType: SenderType, type: ChatMessageType, isDelivered: boolean, sender: { __typename?: 'Sender', id: string, displayName?: string | null, senderName?: string | null, pictureUrl?: string | null } }>, endUser: { __typename?: 'EndUser', userId: string, clientUserId?: string | null, displayName?: string | null, pictureUrl?: string | null, createdAt: any, updatedAt?: any | null }, chatAttributeValues: Array<{ __typename?: 'AttributeValue', id: string, value: string, chatId: string, attributeId: string, userId: string, createdAt: any, user: { __typename?: 'BaseUser', id: string, displayName: string } }>, chatTags: Array<{ __typename?: 'ChatTag', id: string, chatId: string, tagId: string, createdAt: any, tag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } }> }> } };

export type ChatHistoryQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type ChatHistoryQuery = { __typename?: 'Query', chatHistory?: { __typename?: 'Chat', id: string, assignedUserId?: string | null, endUserId: string, chatStatus: ChatStatus, latestMessageTimestamp?: any | null, latestReadTimestamp?: any | null, sessionActive: boolean, isUserBlocked: boolean, createdAt: any, assignedUser?: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } | null, chatTeamAssignment: Array<{ __typename?: 'ChatTeamAssignment', id: string, chatId: string, createdAt?: any | null, teamId: string, team: { __typename?: 'BaseTeam', id: string, name: string, createdAt: any } }>, endUser: { __typename?: 'EndUser', userId: string, clientUserId?: string | null, displayName?: string | null, pictureUrl?: string | null, createdAt: any, updatedAt?: any | null }, chatAttributeValues: Array<{ __typename?: 'AttributeValue', id: string, value: string, chatId: string, attributeId: string, userId: string, createdAt: any, user: { __typename?: 'BaseUser', id: string, displayName: string } }>, chatTags: Array<{ __typename?: 'ChatTag', id: string, chatId: string, tagId: string, createdAt: any, tag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } }> } | null };

export type ChatDataQueryVariables = Exact<{
  chatId: Scalars['String']['input'];
  take?: InputMaybe<Scalars['Int']['input']>;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  cursorDirection?: InputMaybe<CursorDirection>;
}>;


export type ChatDataQuery = { __typename?: 'Query', chatData: { __typename?: 'ChatItemCursorPaginatedResponse', nextCursorId?: string | null, nextCursorCreatedAt?: any | null, hasMore: boolean, items: Array<{ __typename?: 'ChatItem', id: string, createdAt: any, itemType: ChatItemType, activity?: { __typename?: 'ChatActivity', id: string, chatId: string, activityType: ActivityType, actorType: ActorType, actorId?: string | null, actorUserName?: string | null, oldStatus?: ChatStatus | null, newStatus?: ChatStatus | null, oldUserId?: string | null, newUserId?: string | null, oldUserName?: string | null, newUserName?: string | null, changedTeamId?: string | null, changedTeamName?: string | null, teamAssignAction?: ChatTeamAssignActionsType | null, createdAt: any } | null, message?: { __typename?: 'ChatMessage', id: string, chatId: string, content: string, createdAt: any, previewImageUrl?: string | null, contentUrl?: string | null, senderId: string, senderType: SenderType, type: ChatMessageType, isDelivered: boolean, sender: { __typename?: 'Sender', id: string, displayName?: string | null, senderName?: string | null, pictureUrl?: string | null } } | null }> } };

export type ChatCountQueryVariables = Exact<{ [key: string]: never; }>;


export type ChatCountQuery = { __typename?: 'Query', chatCount: number };

export type UnassignedChatCountQueryVariables = Exact<{ [key: string]: never; }>;


export type UnassignedChatCountQuery = { __typename?: 'Query', unassignedChatCount: number };

export type ChangeChatStatusMutationVariables = Exact<{
  chatStatusInput: ChatStatusInput;
}>;


export type ChangeChatStatusMutation = { __typename?: 'Mutation', changeChatStatus: { __typename?: 'ChatActivity', id: string, chatId: string, activityType: ActivityType, actorType: ActorType, actorId?: string | null, actorUserName?: string | null, oldStatus?: ChatStatus | null, newStatus?: ChatStatus | null, oldUserId?: string | null, newUserId?: string | null, oldUserName?: string | null, newUserName?: string | null, changedTeamId?: string | null, changedTeamName?: string | null, teamAssignAction?: ChatTeamAssignActionsType | null, createdAt: any } };

export type SendMessageMutationVariables = Exact<{
  chatMessageInput: ChatMessageInput;
}>;


export type SendMessageMutation = { __typename?: 'Mutation', sendMessage: { __typename?: 'ChatMessage', id: string, chatId: string, content: string, createdAt: any, previewImageUrl?: string | null, contentUrl?: string | null, senderId: string, senderType: SenderType, type: ChatMessageType, isDelivered: boolean, sender: { __typename?: 'Sender', id: string, displayName?: string | null, senderName?: string | null, pictureUrl?: string | null } } };

export type SendUploadLinkMutationVariables = Exact<{
  input: ShareUploadLinkInput;
}>;


export type SendUploadLinkMutation = { __typename?: 'Mutation', sendUploadLink: { __typename?: 'ChatMessage', id: string, chatId: string, content: string, createdAt: any, previewImageUrl?: string | null, contentUrl?: string | null, senderId: string, senderType: SenderType, type: ChatMessageType, isDelivered: boolean, sender: { __typename?: 'Sender', id: string, displayName?: string | null, senderName?: string | null, pictureUrl?: string | null } } };

export type SendFileUploadedMessageMutationVariables = Exact<{
  input: SendFileUploadedMessageInput;
}>;


export type SendFileUploadedMessageMutation = { __typename?: 'Mutation', sendFileUploadedMessage: { __typename?: 'ChatMessage', id: string, chatId: string, content: string, createdAt: any, previewImageUrl?: string | null, contentUrl?: string | null, senderId: string, senderType: SenderType, type: ChatMessageType, isDelivered: boolean, sender: { __typename?: 'Sender', id: string, displayName?: string | null, senderName?: string | null, pictureUrl?: string | null } } };

export type SendMessageToLiglaMutationVariables = Exact<{
  chatId: Scalars['String']['input'];
  messageId: Scalars['String']['input'];
}>;


export type SendMessageToLiglaMutation = { __typename?: 'Mutation', sendMessageToLigla: { __typename?: 'ChatMessage', isDelivered: boolean } };

export type RetrySendMessageMutationVariables = Exact<{
  retryMessageInput: RetryMessageInput;
}>;


export type RetrySendMessageMutation = { __typename?: 'Mutation', retrySendMessage: { __typename?: 'ChatMessage', id: string, chatId: string, content: string, createdAt: any, previewImageUrl?: string | null, contentUrl?: string | null, senderId: string, senderType: SenderType, type: ChatMessageType, isDelivered: boolean, sender: { __typename?: 'Sender', id: string, displayName?: string | null, senderName?: string | null, pictureUrl?: string | null } } };

export type DeleteChatMessageMutationVariables = Exact<{
  deleteMessageInput: DeleteMessageInput;
}>;


export type DeleteChatMessageMutation = { __typename?: 'Mutation', deleteChatMessage: boolean };

export type AssignOperatorToChatMutationVariables = Exact<{
  chatAssignInput: ChatAssignInput;
}>;


export type AssignOperatorToChatMutation = { __typename?: 'Mutation', assignOperatorToChat: { __typename?: 'ChatActivity', id: string, chatId: string, activityType: ActivityType, actorType: ActorType, actorId?: string | null, actorUserName?: string | null, oldStatus?: ChatStatus | null, newStatus?: ChatStatus | null, oldUserId?: string | null, newUserId?: string | null, oldUserName?: string | null, newUserName?: string | null, changedTeamId?: string | null, changedTeamName?: string | null, teamAssignAction?: ChatTeamAssignActionsType | null, createdAt: any } };

export type AssignTeamToChatMutationVariables = Exact<{
  chatTeamAssignInput: ChatTeamAssignInput;
}>;


export type AssignTeamToChatMutation = { __typename?: 'Mutation', assignTeamToChat: { __typename?: 'ChatActivity', id: string, chatId: string, activityType: ActivityType, actorType: ActorType, actorId?: string | null, actorUserName?: string | null, oldStatus?: ChatStatus | null, newStatus?: ChatStatus | null, oldUserId?: string | null, newUserId?: string | null, oldUserName?: string | null, newUserName?: string | null, changedTeamId?: string | null, changedTeamName?: string | null, teamAssignAction?: ChatTeamAssignActionsType | null, createdAt: any } };

export type RemoveTeamFromChatMutationVariables = Exact<{
  chatTeamAssignInput: ChatTeamAssignInput;
}>;


export type RemoveTeamFromChatMutation = { __typename?: 'Mutation', removeTeamFromChat: { __typename?: 'ChatActivity', id: string, chatId: string, activityType: ActivityType, actorType: ActorType, actorId?: string | null, actorUserName?: string | null, oldStatus?: ChatStatus | null, newStatus?: ChatStatus | null, oldUserId?: string | null, newUserId?: string | null, oldUserName?: string | null, newUserName?: string | null, changedTeamId?: string | null, changedTeamName?: string | null, teamAssignAction?: ChatTeamAssignActionsType | null, createdAt: any } };

export type RemoveChatTagMutationVariables = Exact<{
  chatTagInput: ChatTagInput;
}>;


export type RemoveChatTagMutation = { __typename?: 'Mutation', removeChatTag: { __typename?: 'Chat', id: string, assignedUserId?: string | null, endUserId: string, chatStatus: ChatStatus, latestMessageTimestamp?: any | null, latestReadTimestamp?: any | null, sessionActive: boolean, isUserBlocked: boolean, createdAt: any, assignedUser?: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } | null, chatTeamAssignment: Array<{ __typename?: 'ChatTeamAssignment', id: string, chatId: string, createdAt?: any | null, teamId: string, team: { __typename?: 'BaseTeam', id: string, name: string, createdAt: any } }>, endUser: { __typename?: 'EndUser', userId: string, clientUserId?: string | null, displayName?: string | null, pictureUrl?: string | null, createdAt: any, updatedAt?: any | null }, chatAttributeValues: Array<{ __typename?: 'AttributeValue', id: string, value: string, chatId: string, attributeId: string, userId: string, createdAt: any, user: { __typename?: 'BaseUser', id: string, displayName: string } }>, chatTags: Array<{ __typename?: 'ChatTag', id: string, chatId: string, tagId: string, createdAt: any, tag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } }> } };

export type UpdateChatTagsMutationVariables = Exact<{
  updateChatTagsInput: UpdateChatTagsInput;
}>;


export type UpdateChatTagsMutation = { __typename?: 'Mutation', updateChatTags: { __typename?: 'Chat', id: string, assignedUserId?: string | null, endUserId: string, chatStatus: ChatStatus, latestMessageTimestamp?: any | null, latestReadTimestamp?: any | null, sessionActive: boolean, isUserBlocked: boolean, createdAt: any, assignedUser?: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } | null, chatTeamAssignment: Array<{ __typename?: 'ChatTeamAssignment', id: string, chatId: string, createdAt?: any | null, teamId: string, team: { __typename?: 'BaseTeam', id: string, name: string, createdAt: any } }>, endUser: { __typename?: 'EndUser', userId: string, clientUserId?: string | null, displayName?: string | null, pictureUrl?: string | null, createdAt: any, updatedAt?: any | null }, chatAttributeValues: Array<{ __typename?: 'AttributeValue', id: string, value: string, chatId: string, attributeId: string, userId: string, createdAt: any, user: { __typename?: 'BaseUser', id: string, displayName: string } }>, chatTags: Array<{ __typename?: 'ChatTag', id: string, chatId: string, tagId: string, createdAt: any, tag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } }> } };

export type UpdateChatLatestReadMutationVariables = Exact<{
  chatLatestReadInput: ChatLatestReadInput;
}>;


export type UpdateChatLatestReadMutation = { __typename?: 'Mutation', updateChatLatestRead: { __typename?: 'Chat', id: string, assignedUserId?: string | null, endUserId: string, chatStatus: ChatStatus, latestMessageTimestamp?: any | null, latestReadTimestamp?: any | null, sessionActive: boolean, isUserBlocked: boolean, createdAt: any, assignedUser?: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } | null, chatTeamAssignment: Array<{ __typename?: 'ChatTeamAssignment', id: string, chatId: string, createdAt?: any | null, teamId: string, team: { __typename?: 'BaseTeam', id: string, name: string, createdAt: any } }>, endUser: { __typename?: 'EndUser', userId: string, clientUserId?: string | null, displayName?: string | null, pictureUrl?: string | null, createdAt: any, updatedAt?: any | null }, chatAttributeValues: Array<{ __typename?: 'AttributeValue', id: string, value: string, chatId: string, attributeId: string, userId: string, createdAt: any, user: { __typename?: 'BaseUser', id: string, displayName: string } }>, chatTags: Array<{ __typename?: 'ChatTag', id: string, chatId: string, tagId: string, createdAt: any, tag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } }> } };

export type UploadChatFileMutationVariables = Exact<{
  input: UploadChatFileInput;
}>;


export type UploadChatFileMutation = { __typename?: 'Mutation', uploadChatFile: { __typename?: 'ChatFileUploadResponse', signedUrl: string, chatFile: { __typename?: 'ChatFile', id: string } } };

export type ConfirmChatFileUploadMutationVariables = Exact<{
  input: ConfirmChatFileUploadInput;
}>;


export type ConfirmChatFileUploadMutation = { __typename?: 'Mutation', confirmChatFileUpload: { __typename?: 'ConfirmChatFileUploadResponse', success: boolean, chatFile: { __typename?: 'ChatFile', id: string, fileName: string } } };

export type DeleteChatFileMutationVariables = Exact<{
  input: DeleteChatFileInput;
}>;


export type DeleteChatFileMutation = { __typename?: 'Mutation', deleteChatFile: { __typename?: 'DeleteChatFileResponse', success: boolean } };

export type ChatFilesQueryVariables = Exact<{
  chatId: Scalars['String']['input'];
  endUserId: Scalars['String']['input'];
  take?: InputMaybe<Scalars['Int']['input']>;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
}>;


export type ChatFilesQuery = { __typename?: 'Query', chatFiles: { __typename?: 'ChatFileListResponse', nextCursorId?: string | null, nextCursorCreatedAt?: any | null, hasMore: boolean, totalCount: number, items: Array<{ __typename?: 'ChatFile', id: string, chatId: string, fileName: string, originalFileName: string, fileSize: any, mimeType: string, status: FileStatus, createdAt: any, uploaderOperatorId?: string | null, uploaderEndUserId?: string | null, uploaderOperatorName?: string | null, uploaderEndUserName?: string | null }> } };

export type NoteFragmentFragment = { __typename?: 'ChatNote', id: string, chatId: string, noteValue: string, createdAt: any, updatedAt?: any | null, user: { __typename?: 'BaseUser', id: string, displayName: string } };

export type NotesQueryVariables = Exact<{
  chatId: Scalars['String']['input'];
}>;


export type NotesQuery = { __typename?: 'Query', notes: Array<{ __typename?: 'ChatNote', id: string, chatId: string, noteValue: string, createdAt: any, updatedAt?: any | null, user: { __typename?: 'BaseUser', id: string, displayName: string } }> };

export type CreateNoteMutationVariables = Exact<{
  createNoteInput: CreateChatNoteInput;
}>;


export type CreateNoteMutation = { __typename?: 'Mutation', createNote: { __typename?: 'ChatNote', id: string, chatId: string, noteValue: string, createdAt: any, updatedAt?: any | null, user: { __typename?: 'BaseUser', id: string, displayName: string } } };

export type UpdateNoteMutationVariables = Exact<{
  updateNoteInput: UpdateChatNoteInput;
}>;


export type UpdateNoteMutation = { __typename?: 'Mutation', updateNote: { __typename?: 'ChatNote', id: string, chatId: string, noteValue: string, createdAt: any, updatedAt?: any | null, user: { __typename?: 'BaseUser', id: string, displayName: string } } };

export type RemoveNoteMutationVariables = Exact<{
  id: Scalars['String']['input'];
  chatId: Scalars['String']['input'];
}>;


export type RemoveNoteMutation = { __typename?: 'Mutation', removeNote: { __typename?: 'ChatNote', id: string, chatId: string, noteValue: string, createdAt: any, updatedAt?: any | null, user: { __typename?: 'BaseUser', id: string, displayName: string } } };

export type ChatReplyScheduleFragmentFragment = { __typename?: 'ChatReplySchedule', scheduleType: ChatReplyScheduleType, chatReplyScheduleCustomDates: Array<any>, chatReplyScheduleTimeRanges: Array<{ __typename?: 'ChatReplyScheduleTimeRange', startTime: string, endTime: string, timeRangeType: ChatReplyTimeRangeType }> };

export type ChatReplyMessageFragmentFragment = { __typename?: 'ChatReplySettingMessage', timeRangeType: ChatReplyTimeRangeType, chatReplyMessageTemplate: { __typename?: 'ChatReplyMessageTemplate', content: string, type: ChatMessageType, previewImageUrl?: string | null, contentUrl?: string | null } };

export type ChatReplySettingFragment = { __typename?: 'ChatReplySetting', id: string, isActive: boolean, updatedBy?: string | null, chatReplySchedules: Array<{ __typename?: 'ChatReplySchedule', scheduleType: ChatReplyScheduleType, chatReplyScheduleCustomDates: Array<any>, chatReplyScheduleTimeRanges: Array<{ __typename?: 'ChatReplyScheduleTimeRange', startTime: string, endTime: string, timeRangeType: ChatReplyTimeRangeType }> }>, chatReplySettingMessages: Array<{ __typename?: 'ChatReplySettingMessage', timeRangeType: ChatReplyTimeRangeType, chatReplyMessageTemplate: { __typename?: 'ChatReplyMessageTemplate', content: string, type: ChatMessageType, previewImageUrl?: string | null, contentUrl?: string | null } }> };

export type ChatReplySettingQueryVariables = Exact<{
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
}>;


export type ChatReplySettingQuery = { __typename?: 'Query', chatReplySetting?: { __typename?: 'ChatReplySetting', id: string, isActive: boolean, updatedBy?: string | null, chatReplySchedules: Array<{ __typename?: 'ChatReplySchedule', scheduleType: ChatReplyScheduleType, chatReplyScheduleCustomDates: Array<any>, chatReplyScheduleTimeRanges: Array<{ __typename?: 'ChatReplyScheduleTimeRange', startTime: string, endTime: string, timeRangeType: ChatReplyTimeRangeType }> }>, chatReplySettingMessages: Array<{ __typename?: 'ChatReplySettingMessage', timeRangeType: ChatReplyTimeRangeType, chatReplyMessageTemplate: { __typename?: 'ChatReplyMessageTemplate', content: string, type: ChatMessageType, previewImageUrl?: string | null, contentUrl?: string | null } }> } | null };

export type CreateChatReplySettingMutationVariables = Exact<{
  createChatReplySettingInput: CreateChatReplySettingInput;
  inputOrganizationId?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateChatReplySettingMutation = { __typename?: 'Mutation', createChatReplySetting: { __typename?: 'ChatReplySetting', id: string, isActive: boolean, updatedBy?: string | null, chatReplySchedules: Array<{ __typename?: 'ChatReplySchedule', scheduleType: ChatReplyScheduleType, chatReplyScheduleCustomDates: Array<any>, chatReplyScheduleTimeRanges: Array<{ __typename?: 'ChatReplyScheduleTimeRange', startTime: string, endTime: string, timeRangeType: ChatReplyTimeRangeType }> }>, chatReplySettingMessages: Array<{ __typename?: 'ChatReplySettingMessage', timeRangeType: ChatReplyTimeRangeType, chatReplyMessageTemplate: { __typename?: 'ChatReplyMessageTemplate', content: string, type: ChatMessageType, previewImageUrl?: string | null, contentUrl?: string | null } }> } };

export type UpdateChatReplySettingMutationVariables = Exact<{
  updateChatReplySettingInput: UpdateChatReplySettingInput;
}>;


export type UpdateChatReplySettingMutation = { __typename?: 'Mutation', updateChatReplySetting: { __typename?: 'ChatReplySetting', id: string, isActive: boolean, updatedBy?: string | null, chatReplySchedules: Array<{ __typename?: 'ChatReplySchedule', scheduleType: ChatReplyScheduleType, chatReplyScheduleCustomDates: Array<any>, chatReplyScheduleTimeRanges: Array<{ __typename?: 'ChatReplyScheduleTimeRange', startTime: string, endTime: string, timeRangeType: ChatReplyTimeRangeType }> }>, chatReplySettingMessages: Array<{ __typename?: 'ChatReplySettingMessage', timeRangeType: ChatReplyTimeRangeType, chatReplyMessageTemplate: { __typename?: 'ChatReplyMessageTemplate', content: string, type: ChatMessageType, previewImageUrl?: string | null, contentUrl?: string | null } }> } };

export type ChatFilesForEndUserQueryVariables = Exact<{
  take?: InputMaybe<Scalars['Int']['input']>;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
}>;


export type ChatFilesForEndUserQuery = { __typename?: 'Query', chatFilesForEndUser: { __typename?: 'ChatFileListResponse', nextCursorId?: string | null, nextCursorCreatedAt?: any | null, hasMore: boolean, totalCount: number, items: Array<{ __typename?: 'ChatFile', id: string, chatId: string, fileName: string, originalFileName: string, fileSize: any, mimeType: string, status: FileStatus, createdAt: any, uploaderOperatorId?: string | null, uploaderEndUserId?: string | null, uploaderOperatorName?: string | null, uploaderEndUserName?: string | null }> } };

export type ChatFileDownloadUrlForEndUserQueryVariables = Exact<{
  input: DownloadChatFileEndUserInput;
}>;


export type ChatFileDownloadUrlForEndUserQuery = { __typename?: 'Query', chatFileDownloadUrlForEndUser: { __typename?: 'ChatFileDownloadUrlResponse', signedUrl: string, fileName: string, mimeType: string } };

export type UploadChatFileForEndUserMutationVariables = Exact<{
  input: UploadChatFileEndUserInput;
}>;


export type UploadChatFileForEndUserMutation = { __typename?: 'Mutation', uploadChatFileForEndUser: { __typename?: 'ChatFileUploadResponse', signedUrl: string, chatFile: { __typename?: 'ChatFile', id: string } } };

export type DeleteChatFileForEndUserMutationVariables = Exact<{
  input: DeleteChatFileEndUserInput;
}>;


export type DeleteChatFileForEndUserMutation = { __typename?: 'Mutation', deleteChatFileForEndUser: { __typename?: 'DeleteChatFileResponse', success: boolean } };

export type ConfirmChatFileUploadForEndUserMutationVariables = Exact<{
  input: ConfirmChatFileUploadEndUserInput;
}>;


export type ConfirmChatFileUploadForEndUserMutation = { __typename?: 'Mutation', confirmChatFileUploadForEndUser: { __typename?: 'ConfirmChatFileUploadResponse', success: boolean, chatFile: { __typename?: 'ChatFile', id: string, fileName: string, originalFileName: string, fileSize: any, mimeType: string, status: FileStatus } } };

export type MemberFeedColumnFragmentFragment = { __typename?: 'MemberFeedColumn', name: MemberFeedColumnType, alias: string, isEnabled: boolean };

export type MemberFeedColumnsQueryVariables = Exact<{ [key: string]: never; }>;


export type MemberFeedColumnsQuery = { __typename?: 'Query', memberFeedColumns: Array<{ __typename?: 'MemberFeedColumn', name: MemberFeedColumnType, alias: string, isEnabled: boolean }> };

export type MemberFeedsQueryVariables = Exact<{
  clientUserId?: InputMaybe<Scalars['String']['input']>;
}>;


export type MemberFeedsQuery = { __typename?: 'Query', memberFeeds?: Array<{ __typename?: 'MemberFeed', columnAlias: string, columnName: MemberFeedColumnType, value?: string | null }> | null };

export type UpdateMemberFeedSettingMutationVariables = Exact<{
  updateMemberFeedSettingInput: UpdateMemberFeedSettingInput;
}>;


export type UpdateMemberFeedSettingMutation = { __typename?: 'Mutation', updateMemberFeedSetting: Array<{ __typename?: 'MemberFeedColumn', name: MemberFeedColumnType, alias: string, isEnabled: boolean }> };

export type OrganizationWithUsersFragmentFragment = { __typename?: 'Organization', id: string, name: string, apiKey: string, displayName: string, description?: string | null, maxOperator: number, operatorCount: number, loginLiffId?: string | null, fileUploadLiffId?: string | null, isActive: boolean, users?: Array<{ __typename?: 'User', id: string, email: string, displayName: string, roleType: string, status: string }> | null };

export type OrganizationQueryVariables = Exact<{
  name: Scalars['String']['input'];
}>;


export type OrganizationQuery = { __typename?: 'Query', organization: { __typename?: 'Organization', id: string, name: string, apiKey: string, displayName: string, description?: string | null, maxOperator: number, operatorCount: number, loginLiffId?: string | null, fileUploadLiffId?: string | null, isActive: boolean, users?: Array<{ __typename?: 'User', id: string, email: string, displayName: string, roleType: string, status: string }> | null } };

export type OrganizationsQueryVariables = Exact<{ [key: string]: never; }>;


export type OrganizationsQuery = { __typename?: 'Query', organizations: { __typename?: 'OrganizationsWithCount', count: number, items: Array<{ __typename?: 'Organization', id: string, name: string, apiKey: string, displayName: string, description?: string | null, maxOperator: number, operatorCount: number, loginLiffId?: string | null, fileUploadLiffId?: string | null, isActive: boolean, users?: Array<{ __typename?: 'User', id: string, email: string, displayName: string, roleType: string, status: string }> | null }> } };

export type PaginatedOrganizationsQueryVariables = Exact<{
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<FilterInput>;
}>;


export type PaginatedOrganizationsQuery = { __typename?: 'Query', organizations: { __typename?: 'OrganizationsWithCount', count: number, items: Array<{ __typename?: 'Organization', id: string, name: string, apiKey: string, displayName: string, description?: string | null, maxOperator: number, operatorCount: number, loginLiffId?: string | null, fileUploadLiffId?: string | null, isActive: boolean, users?: Array<{ __typename?: 'User', id: string, email: string, displayName: string, roleType: string, status: string }> | null }> } };

export type CreateOrganizationMutationVariables = Exact<{
  createOrganizationInput: CreateOrganizationInput;
}>;


export type CreateOrganizationMutation = { __typename?: 'Mutation', createOrganization: { __typename?: 'Organization', id: string, name: string, apiKey: string, displayName: string, description?: string | null, maxOperator: number, operatorCount: number, loginLiffId?: string | null, fileUploadLiffId?: string | null, isActive: boolean, users?: Array<{ __typename?: 'User', id: string, email: string, displayName: string, roleType: string, status: string }> | null } };

export type UpdateOrganizationMutationVariables = Exact<{
  updateOrganizationInput: UpdateOrganizationInput;
}>;


export type UpdateOrganizationMutation = { __typename?: 'Mutation', updateOrganization: { __typename?: 'Organization', id: string, name: string, apiKey: string, displayName: string, description?: string | null, maxOperator: number, operatorCount: number, loginLiffId?: string | null, fileUploadLiffId?: string | null, isActive: boolean, users?: Array<{ __typename?: 'User', id: string, email: string, displayName: string, roleType: string, status: string }> | null } };

export type ToggleOrganizationStatusMutationVariables = Exact<{
  name: Scalars['String']['input'];
}>;


export type ToggleOrganizationStatusMutation = { __typename?: 'Mutation', toggleOrganizationStatus: { __typename?: 'Organization', id: string, name: string, apiKey: string, displayName: string, description?: string | null, maxOperator: number, operatorCount: number, loginLiffId?: string | null, fileUploadLiffId?: string | null, isActive: boolean, users?: Array<{ __typename?: 'User', id: string, email: string, displayName: string, roleType: string, status: string }> | null } };

export type ChatAssignFilterFragmentFragment = { __typename?: 'ChatAssignFilter', id: string, name: string, targetTable: FilterTargetType, note?: string | null, isActive: boolean, createdAt: any, updatedAt?: string | null, rootConditionGroup: { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> } };

export type ChatAssignFiltersQueryVariables = Exact<{
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<FilterInput>;
}>;


export type ChatAssignFiltersQuery = { __typename?: 'Query', chatAssignFilters: { __typename?: 'ChatAssignFiltersWithCount', count: number, items: Array<{ __typename?: 'ChatAssignFilter', id: string, name: string, targetTable: FilterTargetType, note?: string | null, isActive: boolean, createdAt: any, updatedAt?: string | null, rootConditionGroup: { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> } }> } };

export type ChatAssignFilterQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type ChatAssignFilterQuery = { __typename?: 'Query', chatAssignFilter: { __typename?: 'ChatAssignFilter', id: string, name: string, targetTable: FilterTargetType, note?: string | null, isActive: boolean, createdAt: any, updatedAt?: string | null, rootConditionGroup: { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> } } };

export type CreateChatAssignFilterMutationVariables = Exact<{
  createChatAssignFilterInput: CreateChatAssignFilterInput;
}>;


export type CreateChatAssignFilterMutation = { __typename?: 'Mutation', createChatAssignFilter: { __typename?: 'ChatAssignFilter', id: string, name: string, targetTable: FilterTargetType, note?: string | null, isActive: boolean, createdAt: any, updatedAt?: string | null, rootConditionGroup: { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> } } };

export type UpdateChatAssignFilterMutationVariables = Exact<{
  updateChatAssignFilterInput: UpdateChatAssignFilterInput;
}>;


export type UpdateChatAssignFilterMutation = { __typename?: 'Mutation', updateChatAssignFilter: { __typename?: 'ChatAssignFilter', id: string, name: string, targetTable: FilterTargetType, note?: string | null, isActive: boolean, createdAt: any, updatedAt?: string | null, rootConditionGroup: { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> } } };

export type DeleteChatAssignFilterMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteChatAssignFilterMutation = { __typename?: 'Mutation', deleteChatAssignFilter: { __typename?: 'ChatAssignFilter', id: string } };

export type ConditionGroupBaseFragmentFragment = { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> };

export type ConditionGroupFragmentLevel1Fragment = { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> };

export type ConditionGroupFragmentLevel2Fragment = { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> };

export type ConditionGroupFragmentLevel3Fragment = { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> };

export type ConditionGroupFragmentLevel4Fragment = { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> };

export type ConditionGroupFragmentLevel5Fragment = { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> };

export type ConditionGroupFragmentLevel6Fragment = { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> };

export type ConditionGroupFragmentLevel7Fragment = { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> };

export type ConditionGroupFragmentLevel8Fragment = { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> };

export type ConditionGroupFragmentLevel9Fragment = { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> };

export type ConditionGroupFragmentLevel10Fragment = { __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignConditionGroup', logicalOperator: LogicalOperator, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> }> | null, conditions: Array<{ __typename?: 'ChatAssignCondition', field: string, operator: ConditionOperator, value?: string | null, valueType: ValueType, valueObjects?: Array<{ __typename?: 'ConditionValue', id: string, name: string }> | null }> };

export type ChatAssignRuleFragmentFragment = { __typename?: 'ChatAssignRule', id: string, name: string, note?: string | null, isActive: boolean, createdAt: any, updatedAt?: string | null, rootFilterGroup: { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }, targetTeams: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> };

export type ChatAssignRulesQueryVariables = Exact<{
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<FilterInput>;
}>;


export type ChatAssignRulesQuery = { __typename?: 'Query', chatAssignRules: { __typename?: 'ChatAssignRulesWithCount', count: number, items: Array<{ __typename?: 'ChatAssignRule', id: string, name: string, note?: string | null, isActive: boolean, createdAt: any, updatedAt?: string | null, rootFilterGroup: { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }, targetTeams: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> }> } };

export type ChatAssignRuleQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type ChatAssignRuleQuery = { __typename?: 'Query', chatAssignRule: { __typename?: 'ChatAssignRule', id: string, name: string, note?: string | null, isActive: boolean, createdAt: any, updatedAt?: string | null, rootFilterGroup: { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }, targetTeams: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> } };

export type SelectableChatAssignFiltersQueryVariables = Exact<{ [key: string]: never; }>;


export type SelectableChatAssignFiltersQuery = { __typename?: 'Query', selectableChatAssignFilters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type CreateChatAssignRuleMutationVariables = Exact<{
  createChatAssignRuleInput: CreateChatAssignRuleInput;
}>;


export type CreateChatAssignRuleMutation = { __typename?: 'Mutation', createChatAssignRule: { __typename?: 'ChatAssignRule', id: string, name: string, note?: string | null, isActive: boolean, createdAt: any, updatedAt?: string | null, rootFilterGroup: { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }, targetTeams: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> } };

export type UpdateChatAssignRuleMutationVariables = Exact<{
  updateChatAssignRuleInput: UpdateChatAssignRuleInput;
}>;


export type UpdateChatAssignRuleMutation = { __typename?: 'Mutation', updateChatAssignRule: { __typename?: 'ChatAssignRule', id: string, name: string, note?: string | null, isActive: boolean, createdAt: any, updatedAt?: string | null, rootFilterGroup: { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }, targetTeams: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> } };

export type DeleteChatAssignRuleMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteChatAssignRuleMutation = { __typename?: 'Mutation', deleteChatAssignRule: { __typename?: 'ChatAssignRule', id: string } };

export type FilterGroupBaseFragmentFragment = { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type FilterGroupFragmentLevel1Fragment = { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type FilterGroupFragmentLevel2Fragment = { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type FilterGroupFragmentLevel3Fragment = { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type FilterGroupFragmentLevel4Fragment = { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type FilterGroupFragmentLevel5Fragment = { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type FilterGroupFragmentLevel6Fragment = { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type FilterGroupFragmentLevel7Fragment = { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type FilterGroupFragmentLevel8Fragment = { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type FilterGroupFragmentLevel9Fragment = { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type FilterGroupFragmentLevel10Fragment = { __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, subGroups?: Array<{ __typename?: 'ChatAssignFilterGroup', id: string, logicalOperator: LogicalOperator, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> }> | null, filters: Array<{ __typename?: 'ChatAssignFilterItem', id: string, name: string, targetTable: FilterTargetType }> };

export type StoreFragmentFragment = { __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any };

export type StoreQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type StoreQuery = { __typename?: 'Query', store: { __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any } };

export type StoresInfiniteScrollQueryVariables = Exact<{
  organizationId?: InputMaybe<Scalars['String']['input']>;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}>;


export type StoresInfiniteScrollQuery = { __typename?: 'Query', storesCursor: { __typename?: 'StoreCursorPaginatedResponse', hasMore: boolean, nextCursorId?: string | null, nextCursorCreatedAt?: any | null, items: Array<{ __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any }> } };

export type StoresQueryVariables = Exact<{
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<FilterInput>;
}>;


export type StoresQuery = { __typename?: 'Query', stores: { __typename?: 'StoresWithCount', count: number, items: Array<{ __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any }> } };

export type SurveysQueryVariables = Exact<{
  chatId: Scalars['String']['input'];
}>;


export type SurveysQuery = { __typename?: 'Query', surveys?: Array<{ __typename?: 'Survey', columnAlias: string, columnName: SurveyColumnType, value?: string | null }> | null };

export type SurveyColumnFragmentFragment = { __typename?: 'SurveyColumn', name: SurveyColumnType, alias: string, isEnabled: boolean };

export type SurveyColumnsQueryVariables = Exact<{ [key: string]: never; }>;


export type SurveyColumnsQuery = { __typename?: 'Query', surveyColumns: Array<{ __typename?: 'SurveyColumn', name: SurveyColumnType, alias: string, isEnabled: boolean }> };

export type UpdateSurveySettingMutationVariables = Exact<{
  updateSurveySettingInput: UpdateSurveySettingInput;
}>;


export type UpdateSurveySettingMutation = { __typename?: 'Mutation', updateSurveySetting: Array<{ __typename?: 'SurveyColumn', name: SurveyColumnType, alias: string, isEnabled: boolean }> };

export type TagFragmentFragment = { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any };

export type CursorPaginatedTagsQueryVariables = Exact<{
  take?: InputMaybe<Scalars['Int']['input']>;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
}>;


export type CursorPaginatedTagsQuery = { __typename?: 'Query', cursorPaginatedTags: { __typename?: 'TagCursorPaginatedResponse', hasMore: boolean, nextCursorId?: string | null, nextCursorCreatedAt?: any | null, items: Array<{ __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any }> } };

export type TagsQueryVariables = Exact<{
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<FilterInput>;
}>;


export type TagsQuery = { __typename?: 'Query', tags: { __typename?: 'TagsWithCount', count: number, items: Array<{ __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any }> } };

export type TagQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type TagQuery = { __typename?: 'Query', tag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } };

export type CreateTagMutationVariables = Exact<{
  createTagInput: CreateTagInput;
}>;


export type CreateTagMutation = { __typename?: 'Mutation', createTag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } };

export type UpdateTagMutationVariables = Exact<{
  updateTagInput: UpdateTagInput;
}>;


export type UpdateTagMutation = { __typename?: 'Mutation', updateTag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } };

export type ToggleTagStatusMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type ToggleTagStatusMutation = { __typename?: 'Mutation', toggleTagStatus: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } };

export type DisableTagMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DisableTagMutation = { __typename?: 'Mutation', disableTag: { __typename?: 'Tag', id: string, name: string, isActive: boolean, createdAt: any } };

export type TeamBaseFragmentFragment = { __typename?: 'BaseTeam', id: string, name: string, createdAt: any };

export type TeamFragmentFragment = { __typename?: 'Team', id: string, name: string, isActive: boolean, isDefault: boolean, createdAt: any, managers: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, operators: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, stores: Array<{ __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any }>, teamSetting?: { __typename?: 'TeamSetting', id: string, teamId: string, teamChatSetting?: { __typename?: 'TeamChatSetting', id: string, teamSettingId: string, viewAllChatsEnabled: boolean } | null } | null };

export type TeamSettingFragmentFragment = { __typename?: 'TeamSetting', id: string, teamId: string, teamChatSetting?: { __typename?: 'TeamChatSetting', id: string, teamSettingId: string, viewAllChatsEnabled: boolean } | null };

export type SelectabeTeamFragmentFragment = { __typename?: 'SelectableTeam', id: string, name: string, isDefault: boolean };

export type TeamQueryVariables = Exact<{
  id: Scalars['String']['input'];
  organizationId?: InputMaybe<Scalars['String']['input']>;
}>;


export type TeamQuery = { __typename?: 'Query', team: { __typename?: 'Team', id: string, name: string, isActive: boolean, isDefault: boolean, createdAt: any, managers: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, operators: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, stores: Array<{ __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any }>, teamSetting?: { __typename?: 'TeamSetting', id: string, teamId: string, teamChatSetting?: { __typename?: 'TeamChatSetting', id: string, teamSettingId: string, viewAllChatsEnabled: boolean } | null } | null } };

export type TeamsQueryVariables = Exact<{ [key: string]: never; }>;


export type TeamsQuery = { __typename?: 'Query', teams: { __typename?: 'TeamsWithCount', count: number, items: Array<{ __typename?: 'Team', id: string, name: string, isActive: boolean, isDefault: boolean, createdAt: any, managers: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, operators: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, stores: Array<{ __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any }>, teamSetting?: { __typename?: 'TeamSetting', id: string, teamId: string, teamChatSetting?: { __typename?: 'TeamChatSetting', id: string, teamSettingId: string, viewAllChatsEnabled: boolean } | null } | null }> } };

export type PaginatedTeamsQueryVariables = Exact<{
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  organizationId?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterInput>;
}>;


export type PaginatedTeamsQuery = { __typename?: 'Query', teams: { __typename?: 'TeamsWithCount', count: number, items: Array<{ __typename?: 'Team', id: string, name: string, isActive: boolean, isDefault: boolean, createdAt: any, managers: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, operators: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, stores: Array<{ __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any }>, teamSetting?: { __typename?: 'TeamSetting', id: string, teamId: string, teamChatSetting?: { __typename?: 'TeamChatSetting', id: string, teamSettingId: string, viewAllChatsEnabled: boolean } | null } | null }> } };

export type TeamsInChatQueryVariables = Exact<{
  chatId: Scalars['String']['input'];
}>;


export type TeamsInChatQuery = { __typename?: 'Query', teamsInChat: Array<{ __typename?: 'Team', id: string, name: string, isDefault: boolean, operators: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }> }> };

export type SelectableTeamsQueryVariables = Exact<{ [key: string]: never; }>;


export type SelectableTeamsQuery = { __typename?: 'Query', selectableTeams: Array<{ __typename?: 'SelectableTeam', id: string, name: string, isDefault: boolean }> };

export type SelectableTeamsForChatFilterQueryVariables = Exact<{ [key: string]: never; }>;


export type SelectableTeamsForChatFilterQuery = { __typename?: 'Query', selectableTeamsForChatFilter: Array<{ __typename?: 'SelectableTeam', id: string, name: string, isDefault: boolean }> };

export type CreateTeamMutationVariables = Exact<{
  createTeamInput: CreateTeamInput;
  organizationId?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateTeamMutation = { __typename?: 'Mutation', createTeam: { __typename?: 'Team', id: string, name: string, isActive: boolean, isDefault: boolean, createdAt: any, managers: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, operators: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, stores: Array<{ __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any }>, teamSetting?: { __typename?: 'TeamSetting', id: string, teamId: string, teamChatSetting?: { __typename?: 'TeamChatSetting', id: string, teamSettingId: string, viewAllChatsEnabled: boolean } | null } | null } };

export type UpdateTeamMutationVariables = Exact<{
  updateTeamInput: UpdateTeamInput;
  organizationId?: InputMaybe<Scalars['String']['input']>;
}>;


export type UpdateTeamMutation = { __typename?: 'Mutation', updateTeam: { __typename?: 'Team', id: string, name: string, isActive: boolean, isDefault: boolean, createdAt: any, managers: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, operators: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, stores: Array<{ __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any }>, teamSetting?: { __typename?: 'TeamSetting', id: string, teamId: string, teamChatSetting?: { __typename?: 'TeamChatSetting', id: string, teamSettingId: string, viewAllChatsEnabled: boolean } | null } | null } };

export type ToggleTeamStatusMutationVariables = Exact<{
  id: Scalars['String']['input'];
  organizationId?: InputMaybe<Scalars['String']['input']>;
}>;


export type ToggleTeamStatusMutation = { __typename?: 'Mutation', toggleTeamStatus: { __typename?: 'Team', id: string, name: string, isActive: boolean, isDefault: boolean, createdAt: any, managers: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, operators: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, stores: Array<{ __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any }>, teamSetting?: { __typename?: 'TeamSetting', id: string, teamId: string, teamChatSetting?: { __typename?: 'TeamChatSetting', id: string, teamSettingId: string, viewAllChatsEnabled: boolean } | null } | null } };

export type DisableTeamMutationVariables = Exact<{
  disableTeamId: Scalars['String']['input'];
  organizationId?: InputMaybe<Scalars['String']['input']>;
}>;


export type DisableTeamMutation = { __typename?: 'Mutation', disableTeam: { __typename?: 'Team', id: string, name: string, isActive: boolean, isDefault: boolean, createdAt: any, managers: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, operators: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }>, stores: Array<{ __typename?: 'Store', id: string, name: string, isActive: boolean, liglaStoreId?: number | null, areaName?: string | null, typeName?: string | null, note?: string | null, startsAt?: any | null, endsAt?: any | null, createdAt: any }>, teamSetting?: { __typename?: 'TeamSetting', id: string, teamId: string, teamChatSetting?: { __typename?: 'TeamChatSetting', id: string, teamSettingId: string, viewAllChatsEnabled: boolean } | null } | null } };

export type UserFragmentFragment = { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null };

export type SenderFragmentFragment = { __typename?: 'Sender', id: string, displayName?: string | null, senderName?: string | null, pictureUrl?: string | null };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } };

export type ManagersQueryVariables = Exact<{
  organizationId?: InputMaybe<Scalars['String']['input']>;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}>;


export type ManagersQuery = { __typename?: 'Query', managers: { __typename?: 'UserCursorPaginatedResponse', hasMore: boolean, nextCursorId?: string | null, nextCursorCreatedAt?: any | null, items: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }> } };

export type AllSelectableOperatorsQueryVariables = Exact<{
  organizationId?: InputMaybe<Scalars['String']['input']>;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
}>;


export type AllSelectableOperatorsQuery = { __typename?: 'Query', allSelectableOperators: { __typename?: 'UserCursorPaginatedResponse', hasMore: boolean, nextCursorId?: string | null, nextCursorCreatedAt?: any | null, items: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }> } };

export type AdminOperatorsQueryVariables = Exact<{
  take?: InputMaybe<Scalars['Int']['input']>;
  cursorId?: InputMaybe<Scalars['String']['input']>;
  cursorCreatedAt?: InputMaybe<Scalars['DateTime']['input']>;
}>;


export type AdminOperatorsQuery = { __typename?: 'Query', adminOperators: { __typename?: 'UserCursorPaginatedResponse', hasMore: boolean, nextCursorId?: string | null, nextCursorCreatedAt?: any | null, items: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }> } };

export type UsersQueryVariables = Exact<{
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  filter?: InputMaybe<FilterInput>;
}>;


export type UsersQuery = { __typename?: 'Query', operatorCount: number, maxOperatorCount: number, users: { __typename?: 'UsersWithCount', count: number, items: Array<{ __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null }> } };

export type UserQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type UserQuery = { __typename?: 'Query', user: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } };

export type CheckUserExistsQueryVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type CheckUserExistsQuery = { __typename?: 'Query', checkUserExists: boolean };

export type CreateUserMutationVariables = Exact<{
  createUserInput: CreateUserInput;
}>;


export type CreateUserMutation = { __typename?: 'Mutation', createUser: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } };

export type UpdateUserMutationVariables = Exact<{
  updateUserInput: UpdateUserInput;
}>;


export type UpdateUserMutation = { __typename?: 'Mutation', updateUser: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } };

export type ToggleUserStatusMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type ToggleUserStatusMutation = { __typename?: 'Mutation', toggleUserStatus: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } };

export type RemoveUserMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type RemoveUserMutation = { __typename?: 'Mutation', removeUser: boolean };

export type UpdateDisplayNameMutationVariables = Exact<{
  updateDisplayNameInput: UpdateDisplayNameInput;
}>;


export type UpdateDisplayNameMutation = { __typename?: 'Mutation', updateDisplayName: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } };

export type UpdateSenderNameMutationVariables = Exact<{
  updateSenderNameInput: UpdateSenderNameInput;
}>;


export type UpdateSenderNameMutation = { __typename?: 'Mutation', updateSenderName: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } };

export type ResetPasswordMutationVariables = Exact<{
  resetPasswordInput: ResetPasswordInput;
}>;


export type ResetPasswordMutation = { __typename?: 'Mutation', resetPassword: { __typename?: 'User', id: string, email: string, displayName: string, senderName?: string | null, roleType: string, systemUserType: SystemUserType, status: string, pictureUrl?: string | null, qrUrl?: string | null, createdAt: any, teams?: Array<{ __typename?: 'BaseTeam', id: string, name: string, createdAt: any }> | null, organization?: { __typename?: 'BaseOrganization', id: string, name: string, displayName: string, fileUploadLiffId?: string | null } | null } };

export const AttributeFragmentFragmentDoc = gql`
    fragment attributeFragment on Attribute {
  id
  name
  selectOption {
    id
    value
    label
  }
  type
  isActive
  isEncryptionEnabled
  createdAt
  chatId
}
    `;
export const ChatActivityFragmentFragmentDoc = gql`
    fragment chatActivityFragment on ChatActivity {
  id
  chatId
  activityType
  actorType
  actorId
  actorUserName
  oldStatus
  newStatus
  oldUserId
  newUserId
  oldUserName
  newUserName
  changedTeamId
  changedTeamName
  teamAssignAction
  createdAt
}
    `;
export const SenderFragmentFragmentDoc = gql`
    fragment senderFragment on Sender {
  id
  displayName
  senderName
  pictureUrl
}
    `;
export const ChatMessageFragmentFragmentDoc = gql`
    fragment chatMessageFragment on ChatMessage {
  id
  chatId
  content
  createdAt
  previewImageUrl
  contentUrl
  senderId
  sender {
    ...senderFragment
  }
  senderType
  type
  isDelivered
}
    ${SenderFragmentFragmentDoc}`;
export const ChatItemFragmentFragmentDoc = gql`
    fragment chatItemFragment on ChatItem {
  id
  activity {
    ...chatActivityFragment
  }
  message {
    ...chatMessageFragment
  }
  createdAt
  itemType
}
    ${ChatActivityFragmentFragmentDoc}
${ChatMessageFragmentFragmentDoc}`;
export const ChatNoteFragmentFragmentDoc = gql`
    fragment chatNoteFragment on ChatNote {
  id
  chatId
  noteValue
  createdAt
  updatedAt
  user {
    id
    displayName
  }
}
    `;
export const ChatFileListItemFragmentFragmentDoc = gql`
    fragment chatFileListItemFragment on ChatFile {
  id
  chatId
  fileName
  originalFileName
  fileSize
  mimeType
  status
  createdAt
  uploaderOperatorId
  uploaderEndUserId
  uploaderOperatorName
  uploaderEndUserName
}
    `;
export const TeamBaseFragmentFragmentDoc = gql`
    fragment teamBaseFragment on BaseTeam {
  id
  name
  createdAt
}
    `;
export const UserFragmentFragmentDoc = gql`
    fragment userFragment on User {
  id
  email
  displayName
  senderName
  roleType
  systemUserType
  status
  pictureUrl
  qrUrl
  createdAt
  teams {
    ...teamBaseFragment
  }
  organization {
    id
    name
    displayName
    fileUploadLiffId
  }
}
    ${TeamBaseFragmentFragmentDoc}`;
export const ChatTeamAssignmentFragmentFragmentDoc = gql`
    fragment chatTeamAssignmentFragment on ChatTeamAssignment {
  id
  chatId
  createdAt
  teamId
  team {
    ...teamBaseFragment
  }
}
    ${TeamBaseFragmentFragmentDoc}`;
export const EndUserFragmentFragmentDoc = gql`
    fragment endUserFragment on EndUser {
  userId
  clientUserId
  displayName
  pictureUrl
  createdAt
  updatedAt
}
    `;
export const ChatAttributeValueFragmentFragmentDoc = gql`
    fragment chatAttributeValueFragment on AttributeValue {
  id
  value
  chatId
  attributeId
  userId
  user {
    id
    displayName
  }
  createdAt
}
    `;
export const TagFragmentFragmentDoc = gql`
    fragment tagFragment on Tag {
  id
  name
  isActive
  createdAt
}
    `;
export const ChatTagFragmentFragmentDoc = gql`
    fragment chatTagFragment on ChatTag {
  id
  chatId
  tagId
  createdAt
  tag {
    ...tagFragment
  }
}
    ${TagFragmentFragmentDoc}`;
export const ChatsFragmentFragmentDoc = gql`
    fragment chatsFragment on Chat {
  id
  assignedUserId
  assignedUser {
    ...userFragment
  }
  chatTeamAssignment {
    ...chatTeamAssignmentFragment
  }
  chatMessages {
    ...chatMessageFragment
  }
  chatUnreadCount
  endUserId
  endUser {
    ...endUserFragment
  }
  chatAttributeValues {
    ...chatAttributeValueFragment
  }
  chatTags {
    ...chatTagFragment
  }
  chatStatus
  latestMessageTimestamp
  latestReadTimestamp
  sessionActive
  isUserBlocked
  createdAt
}
    ${UserFragmentFragmentDoc}
${ChatTeamAssignmentFragmentFragmentDoc}
${ChatMessageFragmentFragmentDoc}
${EndUserFragmentFragmentDoc}
${ChatAttributeValueFragmentFragmentDoc}
${ChatTagFragmentFragmentDoc}`;
export const ChatFragmentFragmentDoc = gql`
    fragment chatFragment on Chat {
  id
  assignedUserId
  assignedUser {
    ...userFragment
  }
  chatTeamAssignment {
    ...chatTeamAssignmentFragment
  }
  endUserId
  endUser {
    ...endUserFragment
  }
  chatAttributeValues {
    ...chatAttributeValueFragment
  }
  chatTags {
    ...chatTagFragment
  }
  chatStatus
  latestMessageTimestamp
  latestReadTimestamp
  sessionActive
  isUserBlocked
  createdAt
}
    ${UserFragmentFragmentDoc}
${ChatTeamAssignmentFragmentFragmentDoc}
${EndUserFragmentFragmentDoc}
${ChatAttributeValueFragmentFragmentDoc}
${ChatTagFragmentFragmentDoc}`;
export const NoteFragmentFragmentDoc = gql`
    fragment noteFragment on ChatNote {
  id
  chatId
  noteValue
  createdAt
  updatedAt
  user {
    id
    displayName
  }
}
    `;
export const ChatReplyScheduleFragmentFragmentDoc = gql`
    fragment chatReplyScheduleFragment on ChatReplySchedule {
  scheduleType
  chatReplyScheduleCustomDates
  chatReplyScheduleTimeRanges {
    startTime
    endTime
    timeRangeType
  }
}
    `;
export const ChatReplyMessageFragmentFragmentDoc = gql`
    fragment chatReplyMessageFragment on ChatReplySettingMessage {
  timeRangeType
  chatReplyMessageTemplate {
    content
    type
    previewImageUrl
    contentUrl
  }
}
    `;
export const ChatReplySettingFragmentDoc = gql`
    fragment chatReplySetting on ChatReplySetting {
  id
  isActive
  updatedBy
  chatReplySchedules {
    ...chatReplyScheduleFragment
  }
  chatReplySettingMessages {
    ...chatReplyMessageFragment
  }
}
    ${ChatReplyScheduleFragmentFragmentDoc}
${ChatReplyMessageFragmentFragmentDoc}`;
export const MemberFeedColumnFragmentFragmentDoc = gql`
    fragment memberFeedColumnFragment on MemberFeedColumn {
  name
  alias
  isEnabled
}
    `;
export const OrganizationWithUsersFragmentFragmentDoc = gql`
    fragment organizationWithUsersFragment on Organization {
  id
  name
  apiKey
  displayName
  description
  maxOperator
  operatorCount
  loginLiffId
  fileUploadLiffId
  isActive
  users {
    id
    email
    displayName
    roleType
    status
  }
}
    `;
export const ConditionGroupBaseFragmentFragmentDoc = gql`
    fragment conditionGroupBaseFragment on ChatAssignConditionGroup {
  logicalOperator
  conditions {
    field
    operator
    value
    valueType
    valueObjects {
      id
      name
    }
  }
}
    `;
export const ConditionGroupFragmentLevel1FragmentDoc = gql`
    fragment conditionGroupFragmentLevel1 on ChatAssignConditionGroup {
  ...conditionGroupBaseFragment
  subGroups {
    ...conditionGroupBaseFragment
  }
}
    ${ConditionGroupBaseFragmentFragmentDoc}`;
export const ConditionGroupFragmentLevel2FragmentDoc = gql`
    fragment conditionGroupFragmentLevel2 on ChatAssignConditionGroup {
  ...conditionGroupBaseFragment
  subGroups {
    ...conditionGroupFragmentLevel1
  }
}
    ${ConditionGroupBaseFragmentFragmentDoc}
${ConditionGroupFragmentLevel1FragmentDoc}`;
export const ConditionGroupFragmentLevel3FragmentDoc = gql`
    fragment conditionGroupFragmentLevel3 on ChatAssignConditionGroup {
  ...conditionGroupBaseFragment
  subGroups {
    ...conditionGroupFragmentLevel2
  }
}
    ${ConditionGroupBaseFragmentFragmentDoc}
${ConditionGroupFragmentLevel2FragmentDoc}`;
export const ConditionGroupFragmentLevel4FragmentDoc = gql`
    fragment conditionGroupFragmentLevel4 on ChatAssignConditionGroup {
  ...conditionGroupBaseFragment
  subGroups {
    ...conditionGroupFragmentLevel3
  }
}
    ${ConditionGroupBaseFragmentFragmentDoc}
${ConditionGroupFragmentLevel3FragmentDoc}`;
export const ConditionGroupFragmentLevel5FragmentDoc = gql`
    fragment conditionGroupFragmentLevel5 on ChatAssignConditionGroup {
  ...conditionGroupBaseFragment
  subGroups {
    ...conditionGroupFragmentLevel4
  }
}
    ${ConditionGroupBaseFragmentFragmentDoc}
${ConditionGroupFragmentLevel4FragmentDoc}`;
export const ConditionGroupFragmentLevel6FragmentDoc = gql`
    fragment conditionGroupFragmentLevel6 on ChatAssignConditionGroup {
  ...conditionGroupBaseFragment
  subGroups {
    ...conditionGroupFragmentLevel5
  }
}
    ${ConditionGroupBaseFragmentFragmentDoc}
${ConditionGroupFragmentLevel5FragmentDoc}`;
export const ConditionGroupFragmentLevel7FragmentDoc = gql`
    fragment conditionGroupFragmentLevel7 on ChatAssignConditionGroup {
  ...conditionGroupBaseFragment
  subGroups {
    ...conditionGroupFragmentLevel6
  }
}
    ${ConditionGroupBaseFragmentFragmentDoc}
${ConditionGroupFragmentLevel6FragmentDoc}`;
export const ConditionGroupFragmentLevel8FragmentDoc = gql`
    fragment conditionGroupFragmentLevel8 on ChatAssignConditionGroup {
  ...conditionGroupBaseFragment
  subGroups {
    ...conditionGroupFragmentLevel7
  }
}
    ${ConditionGroupBaseFragmentFragmentDoc}
${ConditionGroupFragmentLevel7FragmentDoc}`;
export const ConditionGroupFragmentLevel9FragmentDoc = gql`
    fragment conditionGroupFragmentLevel9 on ChatAssignConditionGroup {
  ...conditionGroupBaseFragment
  subGroups {
    ...conditionGroupFragmentLevel8
  }
}
    ${ConditionGroupBaseFragmentFragmentDoc}
${ConditionGroupFragmentLevel8FragmentDoc}`;
export const ConditionGroupFragmentLevel10FragmentDoc = gql`
    fragment conditionGroupFragmentLevel10 on ChatAssignConditionGroup {
  ...conditionGroupBaseFragment
  subGroups {
    ...conditionGroupFragmentLevel9
  }
}
    ${ConditionGroupBaseFragmentFragmentDoc}
${ConditionGroupFragmentLevel9FragmentDoc}`;
export const ChatAssignFilterFragmentFragmentDoc = gql`
    fragment chatAssignFilterFragment on ChatAssignFilter {
  id
  name
  targetTable
  note
  isActive
  createdAt
  updatedAt
  rootConditionGroup {
    ...conditionGroupFragmentLevel10
  }
}
    ${ConditionGroupFragmentLevel10FragmentDoc}`;
export const FilterGroupBaseFragmentFragmentDoc = gql`
    fragment filterGroupBaseFragment on ChatAssignFilterGroup {
  id
  logicalOperator
  filters {
    id
    name
    targetTable
  }
}
    `;
export const FilterGroupFragmentLevel1FragmentDoc = gql`
    fragment filterGroupFragmentLevel1 on ChatAssignFilterGroup {
  ...filterGroupBaseFragment
  subGroups {
    ...filterGroupBaseFragment
  }
}
    ${FilterGroupBaseFragmentFragmentDoc}`;
export const FilterGroupFragmentLevel2FragmentDoc = gql`
    fragment filterGroupFragmentLevel2 on ChatAssignFilterGroup {
  ...filterGroupBaseFragment
  subGroups {
    ...filterGroupFragmentLevel1
  }
}
    ${FilterGroupBaseFragmentFragmentDoc}
${FilterGroupFragmentLevel1FragmentDoc}`;
export const FilterGroupFragmentLevel3FragmentDoc = gql`
    fragment filterGroupFragmentLevel3 on ChatAssignFilterGroup {
  ...filterGroupBaseFragment
  subGroups {
    ...filterGroupFragmentLevel2
  }
}
    ${FilterGroupBaseFragmentFragmentDoc}
${FilterGroupFragmentLevel2FragmentDoc}`;
export const FilterGroupFragmentLevel4FragmentDoc = gql`
    fragment filterGroupFragmentLevel4 on ChatAssignFilterGroup {
  ...filterGroupBaseFragment
  subGroups {
    ...filterGroupFragmentLevel3
  }
}
    ${FilterGroupBaseFragmentFragmentDoc}
${FilterGroupFragmentLevel3FragmentDoc}`;
export const FilterGroupFragmentLevel5FragmentDoc = gql`
    fragment filterGroupFragmentLevel5 on ChatAssignFilterGroup {
  ...filterGroupBaseFragment
  subGroups {
    ...filterGroupFragmentLevel4
  }
}
    ${FilterGroupBaseFragmentFragmentDoc}
${FilterGroupFragmentLevel4FragmentDoc}`;
export const FilterGroupFragmentLevel6FragmentDoc = gql`
    fragment filterGroupFragmentLevel6 on ChatAssignFilterGroup {
  ...filterGroupBaseFragment
  subGroups {
    ...filterGroupFragmentLevel5
  }
}
    ${FilterGroupBaseFragmentFragmentDoc}
${FilterGroupFragmentLevel5FragmentDoc}`;
export const FilterGroupFragmentLevel7FragmentDoc = gql`
    fragment filterGroupFragmentLevel7 on ChatAssignFilterGroup {
  ...filterGroupBaseFragment
  subGroups {
    ...filterGroupFragmentLevel6
  }
}
    ${FilterGroupBaseFragmentFragmentDoc}
${FilterGroupFragmentLevel6FragmentDoc}`;
export const FilterGroupFragmentLevel8FragmentDoc = gql`
    fragment filterGroupFragmentLevel8 on ChatAssignFilterGroup {
  ...filterGroupBaseFragment
  subGroups {
    ...filterGroupFragmentLevel7
  }
}
    ${FilterGroupBaseFragmentFragmentDoc}
${FilterGroupFragmentLevel7FragmentDoc}`;
export const FilterGroupFragmentLevel9FragmentDoc = gql`
    fragment filterGroupFragmentLevel9 on ChatAssignFilterGroup {
  ...filterGroupBaseFragment
  subGroups {
    ...filterGroupFragmentLevel8
  }
}
    ${FilterGroupBaseFragmentFragmentDoc}
${FilterGroupFragmentLevel8FragmentDoc}`;
export const FilterGroupFragmentLevel10FragmentDoc = gql`
    fragment filterGroupFragmentLevel10 on ChatAssignFilterGroup {
  ...filterGroupBaseFragment
  subGroups {
    ...filterGroupFragmentLevel9
  }
}
    ${FilterGroupBaseFragmentFragmentDoc}
${FilterGroupFragmentLevel9FragmentDoc}`;
export const ChatAssignRuleFragmentFragmentDoc = gql`
    fragment chatAssignRuleFragment on ChatAssignRule {
  id
  name
  note
  isActive
  createdAt
  updatedAt
  rootFilterGroup {
    ...filterGroupFragmentLevel10
  }
  targetTeams {
    id
    name
    createdAt
  }
}
    ${FilterGroupFragmentLevel10FragmentDoc}`;
export const SurveyColumnFragmentFragmentDoc = gql`
    fragment surveyColumnFragment on SurveyColumn {
  name
  alias
  isEnabled
}
    `;
export const StoreFragmentFragmentDoc = gql`
    fragment storeFragment on Store {
  id
  name
  isActive
  liglaStoreId
  areaName
  typeName
  note
  startsAt
  endsAt
  createdAt
}
    `;
export const TeamSettingFragmentFragmentDoc = gql`
    fragment teamSettingFragment on TeamSetting {
  id
  teamId
  teamChatSetting {
    id
    teamSettingId
    viewAllChatsEnabled
  }
}
    `;
export const TeamFragmentFragmentDoc = gql`
    fragment teamFragment on Team {
  id
  name
  managers {
    ...userFragment
  }
  operators {
    ...userFragment
  }
  stores {
    ...storeFragment
  }
  teamSetting {
    ...teamSettingFragment
  }
  isActive
  isDefault
  createdAt
}
    ${UserFragmentFragmentDoc}
${StoreFragmentFragmentDoc}
${TeamSettingFragmentFragmentDoc}`;
export const SelectabeTeamFragmentFragmentDoc = gql`
    fragment selectabeTeamFragment on SelectableTeam {
  id
  name
  isDefault
}
    `;
export const AttributeDocument = gql`
    query attribute($id: String!) {
  attribute(id: $id) {
    ...attributeFragment
  }
}
    ${AttributeFragmentFragmentDoc}`;

/**
 * __useAttributeQuery__
 *
 * To run a query within a React component, call `useAttributeQuery` and pass it any options that fit your needs.
 * When your component renders, `useAttributeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAttributeQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useAttributeQuery(baseOptions: Apollo.QueryHookOptions<AttributeQuery, AttributeQueryVariables> & ({ variables: AttributeQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AttributeQuery, AttributeQueryVariables>(AttributeDocument, options);
      }
export function useAttributeLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AttributeQuery, AttributeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AttributeQuery, AttributeQueryVariables>(AttributeDocument, options);
        }
// @ts-ignore
export function useAttributeSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AttributeQuery, AttributeQueryVariables>): Apollo.UseSuspenseQueryResult<AttributeQuery, AttributeQueryVariables>;
export function useAttributeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AttributeQuery, AttributeQueryVariables>): Apollo.UseSuspenseQueryResult<AttributeQuery | undefined, AttributeQueryVariables>;
export function useAttributeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AttributeQuery, AttributeQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AttributeQuery, AttributeQueryVariables>(AttributeDocument, options);
        }
export type AttributeQueryHookResult = ReturnType<typeof useAttributeQuery>;
export type AttributeLazyQueryHookResult = ReturnType<typeof useAttributeLazyQuery>;
export type AttributeSuspenseQueryHookResult = ReturnType<typeof useAttributeSuspenseQuery>;
export type AttributeQueryResult = Apollo.QueryResult<AttributeQuery, AttributeQueryVariables>;
export const AttributesDocument = gql`
    query attributes {
  attributes {
    items {
      ...attributeFragment
    }
    count
  }
}
    ${AttributeFragmentFragmentDoc}`;

/**
 * __useAttributesQuery__
 *
 * To run a query within a React component, call `useAttributesQuery` and pass it any options that fit your needs.
 * When your component renders, `useAttributesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAttributesQuery({
 *   variables: {
 *   },
 * });
 */
export function useAttributesQuery(baseOptions?: Apollo.QueryHookOptions<AttributesQuery, AttributesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AttributesQuery, AttributesQueryVariables>(AttributesDocument, options);
      }
export function useAttributesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AttributesQuery, AttributesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AttributesQuery, AttributesQueryVariables>(AttributesDocument, options);
        }
// @ts-ignore
export function useAttributesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AttributesQuery, AttributesQueryVariables>): Apollo.UseSuspenseQueryResult<AttributesQuery, AttributesQueryVariables>;
export function useAttributesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AttributesQuery, AttributesQueryVariables>): Apollo.UseSuspenseQueryResult<AttributesQuery | undefined, AttributesQueryVariables>;
export function useAttributesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AttributesQuery, AttributesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AttributesQuery, AttributesQueryVariables>(AttributesDocument, options);
        }
export type AttributesQueryHookResult = ReturnType<typeof useAttributesQuery>;
export type AttributesLazyQueryHookResult = ReturnType<typeof useAttributesLazyQuery>;
export type AttributesSuspenseQueryHookResult = ReturnType<typeof useAttributesSuspenseQuery>;
export type AttributesQueryResult = Apollo.QueryResult<AttributesQuery, AttributesQueryVariables>;
export const PaginatedAttributesDocument = gql`
    query paginatedAttributes($skip: Int, $take: Int, $filter: FilterInput) {
  attributes(skip: $skip, take: $take, filter: $filter) {
    items {
      ...attributeFragment
    }
    count
  }
}
    ${AttributeFragmentFragmentDoc}`;

/**
 * __usePaginatedAttributesQuery__
 *
 * To run a query within a React component, call `usePaginatedAttributesQuery` and pass it any options that fit your needs.
 * When your component renders, `usePaginatedAttributesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePaginatedAttributesQuery({
 *   variables: {
 *      skip: // value for 'skip'
 *      take: // value for 'take'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function usePaginatedAttributesQuery(baseOptions?: Apollo.QueryHookOptions<PaginatedAttributesQuery, PaginatedAttributesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PaginatedAttributesQuery, PaginatedAttributesQueryVariables>(PaginatedAttributesDocument, options);
      }
export function usePaginatedAttributesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PaginatedAttributesQuery, PaginatedAttributesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PaginatedAttributesQuery, PaginatedAttributesQueryVariables>(PaginatedAttributesDocument, options);
        }
// @ts-ignore
export function usePaginatedAttributesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<PaginatedAttributesQuery, PaginatedAttributesQueryVariables>): Apollo.UseSuspenseQueryResult<PaginatedAttributesQuery, PaginatedAttributesQueryVariables>;
export function usePaginatedAttributesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<PaginatedAttributesQuery, PaginatedAttributesQueryVariables>): Apollo.UseSuspenseQueryResult<PaginatedAttributesQuery | undefined, PaginatedAttributesQueryVariables>;
export function usePaginatedAttributesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<PaginatedAttributesQuery, PaginatedAttributesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<PaginatedAttributesQuery, PaginatedAttributesQueryVariables>(PaginatedAttributesDocument, options);
        }
export type PaginatedAttributesQueryHookResult = ReturnType<typeof usePaginatedAttributesQuery>;
export type PaginatedAttributesLazyQueryHookResult = ReturnType<typeof usePaginatedAttributesLazyQuery>;
export type PaginatedAttributesSuspenseQueryHookResult = ReturnType<typeof usePaginatedAttributesSuspenseQuery>;
export type PaginatedAttributesQueryResult = Apollo.QueryResult<PaginatedAttributesQuery, PaginatedAttributesQueryVariables>;
export const CreateAttributeDocument = gql`
    mutation createAttribute($createAttributeInput: CreateAttributeInput!) {
  createAttribute(createAttributeInput: $createAttributeInput) {
    ...attributeFragment
  }
}
    ${AttributeFragmentFragmentDoc}`;
export type CreateAttributeMutationFn = Apollo.MutationFunction<CreateAttributeMutation, CreateAttributeMutationVariables>;

/**
 * __useCreateAttributeMutation__
 *
 * To run a mutation, you first call `useCreateAttributeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateAttributeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createAttributeMutation, { data, loading, error }] = useCreateAttributeMutation({
 *   variables: {
 *      createAttributeInput: // value for 'createAttributeInput'
 *   },
 * });
 */
export function useCreateAttributeMutation(baseOptions?: Apollo.MutationHookOptions<CreateAttributeMutation, CreateAttributeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateAttributeMutation, CreateAttributeMutationVariables>(CreateAttributeDocument, options);
      }
export type CreateAttributeMutationHookResult = ReturnType<typeof useCreateAttributeMutation>;
export type CreateAttributeMutationResult = Apollo.MutationResult<CreateAttributeMutation>;
export type CreateAttributeMutationOptions = Apollo.BaseMutationOptions<CreateAttributeMutation, CreateAttributeMutationVariables>;
export const UpdateAttributeDocument = gql`
    mutation updateAttribute($updateAttributeInput: UpdateAttributeInput!) {
  updateAttribute(updateAttributeInput: $updateAttributeInput) {
    ...attributeFragment
  }
}
    ${AttributeFragmentFragmentDoc}`;
export type UpdateAttributeMutationFn = Apollo.MutationFunction<UpdateAttributeMutation, UpdateAttributeMutationVariables>;

/**
 * __useUpdateAttributeMutation__
 *
 * To run a mutation, you first call `useUpdateAttributeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateAttributeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateAttributeMutation, { data, loading, error }] = useUpdateAttributeMutation({
 *   variables: {
 *      updateAttributeInput: // value for 'updateAttributeInput'
 *   },
 * });
 */
export function useUpdateAttributeMutation(baseOptions?: Apollo.MutationHookOptions<UpdateAttributeMutation, UpdateAttributeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateAttributeMutation, UpdateAttributeMutationVariables>(UpdateAttributeDocument, options);
      }
export type UpdateAttributeMutationHookResult = ReturnType<typeof useUpdateAttributeMutation>;
export type UpdateAttributeMutationResult = Apollo.MutationResult<UpdateAttributeMutation>;
export type UpdateAttributeMutationOptions = Apollo.BaseMutationOptions<UpdateAttributeMutation, UpdateAttributeMutationVariables>;
export const ToggleAttributeStatusDocument = gql`
    mutation toggleAttributeStatus($id: String!) {
  toggleAttributeStatus(id: $id) {
    ...attributeFragment
  }
}
    ${AttributeFragmentFragmentDoc}`;
export type ToggleAttributeStatusMutationFn = Apollo.MutationFunction<ToggleAttributeStatusMutation, ToggleAttributeStatusMutationVariables>;

/**
 * __useToggleAttributeStatusMutation__
 *
 * To run a mutation, you first call `useToggleAttributeStatusMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useToggleAttributeStatusMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [toggleAttributeStatusMutation, { data, loading, error }] = useToggleAttributeStatusMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useToggleAttributeStatusMutation(baseOptions?: Apollo.MutationHookOptions<ToggleAttributeStatusMutation, ToggleAttributeStatusMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ToggleAttributeStatusMutation, ToggleAttributeStatusMutationVariables>(ToggleAttributeStatusDocument, options);
      }
export type ToggleAttributeStatusMutationHookResult = ReturnType<typeof useToggleAttributeStatusMutation>;
export type ToggleAttributeStatusMutationResult = Apollo.MutationResult<ToggleAttributeStatusMutation>;
export type ToggleAttributeStatusMutationOptions = Apollo.BaseMutationOptions<ToggleAttributeStatusMutation, ToggleAttributeStatusMutationVariables>;
export const DisableAttributeDocument = gql`
    mutation disableAttribute($id: String!) {
  disableAttribute(id: $id) {
    ...attributeFragment
  }
}
    ${AttributeFragmentFragmentDoc}`;
export type DisableAttributeMutationFn = Apollo.MutationFunction<DisableAttributeMutation, DisableAttributeMutationVariables>;

/**
 * __useDisableAttributeMutation__
 *
 * To run a mutation, you first call `useDisableAttributeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDisableAttributeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [disableAttributeMutation, { data, loading, error }] = useDisableAttributeMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDisableAttributeMutation(baseOptions?: Apollo.MutationHookOptions<DisableAttributeMutation, DisableAttributeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DisableAttributeMutation, DisableAttributeMutationVariables>(DisableAttributeDocument, options);
      }
export type DisableAttributeMutationHookResult = ReturnType<typeof useDisableAttributeMutation>;
export type DisableAttributeMutationResult = Apollo.MutationResult<DisableAttributeMutation>;
export type DisableAttributeMutationOptions = Apollo.BaseMutationOptions<DisableAttributeMutation, DisableAttributeMutationVariables>;
export const FillChatAttributeValueDocument = gql`
    mutation fillChatAttributeValue($createChatAttributeValueInput: CreateChatAttributeValueInput!) {
  fillChatAttributeValue(
    createChatAttributeValueInput: $createChatAttributeValueInput
  ) {
    ...chatAttributeValueFragment
  }
}
    ${ChatAttributeValueFragmentFragmentDoc}`;
export type FillChatAttributeValueMutationFn = Apollo.MutationFunction<FillChatAttributeValueMutation, FillChatAttributeValueMutationVariables>;

/**
 * __useFillChatAttributeValueMutation__
 *
 * To run a mutation, you first call `useFillChatAttributeValueMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useFillChatAttributeValueMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [fillChatAttributeValueMutation, { data, loading, error }] = useFillChatAttributeValueMutation({
 *   variables: {
 *      createChatAttributeValueInput: // value for 'createChatAttributeValueInput'
 *   },
 * });
 */
export function useFillChatAttributeValueMutation(baseOptions?: Apollo.MutationHookOptions<FillChatAttributeValueMutation, FillChatAttributeValueMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<FillChatAttributeValueMutation, FillChatAttributeValueMutationVariables>(FillChatAttributeValueDocument, options);
      }
export type FillChatAttributeValueMutationHookResult = ReturnType<typeof useFillChatAttributeValueMutation>;
export type FillChatAttributeValueMutationResult = Apollo.MutationResult<FillChatAttributeValueMutation>;
export type FillChatAttributeValueMutationOptions = Apollo.BaseMutationOptions<FillChatAttributeValueMutation, FillChatAttributeValueMutationVariables>;
export const LoginDocument = gql`
    mutation login($loginInput: LoginInput!) {
  login(loginInput: $loginInput) {
    accessToken
  }
}
    `;
export type LoginMutationFn = Apollo.MutationFunction<LoginMutation, LoginMutationVariables>;

/**
 * __useLoginMutation__
 *
 * To run a mutation, you first call `useLoginMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLoginMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [loginMutation, { data, loading, error }] = useLoginMutation({
 *   variables: {
 *      loginInput: // value for 'loginInput'
 *   },
 * });
 */
export function useLoginMutation(baseOptions?: Apollo.MutationHookOptions<LoginMutation, LoginMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<LoginMutation, LoginMutationVariables>(LoginDocument, options);
      }
export type LoginMutationHookResult = ReturnType<typeof useLoginMutation>;
export type LoginMutationResult = Apollo.MutationResult<LoginMutation>;
export type LoginMutationOptions = Apollo.BaseMutationOptions<LoginMutation, LoginMutationVariables>;
export const LoginToHypervisorDocument = gql`
    mutation loginToHypervisor($loginInput: LoginInput!) {
  loginToHypervisor(loginInput: $loginInput) {
    accessToken
  }
}
    `;
export type LoginToHypervisorMutationFn = Apollo.MutationFunction<LoginToHypervisorMutation, LoginToHypervisorMutationVariables>;

/**
 * __useLoginToHypervisorMutation__
 *
 * To run a mutation, you first call `useLoginToHypervisorMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLoginToHypervisorMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [loginToHypervisorMutation, { data, loading, error }] = useLoginToHypervisorMutation({
 *   variables: {
 *      loginInput: // value for 'loginInput'
 *   },
 * });
 */
export function useLoginToHypervisorMutation(baseOptions?: Apollo.MutationHookOptions<LoginToHypervisorMutation, LoginToHypervisorMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<LoginToHypervisorMutation, LoginToHypervisorMutationVariables>(LoginToHypervisorDocument, options);
      }
export type LoginToHypervisorMutationHookResult = ReturnType<typeof useLoginToHypervisorMutation>;
export type LoginToHypervisorMutationResult = Apollo.MutationResult<LoginToHypervisorMutation>;
export type LoginToHypervisorMutationOptions = Apollo.BaseMutationOptions<LoginToHypervisorMutation, LoginToHypervisorMutationVariables>;
export const ResetPasswordByTokenDocument = gql`
    mutation resetPasswordByToken($resetPasswordByTokenInput: ResetPasswordByTokenInput!) {
  resetPasswordByToken(resetPasswordByTokenInput: $resetPasswordByTokenInput) {
    success
    warning
  }
}
    `;
export type ResetPasswordByTokenMutationFn = Apollo.MutationFunction<ResetPasswordByTokenMutation, ResetPasswordByTokenMutationVariables>;

/**
 * __useResetPasswordByTokenMutation__
 *
 * To run a mutation, you first call `useResetPasswordByTokenMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useResetPasswordByTokenMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [resetPasswordByTokenMutation, { data, loading, error }] = useResetPasswordByTokenMutation({
 *   variables: {
 *      resetPasswordByTokenInput: // value for 'resetPasswordByTokenInput'
 *   },
 * });
 */
export function useResetPasswordByTokenMutation(baseOptions?: Apollo.MutationHookOptions<ResetPasswordByTokenMutation, ResetPasswordByTokenMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ResetPasswordByTokenMutation, ResetPasswordByTokenMutationVariables>(ResetPasswordByTokenDocument, options);
      }
export type ResetPasswordByTokenMutationHookResult = ReturnType<typeof useResetPasswordByTokenMutation>;
export type ResetPasswordByTokenMutationResult = Apollo.MutationResult<ResetPasswordByTokenMutation>;
export type ResetPasswordByTokenMutationOptions = Apollo.BaseMutationOptions<ResetPasswordByTokenMutation, ResetPasswordByTokenMutationVariables>;
export const RequestPasswordResetDocument = gql`
    mutation requestPasswordReset($email: String!) {
  requestPasswordReset(email: $email)
}
    `;
export type RequestPasswordResetMutationFn = Apollo.MutationFunction<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>;

/**
 * __useRequestPasswordResetMutation__
 *
 * To run a mutation, you first call `useRequestPasswordResetMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRequestPasswordResetMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [requestPasswordResetMutation, { data, loading, error }] = useRequestPasswordResetMutation({
 *   variables: {
 *      email: // value for 'email'
 *   },
 * });
 */
export function useRequestPasswordResetMutation(baseOptions?: Apollo.MutationHookOptions<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>(RequestPasswordResetDocument, options);
      }
export type RequestPasswordResetMutationHookResult = ReturnType<typeof useRequestPasswordResetMutation>;
export type RequestPasswordResetMutationResult = Apollo.MutationResult<RequestPasswordResetMutation>;
export type RequestPasswordResetMutationOptions = Apollo.BaseMutationOptions<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>;
export const RequestReInviteDocument = gql`
    mutation requestReInvite($email: String!) {
  requestReInvite(email: $email)
}
    `;
export type RequestReInviteMutationFn = Apollo.MutationFunction<RequestReInviteMutation, RequestReInviteMutationVariables>;

/**
 * __useRequestReInviteMutation__
 *
 * To run a mutation, you first call `useRequestReInviteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRequestReInviteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [requestReInviteMutation, { data, loading, error }] = useRequestReInviteMutation({
 *   variables: {
 *      email: // value for 'email'
 *   },
 * });
 */
export function useRequestReInviteMutation(baseOptions?: Apollo.MutationHookOptions<RequestReInviteMutation, RequestReInviteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RequestReInviteMutation, RequestReInviteMutationVariables>(RequestReInviteDocument, options);
      }
export type RequestReInviteMutationHookResult = ReturnType<typeof useRequestReInviteMutation>;
export type RequestReInviteMutationResult = Apollo.MutationResult<RequestReInviteMutation>;
export type RequestReInviteMutationOptions = Apollo.BaseMutationOptions<RequestReInviteMutation, RequestReInviteMutationVariables>;
export const VerifyPasswordResetTokenDocument = gql`
    query verifyPasswordResetToken($token: String!) {
  verifyPasswordResetToken(token: $token)
}
    `;

/**
 * __useVerifyPasswordResetTokenQuery__
 *
 * To run a query within a React component, call `useVerifyPasswordResetTokenQuery` and pass it any options that fit your needs.
 * When your component renders, `useVerifyPasswordResetTokenQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useVerifyPasswordResetTokenQuery({
 *   variables: {
 *      token: // value for 'token'
 *   },
 * });
 */
export function useVerifyPasswordResetTokenQuery(baseOptions: Apollo.QueryHookOptions<VerifyPasswordResetTokenQuery, VerifyPasswordResetTokenQueryVariables> & ({ variables: VerifyPasswordResetTokenQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<VerifyPasswordResetTokenQuery, VerifyPasswordResetTokenQueryVariables>(VerifyPasswordResetTokenDocument, options);
      }
export function useVerifyPasswordResetTokenLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<VerifyPasswordResetTokenQuery, VerifyPasswordResetTokenQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<VerifyPasswordResetTokenQuery, VerifyPasswordResetTokenQueryVariables>(VerifyPasswordResetTokenDocument, options);
        }
// @ts-ignore
export function useVerifyPasswordResetTokenSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<VerifyPasswordResetTokenQuery, VerifyPasswordResetTokenQueryVariables>): Apollo.UseSuspenseQueryResult<VerifyPasswordResetTokenQuery, VerifyPasswordResetTokenQueryVariables>;
export function useVerifyPasswordResetTokenSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<VerifyPasswordResetTokenQuery, VerifyPasswordResetTokenQueryVariables>): Apollo.UseSuspenseQueryResult<VerifyPasswordResetTokenQuery | undefined, VerifyPasswordResetTokenQueryVariables>;
export function useVerifyPasswordResetTokenSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<VerifyPasswordResetTokenQuery, VerifyPasswordResetTokenQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<VerifyPasswordResetTokenQuery, VerifyPasswordResetTokenQueryVariables>(VerifyPasswordResetTokenDocument, options);
        }
export type VerifyPasswordResetTokenQueryHookResult = ReturnType<typeof useVerifyPasswordResetTokenQuery>;
export type VerifyPasswordResetTokenLazyQueryHookResult = ReturnType<typeof useVerifyPasswordResetTokenLazyQuery>;
export type VerifyPasswordResetTokenSuspenseQueryHookResult = ReturnType<typeof useVerifyPasswordResetTokenSuspenseQuery>;
export type VerifyPasswordResetTokenQueryResult = Apollo.QueryResult<VerifyPasswordResetTokenQuery, VerifyPasswordResetTokenQueryVariables>;
export const ChatsDocument = gql`
    query chats($filter: ChatFilterInput, $cursorId: String, $cursorCreatedAt: DateTime, $cursorDateParam: DateTime, $take: Int) {
  chats(
    filter: $filter
    cursorId: $cursorId
    cursorCreatedAt: $cursorCreatedAt
    cursorDateParam: $cursorDateParam
    take: $take
  ) {
    items {
      ...chatsFragment
    }
    nextCursorId
    nextCursorCreatedAt
    nextCursorDateParam
    hasMore
  }
}
    ${ChatsFragmentFragmentDoc}`;

/**
 * __useChatsQuery__
 *
 * To run a query within a React component, call `useChatsQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *      cursorId: // value for 'cursorId'
 *      cursorCreatedAt: // value for 'cursorCreatedAt'
 *      cursorDateParam: // value for 'cursorDateParam'
 *      take: // value for 'take'
 *   },
 * });
 */
export function useChatsQuery(baseOptions?: Apollo.QueryHookOptions<ChatsQuery, ChatsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatsQuery, ChatsQueryVariables>(ChatsDocument, options);
      }
export function useChatsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatsQuery, ChatsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatsQuery, ChatsQueryVariables>(ChatsDocument, options);
        }
// @ts-ignore
export function useChatsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatsQuery, ChatsQueryVariables>): Apollo.UseSuspenseQueryResult<ChatsQuery, ChatsQueryVariables>;
export function useChatsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatsQuery, ChatsQueryVariables>): Apollo.UseSuspenseQueryResult<ChatsQuery | undefined, ChatsQueryVariables>;
export function useChatsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatsQuery, ChatsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatsQuery, ChatsQueryVariables>(ChatsDocument, options);
        }
export type ChatsQueryHookResult = ReturnType<typeof useChatsQuery>;
export type ChatsLazyQueryHookResult = ReturnType<typeof useChatsLazyQuery>;
export type ChatsSuspenseQueryHookResult = ReturnType<typeof useChatsSuspenseQuery>;
export type ChatsQueryResult = Apollo.QueryResult<ChatsQuery, ChatsQueryVariables>;
export const ChatHistoryDocument = gql`
    query chatHistory($id: String!) {
  chatHistory(id: $id) {
    ...chatFragment
  }
}
    ${ChatFragmentFragmentDoc}`;

/**
 * __useChatHistoryQuery__
 *
 * To run a query within a React component, call `useChatHistoryQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatHistoryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatHistoryQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useChatHistoryQuery(baseOptions: Apollo.QueryHookOptions<ChatHistoryQuery, ChatHistoryQueryVariables> & ({ variables: ChatHistoryQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatHistoryQuery, ChatHistoryQueryVariables>(ChatHistoryDocument, options);
      }
export function useChatHistoryLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatHistoryQuery, ChatHistoryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatHistoryQuery, ChatHistoryQueryVariables>(ChatHistoryDocument, options);
        }
// @ts-ignore
export function useChatHistorySuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatHistoryQuery, ChatHistoryQueryVariables>): Apollo.UseSuspenseQueryResult<ChatHistoryQuery, ChatHistoryQueryVariables>;
export function useChatHistorySuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatHistoryQuery, ChatHistoryQueryVariables>): Apollo.UseSuspenseQueryResult<ChatHistoryQuery | undefined, ChatHistoryQueryVariables>;
export function useChatHistorySuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatHistoryQuery, ChatHistoryQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatHistoryQuery, ChatHistoryQueryVariables>(ChatHistoryDocument, options);
        }
export type ChatHistoryQueryHookResult = ReturnType<typeof useChatHistoryQuery>;
export type ChatHistoryLazyQueryHookResult = ReturnType<typeof useChatHistoryLazyQuery>;
export type ChatHistorySuspenseQueryHookResult = ReturnType<typeof useChatHistorySuspenseQuery>;
export type ChatHistoryQueryResult = Apollo.QueryResult<ChatHistoryQuery, ChatHistoryQueryVariables>;
export const ChatDataDocument = gql`
    query chatData($chatId: String!, $take: Int, $cursorId: String, $cursorCreatedAt: DateTime, $cursorDirection: CursorDirection) {
  chatData(
    chatId: $chatId
    take: $take
    cursorId: $cursorId
    cursorCreatedAt: $cursorCreatedAt
    cursorDirection: $cursorDirection
  ) {
    items {
      ...chatItemFragment
    }
    nextCursorId
    nextCursorCreatedAt
    hasMore
  }
}
    ${ChatItemFragmentFragmentDoc}`;

/**
 * __useChatDataQuery__
 *
 * To run a query within a React component, call `useChatDataQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatDataQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatDataQuery({
 *   variables: {
 *      chatId: // value for 'chatId'
 *      take: // value for 'take'
 *      cursorId: // value for 'cursorId'
 *      cursorCreatedAt: // value for 'cursorCreatedAt'
 *      cursorDirection: // value for 'cursorDirection'
 *   },
 * });
 */
export function useChatDataQuery(baseOptions: Apollo.QueryHookOptions<ChatDataQuery, ChatDataQueryVariables> & ({ variables: ChatDataQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatDataQuery, ChatDataQueryVariables>(ChatDataDocument, options);
      }
export function useChatDataLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatDataQuery, ChatDataQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatDataQuery, ChatDataQueryVariables>(ChatDataDocument, options);
        }
// @ts-ignore
export function useChatDataSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatDataQuery, ChatDataQueryVariables>): Apollo.UseSuspenseQueryResult<ChatDataQuery, ChatDataQueryVariables>;
export function useChatDataSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatDataQuery, ChatDataQueryVariables>): Apollo.UseSuspenseQueryResult<ChatDataQuery | undefined, ChatDataQueryVariables>;
export function useChatDataSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatDataQuery, ChatDataQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatDataQuery, ChatDataQueryVariables>(ChatDataDocument, options);
        }
export type ChatDataQueryHookResult = ReturnType<typeof useChatDataQuery>;
export type ChatDataLazyQueryHookResult = ReturnType<typeof useChatDataLazyQuery>;
export type ChatDataSuspenseQueryHookResult = ReturnType<typeof useChatDataSuspenseQuery>;
export type ChatDataQueryResult = Apollo.QueryResult<ChatDataQuery, ChatDataQueryVariables>;
export const ChatCountDocument = gql`
    query chatCount {
  chatCount
}
    `;

/**
 * __useChatCountQuery__
 *
 * To run a query within a React component, call `useChatCountQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatCountQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatCountQuery({
 *   variables: {
 *   },
 * });
 */
export function useChatCountQuery(baseOptions?: Apollo.QueryHookOptions<ChatCountQuery, ChatCountQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatCountQuery, ChatCountQueryVariables>(ChatCountDocument, options);
      }
export function useChatCountLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatCountQuery, ChatCountQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatCountQuery, ChatCountQueryVariables>(ChatCountDocument, options);
        }
// @ts-ignore
export function useChatCountSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatCountQuery, ChatCountQueryVariables>): Apollo.UseSuspenseQueryResult<ChatCountQuery, ChatCountQueryVariables>;
export function useChatCountSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatCountQuery, ChatCountQueryVariables>): Apollo.UseSuspenseQueryResult<ChatCountQuery | undefined, ChatCountQueryVariables>;
export function useChatCountSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatCountQuery, ChatCountQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatCountQuery, ChatCountQueryVariables>(ChatCountDocument, options);
        }
export type ChatCountQueryHookResult = ReturnType<typeof useChatCountQuery>;
export type ChatCountLazyQueryHookResult = ReturnType<typeof useChatCountLazyQuery>;
export type ChatCountSuspenseQueryHookResult = ReturnType<typeof useChatCountSuspenseQuery>;
export type ChatCountQueryResult = Apollo.QueryResult<ChatCountQuery, ChatCountQueryVariables>;
export const UnassignedChatCountDocument = gql`
    query unassignedChatCount {
  unassignedChatCount
}
    `;

/**
 * __useUnassignedChatCountQuery__
 *
 * To run a query within a React component, call `useUnassignedChatCountQuery` and pass it any options that fit your needs.
 * When your component renders, `useUnassignedChatCountQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useUnassignedChatCountQuery({
 *   variables: {
 *   },
 * });
 */
export function useUnassignedChatCountQuery(baseOptions?: Apollo.QueryHookOptions<UnassignedChatCountQuery, UnassignedChatCountQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<UnassignedChatCountQuery, UnassignedChatCountQueryVariables>(UnassignedChatCountDocument, options);
      }
export function useUnassignedChatCountLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<UnassignedChatCountQuery, UnassignedChatCountQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<UnassignedChatCountQuery, UnassignedChatCountQueryVariables>(UnassignedChatCountDocument, options);
        }
// @ts-ignore
export function useUnassignedChatCountSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<UnassignedChatCountQuery, UnassignedChatCountQueryVariables>): Apollo.UseSuspenseQueryResult<UnassignedChatCountQuery, UnassignedChatCountQueryVariables>;
export function useUnassignedChatCountSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<UnassignedChatCountQuery, UnassignedChatCountQueryVariables>): Apollo.UseSuspenseQueryResult<UnassignedChatCountQuery | undefined, UnassignedChatCountQueryVariables>;
export function useUnassignedChatCountSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<UnassignedChatCountQuery, UnassignedChatCountQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<UnassignedChatCountQuery, UnassignedChatCountQueryVariables>(UnassignedChatCountDocument, options);
        }
export type UnassignedChatCountQueryHookResult = ReturnType<typeof useUnassignedChatCountQuery>;
export type UnassignedChatCountLazyQueryHookResult = ReturnType<typeof useUnassignedChatCountLazyQuery>;
export type UnassignedChatCountSuspenseQueryHookResult = ReturnType<typeof useUnassignedChatCountSuspenseQuery>;
export type UnassignedChatCountQueryResult = Apollo.QueryResult<UnassignedChatCountQuery, UnassignedChatCountQueryVariables>;
export const ChangeChatStatusDocument = gql`
    mutation changeChatStatus($chatStatusInput: ChatStatusInput!) {
  changeChatStatus(chatStatusInput: $chatStatusInput) {
    ...chatActivityFragment
  }
}
    ${ChatActivityFragmentFragmentDoc}`;
export type ChangeChatStatusMutationFn = Apollo.MutationFunction<ChangeChatStatusMutation, ChangeChatStatusMutationVariables>;

/**
 * __useChangeChatStatusMutation__
 *
 * To run a mutation, you first call `useChangeChatStatusMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useChangeChatStatusMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [changeChatStatusMutation, { data, loading, error }] = useChangeChatStatusMutation({
 *   variables: {
 *      chatStatusInput: // value for 'chatStatusInput'
 *   },
 * });
 */
export function useChangeChatStatusMutation(baseOptions?: Apollo.MutationHookOptions<ChangeChatStatusMutation, ChangeChatStatusMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ChangeChatStatusMutation, ChangeChatStatusMutationVariables>(ChangeChatStatusDocument, options);
      }
export type ChangeChatStatusMutationHookResult = ReturnType<typeof useChangeChatStatusMutation>;
export type ChangeChatStatusMutationResult = Apollo.MutationResult<ChangeChatStatusMutation>;
export type ChangeChatStatusMutationOptions = Apollo.BaseMutationOptions<ChangeChatStatusMutation, ChangeChatStatusMutationVariables>;
export const SendMessageDocument = gql`
    mutation sendMessage($chatMessageInput: ChatMessageInput!) {
  sendMessage(chatMessageInput: $chatMessageInput) {
    ...chatMessageFragment
  }
}
    ${ChatMessageFragmentFragmentDoc}`;
export type SendMessageMutationFn = Apollo.MutationFunction<SendMessageMutation, SendMessageMutationVariables>;

/**
 * __useSendMessageMutation__
 *
 * To run a mutation, you first call `useSendMessageMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSendMessageMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [sendMessageMutation, { data, loading, error }] = useSendMessageMutation({
 *   variables: {
 *      chatMessageInput: // value for 'chatMessageInput'
 *   },
 * });
 */
export function useSendMessageMutation(baseOptions?: Apollo.MutationHookOptions<SendMessageMutation, SendMessageMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SendMessageMutation, SendMessageMutationVariables>(SendMessageDocument, options);
      }
export type SendMessageMutationHookResult = ReturnType<typeof useSendMessageMutation>;
export type SendMessageMutationResult = Apollo.MutationResult<SendMessageMutation>;
export type SendMessageMutationOptions = Apollo.BaseMutationOptions<SendMessageMutation, SendMessageMutationVariables>;
export const SendUploadLinkDocument = gql`
    mutation sendUploadLink($input: ShareUploadLinkInput!) {
  sendUploadLink(input: $input) {
    ...chatMessageFragment
  }
}
    ${ChatMessageFragmentFragmentDoc}`;
export type SendUploadLinkMutationFn = Apollo.MutationFunction<SendUploadLinkMutation, SendUploadLinkMutationVariables>;

/**
 * __useSendUploadLinkMutation__
 *
 * To run a mutation, you first call `useSendUploadLinkMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSendUploadLinkMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [sendUploadLinkMutation, { data, loading, error }] = useSendUploadLinkMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useSendUploadLinkMutation(baseOptions?: Apollo.MutationHookOptions<SendUploadLinkMutation, SendUploadLinkMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SendUploadLinkMutation, SendUploadLinkMutationVariables>(SendUploadLinkDocument, options);
      }
export type SendUploadLinkMutationHookResult = ReturnType<typeof useSendUploadLinkMutation>;
export type SendUploadLinkMutationResult = Apollo.MutationResult<SendUploadLinkMutation>;
export type SendUploadLinkMutationOptions = Apollo.BaseMutationOptions<SendUploadLinkMutation, SendUploadLinkMutationVariables>;
export const SendFileUploadedMessageDocument = gql`
    mutation sendFileUploadedMessage($input: SendFileUploadedMessageInput!) {
  sendFileUploadedMessage(input: $input) {
    ...chatMessageFragment
  }
}
    ${ChatMessageFragmentFragmentDoc}`;
export type SendFileUploadedMessageMutationFn = Apollo.MutationFunction<SendFileUploadedMessageMutation, SendFileUploadedMessageMutationVariables>;

/**
 * __useSendFileUploadedMessageMutation__
 *
 * To run a mutation, you first call `useSendFileUploadedMessageMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSendFileUploadedMessageMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [sendFileUploadedMessageMutation, { data, loading, error }] = useSendFileUploadedMessageMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useSendFileUploadedMessageMutation(baseOptions?: Apollo.MutationHookOptions<SendFileUploadedMessageMutation, SendFileUploadedMessageMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SendFileUploadedMessageMutation, SendFileUploadedMessageMutationVariables>(SendFileUploadedMessageDocument, options);
      }
export type SendFileUploadedMessageMutationHookResult = ReturnType<typeof useSendFileUploadedMessageMutation>;
export type SendFileUploadedMessageMutationResult = Apollo.MutationResult<SendFileUploadedMessageMutation>;
export type SendFileUploadedMessageMutationOptions = Apollo.BaseMutationOptions<SendFileUploadedMessageMutation, SendFileUploadedMessageMutationVariables>;
export const SendMessageToLiglaDocument = gql`
    mutation sendMessageToLigla($chatId: String!, $messageId: String!) {
  sendMessageToLigla(chatId: $chatId, messageId: $messageId) {
    isDelivered
  }
}
    `;
export type SendMessageToLiglaMutationFn = Apollo.MutationFunction<SendMessageToLiglaMutation, SendMessageToLiglaMutationVariables>;

/**
 * __useSendMessageToLiglaMutation__
 *
 * To run a mutation, you first call `useSendMessageToLiglaMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSendMessageToLiglaMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [sendMessageToLiglaMutation, { data, loading, error }] = useSendMessageToLiglaMutation({
 *   variables: {
 *      chatId: // value for 'chatId'
 *      messageId: // value for 'messageId'
 *   },
 * });
 */
export function useSendMessageToLiglaMutation(baseOptions?: Apollo.MutationHookOptions<SendMessageToLiglaMutation, SendMessageToLiglaMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SendMessageToLiglaMutation, SendMessageToLiglaMutationVariables>(SendMessageToLiglaDocument, options);
      }
export type SendMessageToLiglaMutationHookResult = ReturnType<typeof useSendMessageToLiglaMutation>;
export type SendMessageToLiglaMutationResult = Apollo.MutationResult<SendMessageToLiglaMutation>;
export type SendMessageToLiglaMutationOptions = Apollo.BaseMutationOptions<SendMessageToLiglaMutation, SendMessageToLiglaMutationVariables>;
export const RetrySendMessageDocument = gql`
    mutation retrySendMessage($retryMessageInput: RetryMessageInput!) {
  retrySendMessage(retryMessageInput: $retryMessageInput) {
    ...chatMessageFragment
  }
}
    ${ChatMessageFragmentFragmentDoc}`;
export type RetrySendMessageMutationFn = Apollo.MutationFunction<RetrySendMessageMutation, RetrySendMessageMutationVariables>;

/**
 * __useRetrySendMessageMutation__
 *
 * To run a mutation, you first call `useRetrySendMessageMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRetrySendMessageMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [retrySendMessageMutation, { data, loading, error }] = useRetrySendMessageMutation({
 *   variables: {
 *      retryMessageInput: // value for 'retryMessageInput'
 *   },
 * });
 */
export function useRetrySendMessageMutation(baseOptions?: Apollo.MutationHookOptions<RetrySendMessageMutation, RetrySendMessageMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RetrySendMessageMutation, RetrySendMessageMutationVariables>(RetrySendMessageDocument, options);
      }
export type RetrySendMessageMutationHookResult = ReturnType<typeof useRetrySendMessageMutation>;
export type RetrySendMessageMutationResult = Apollo.MutationResult<RetrySendMessageMutation>;
export type RetrySendMessageMutationOptions = Apollo.BaseMutationOptions<RetrySendMessageMutation, RetrySendMessageMutationVariables>;
export const DeleteChatMessageDocument = gql`
    mutation deleteChatMessage($deleteMessageInput: DeleteMessageInput!) {
  deleteChatMessage(deleteMessageInput: $deleteMessageInput)
}
    `;
export type DeleteChatMessageMutationFn = Apollo.MutationFunction<DeleteChatMessageMutation, DeleteChatMessageMutationVariables>;

/**
 * __useDeleteChatMessageMutation__
 *
 * To run a mutation, you first call `useDeleteChatMessageMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteChatMessageMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteChatMessageMutation, { data, loading, error }] = useDeleteChatMessageMutation({
 *   variables: {
 *      deleteMessageInput: // value for 'deleteMessageInput'
 *   },
 * });
 */
export function useDeleteChatMessageMutation(baseOptions?: Apollo.MutationHookOptions<DeleteChatMessageMutation, DeleteChatMessageMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteChatMessageMutation, DeleteChatMessageMutationVariables>(DeleteChatMessageDocument, options);
      }
export type DeleteChatMessageMutationHookResult = ReturnType<typeof useDeleteChatMessageMutation>;
export type DeleteChatMessageMutationResult = Apollo.MutationResult<DeleteChatMessageMutation>;
export type DeleteChatMessageMutationOptions = Apollo.BaseMutationOptions<DeleteChatMessageMutation, DeleteChatMessageMutationVariables>;
export const AssignOperatorToChatDocument = gql`
    mutation assignOperatorToChat($chatAssignInput: ChatAssignInput!) {
  assignOperatorToChat(chatAssignInput: $chatAssignInput) {
    ...chatActivityFragment
  }
}
    ${ChatActivityFragmentFragmentDoc}`;
export type AssignOperatorToChatMutationFn = Apollo.MutationFunction<AssignOperatorToChatMutation, AssignOperatorToChatMutationVariables>;

/**
 * __useAssignOperatorToChatMutation__
 *
 * To run a mutation, you first call `useAssignOperatorToChatMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAssignOperatorToChatMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [assignOperatorToChatMutation, { data, loading, error }] = useAssignOperatorToChatMutation({
 *   variables: {
 *      chatAssignInput: // value for 'chatAssignInput'
 *   },
 * });
 */
export function useAssignOperatorToChatMutation(baseOptions?: Apollo.MutationHookOptions<AssignOperatorToChatMutation, AssignOperatorToChatMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AssignOperatorToChatMutation, AssignOperatorToChatMutationVariables>(AssignOperatorToChatDocument, options);
      }
export type AssignOperatorToChatMutationHookResult = ReturnType<typeof useAssignOperatorToChatMutation>;
export type AssignOperatorToChatMutationResult = Apollo.MutationResult<AssignOperatorToChatMutation>;
export type AssignOperatorToChatMutationOptions = Apollo.BaseMutationOptions<AssignOperatorToChatMutation, AssignOperatorToChatMutationVariables>;
export const AssignTeamToChatDocument = gql`
    mutation assignTeamToChat($chatTeamAssignInput: ChatTeamAssignInput!) {
  assignTeamToChat(chatTeamAssignInput: $chatTeamAssignInput) {
    ...chatActivityFragment
  }
}
    ${ChatActivityFragmentFragmentDoc}`;
export type AssignTeamToChatMutationFn = Apollo.MutationFunction<AssignTeamToChatMutation, AssignTeamToChatMutationVariables>;

/**
 * __useAssignTeamToChatMutation__
 *
 * To run a mutation, you first call `useAssignTeamToChatMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAssignTeamToChatMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [assignTeamToChatMutation, { data, loading, error }] = useAssignTeamToChatMutation({
 *   variables: {
 *      chatTeamAssignInput: // value for 'chatTeamAssignInput'
 *   },
 * });
 */
export function useAssignTeamToChatMutation(baseOptions?: Apollo.MutationHookOptions<AssignTeamToChatMutation, AssignTeamToChatMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AssignTeamToChatMutation, AssignTeamToChatMutationVariables>(AssignTeamToChatDocument, options);
      }
export type AssignTeamToChatMutationHookResult = ReturnType<typeof useAssignTeamToChatMutation>;
export type AssignTeamToChatMutationResult = Apollo.MutationResult<AssignTeamToChatMutation>;
export type AssignTeamToChatMutationOptions = Apollo.BaseMutationOptions<AssignTeamToChatMutation, AssignTeamToChatMutationVariables>;
export const RemoveTeamFromChatDocument = gql`
    mutation removeTeamFromChat($chatTeamAssignInput: ChatTeamAssignInput!) {
  removeTeamFromChat(chatTeamAssignInput: $chatTeamAssignInput) {
    ...chatActivityFragment
  }
}
    ${ChatActivityFragmentFragmentDoc}`;
export type RemoveTeamFromChatMutationFn = Apollo.MutationFunction<RemoveTeamFromChatMutation, RemoveTeamFromChatMutationVariables>;

/**
 * __useRemoveTeamFromChatMutation__
 *
 * To run a mutation, you first call `useRemoveTeamFromChatMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRemoveTeamFromChatMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [removeTeamFromChatMutation, { data, loading, error }] = useRemoveTeamFromChatMutation({
 *   variables: {
 *      chatTeamAssignInput: // value for 'chatTeamAssignInput'
 *   },
 * });
 */
export function useRemoveTeamFromChatMutation(baseOptions?: Apollo.MutationHookOptions<RemoveTeamFromChatMutation, RemoveTeamFromChatMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RemoveTeamFromChatMutation, RemoveTeamFromChatMutationVariables>(RemoveTeamFromChatDocument, options);
      }
export type RemoveTeamFromChatMutationHookResult = ReturnType<typeof useRemoveTeamFromChatMutation>;
export type RemoveTeamFromChatMutationResult = Apollo.MutationResult<RemoveTeamFromChatMutation>;
export type RemoveTeamFromChatMutationOptions = Apollo.BaseMutationOptions<RemoveTeamFromChatMutation, RemoveTeamFromChatMutationVariables>;
export const RemoveChatTagDocument = gql`
    mutation removeChatTag($chatTagInput: ChatTagInput!) {
  removeChatTag(chatTagInput: $chatTagInput) {
    ...chatFragment
  }
}
    ${ChatFragmentFragmentDoc}`;
export type RemoveChatTagMutationFn = Apollo.MutationFunction<RemoveChatTagMutation, RemoveChatTagMutationVariables>;

/**
 * __useRemoveChatTagMutation__
 *
 * To run a mutation, you first call `useRemoveChatTagMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRemoveChatTagMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [removeChatTagMutation, { data, loading, error }] = useRemoveChatTagMutation({
 *   variables: {
 *      chatTagInput: // value for 'chatTagInput'
 *   },
 * });
 */
export function useRemoveChatTagMutation(baseOptions?: Apollo.MutationHookOptions<RemoveChatTagMutation, RemoveChatTagMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RemoveChatTagMutation, RemoveChatTagMutationVariables>(RemoveChatTagDocument, options);
      }
export type RemoveChatTagMutationHookResult = ReturnType<typeof useRemoveChatTagMutation>;
export type RemoveChatTagMutationResult = Apollo.MutationResult<RemoveChatTagMutation>;
export type RemoveChatTagMutationOptions = Apollo.BaseMutationOptions<RemoveChatTagMutation, RemoveChatTagMutationVariables>;
export const UpdateChatTagsDocument = gql`
    mutation updateChatTags($updateChatTagsInput: UpdateChatTagsInput!) {
  updateChatTags(updateChatTagsInput: $updateChatTagsInput) {
    ...chatFragment
  }
}
    ${ChatFragmentFragmentDoc}`;
export type UpdateChatTagsMutationFn = Apollo.MutationFunction<UpdateChatTagsMutation, UpdateChatTagsMutationVariables>;

/**
 * __useUpdateChatTagsMutation__
 *
 * To run a mutation, you first call `useUpdateChatTagsMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateChatTagsMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateChatTagsMutation, { data, loading, error }] = useUpdateChatTagsMutation({
 *   variables: {
 *      updateChatTagsInput: // value for 'updateChatTagsInput'
 *   },
 * });
 */
export function useUpdateChatTagsMutation(baseOptions?: Apollo.MutationHookOptions<UpdateChatTagsMutation, UpdateChatTagsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateChatTagsMutation, UpdateChatTagsMutationVariables>(UpdateChatTagsDocument, options);
      }
export type UpdateChatTagsMutationHookResult = ReturnType<typeof useUpdateChatTagsMutation>;
export type UpdateChatTagsMutationResult = Apollo.MutationResult<UpdateChatTagsMutation>;
export type UpdateChatTagsMutationOptions = Apollo.BaseMutationOptions<UpdateChatTagsMutation, UpdateChatTagsMutationVariables>;
export const UpdateChatLatestReadDocument = gql`
    mutation updateChatLatestRead($chatLatestReadInput: ChatLatestReadInput!) {
  updateChatLatestRead(chatLatestReadInput: $chatLatestReadInput) {
    ...chatFragment
  }
}
    ${ChatFragmentFragmentDoc}`;
export type UpdateChatLatestReadMutationFn = Apollo.MutationFunction<UpdateChatLatestReadMutation, UpdateChatLatestReadMutationVariables>;

/**
 * __useUpdateChatLatestReadMutation__
 *
 * To run a mutation, you first call `useUpdateChatLatestReadMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateChatLatestReadMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateChatLatestReadMutation, { data, loading, error }] = useUpdateChatLatestReadMutation({
 *   variables: {
 *      chatLatestReadInput: // value for 'chatLatestReadInput'
 *   },
 * });
 */
export function useUpdateChatLatestReadMutation(baseOptions?: Apollo.MutationHookOptions<UpdateChatLatestReadMutation, UpdateChatLatestReadMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateChatLatestReadMutation, UpdateChatLatestReadMutationVariables>(UpdateChatLatestReadDocument, options);
      }
export type UpdateChatLatestReadMutationHookResult = ReturnType<typeof useUpdateChatLatestReadMutation>;
export type UpdateChatLatestReadMutationResult = Apollo.MutationResult<UpdateChatLatestReadMutation>;
export type UpdateChatLatestReadMutationOptions = Apollo.BaseMutationOptions<UpdateChatLatestReadMutation, UpdateChatLatestReadMutationVariables>;
export const UploadChatFileDocument = gql`
    mutation UploadChatFile($input: UploadChatFileInput!) {
  uploadChatFile(input: $input) {
    signedUrl
    chatFile {
      id
    }
  }
}
    `;
export type UploadChatFileMutationFn = Apollo.MutationFunction<UploadChatFileMutation, UploadChatFileMutationVariables>;

/**
 * __useUploadChatFileMutation__
 *
 * To run a mutation, you first call `useUploadChatFileMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUploadChatFileMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [uploadChatFileMutation, { data, loading, error }] = useUploadChatFileMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUploadChatFileMutation(baseOptions?: Apollo.MutationHookOptions<UploadChatFileMutation, UploadChatFileMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UploadChatFileMutation, UploadChatFileMutationVariables>(UploadChatFileDocument, options);
      }
export type UploadChatFileMutationHookResult = ReturnType<typeof useUploadChatFileMutation>;
export type UploadChatFileMutationResult = Apollo.MutationResult<UploadChatFileMutation>;
export type UploadChatFileMutationOptions = Apollo.BaseMutationOptions<UploadChatFileMutation, UploadChatFileMutationVariables>;
export const ConfirmChatFileUploadDocument = gql`
    mutation ConfirmChatFileUpload($input: ConfirmChatFileUploadInput!) {
  confirmChatFileUpload(input: $input) {
    success
    chatFile {
      id
      fileName
    }
  }
}
    `;
export type ConfirmChatFileUploadMutationFn = Apollo.MutationFunction<ConfirmChatFileUploadMutation, ConfirmChatFileUploadMutationVariables>;

/**
 * __useConfirmChatFileUploadMutation__
 *
 * To run a mutation, you first call `useConfirmChatFileUploadMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useConfirmChatFileUploadMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [confirmChatFileUploadMutation, { data, loading, error }] = useConfirmChatFileUploadMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useConfirmChatFileUploadMutation(baseOptions?: Apollo.MutationHookOptions<ConfirmChatFileUploadMutation, ConfirmChatFileUploadMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ConfirmChatFileUploadMutation, ConfirmChatFileUploadMutationVariables>(ConfirmChatFileUploadDocument, options);
      }
export type ConfirmChatFileUploadMutationHookResult = ReturnType<typeof useConfirmChatFileUploadMutation>;
export type ConfirmChatFileUploadMutationResult = Apollo.MutationResult<ConfirmChatFileUploadMutation>;
export type ConfirmChatFileUploadMutationOptions = Apollo.BaseMutationOptions<ConfirmChatFileUploadMutation, ConfirmChatFileUploadMutationVariables>;
export const DeleteChatFileDocument = gql`
    mutation DeleteChatFile($input: DeleteChatFileInput!) {
  deleteChatFile(input: $input) {
    success
  }
}
    `;
export type DeleteChatFileMutationFn = Apollo.MutationFunction<DeleteChatFileMutation, DeleteChatFileMutationVariables>;

/**
 * __useDeleteChatFileMutation__
 *
 * To run a mutation, you first call `useDeleteChatFileMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteChatFileMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteChatFileMutation, { data, loading, error }] = useDeleteChatFileMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useDeleteChatFileMutation(baseOptions?: Apollo.MutationHookOptions<DeleteChatFileMutation, DeleteChatFileMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteChatFileMutation, DeleteChatFileMutationVariables>(DeleteChatFileDocument, options);
      }
export type DeleteChatFileMutationHookResult = ReturnType<typeof useDeleteChatFileMutation>;
export type DeleteChatFileMutationResult = Apollo.MutationResult<DeleteChatFileMutation>;
export type DeleteChatFileMutationOptions = Apollo.BaseMutationOptions<DeleteChatFileMutation, DeleteChatFileMutationVariables>;
export const ChatFilesDocument = gql`
    query chatFiles($chatId: String!, $endUserId: String!, $take: Int, $cursorId: String, $cursorCreatedAt: DateTime) {
  chatFiles(
    chatId: $chatId
    endUserId: $endUserId
    take: $take
    cursorId: $cursorId
    cursorCreatedAt: $cursorCreatedAt
  ) {
    items {
      ...chatFileListItemFragment
    }
    nextCursorId
    nextCursorCreatedAt
    hasMore
    totalCount
  }
}
    ${ChatFileListItemFragmentFragmentDoc}`;

/**
 * __useChatFilesQuery__
 *
 * To run a query within a React component, call `useChatFilesQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatFilesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatFilesQuery({
 *   variables: {
 *      chatId: // value for 'chatId'
 *      endUserId: // value for 'endUserId'
 *      take: // value for 'take'
 *      cursorId: // value for 'cursorId'
 *      cursorCreatedAt: // value for 'cursorCreatedAt'
 *   },
 * });
 */
export function useChatFilesQuery(baseOptions: Apollo.QueryHookOptions<ChatFilesQuery, ChatFilesQueryVariables> & ({ variables: ChatFilesQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatFilesQuery, ChatFilesQueryVariables>(ChatFilesDocument, options);
      }
export function useChatFilesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatFilesQuery, ChatFilesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatFilesQuery, ChatFilesQueryVariables>(ChatFilesDocument, options);
        }
// @ts-ignore
export function useChatFilesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatFilesQuery, ChatFilesQueryVariables>): Apollo.UseSuspenseQueryResult<ChatFilesQuery, ChatFilesQueryVariables>;
export function useChatFilesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatFilesQuery, ChatFilesQueryVariables>): Apollo.UseSuspenseQueryResult<ChatFilesQuery | undefined, ChatFilesQueryVariables>;
export function useChatFilesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatFilesQuery, ChatFilesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatFilesQuery, ChatFilesQueryVariables>(ChatFilesDocument, options);
        }
export type ChatFilesQueryHookResult = ReturnType<typeof useChatFilesQuery>;
export type ChatFilesLazyQueryHookResult = ReturnType<typeof useChatFilesLazyQuery>;
export type ChatFilesSuspenseQueryHookResult = ReturnType<typeof useChatFilesSuspenseQuery>;
export type ChatFilesQueryResult = Apollo.QueryResult<ChatFilesQuery, ChatFilesQueryVariables>;
export const NotesDocument = gql`
    query notes($chatId: String!) {
  notes(chatId: $chatId) {
    ...noteFragment
  }
}
    ${NoteFragmentFragmentDoc}`;

/**
 * __useNotesQuery__
 *
 * To run a query within a React component, call `useNotesQuery` and pass it any options that fit your needs.
 * When your component renders, `useNotesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useNotesQuery({
 *   variables: {
 *      chatId: // value for 'chatId'
 *   },
 * });
 */
export function useNotesQuery(baseOptions: Apollo.QueryHookOptions<NotesQuery, NotesQueryVariables> & ({ variables: NotesQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<NotesQuery, NotesQueryVariables>(NotesDocument, options);
      }
export function useNotesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<NotesQuery, NotesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<NotesQuery, NotesQueryVariables>(NotesDocument, options);
        }
// @ts-ignore
export function useNotesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<NotesQuery, NotesQueryVariables>): Apollo.UseSuspenseQueryResult<NotesQuery, NotesQueryVariables>;
export function useNotesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<NotesQuery, NotesQueryVariables>): Apollo.UseSuspenseQueryResult<NotesQuery | undefined, NotesQueryVariables>;
export function useNotesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<NotesQuery, NotesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<NotesQuery, NotesQueryVariables>(NotesDocument, options);
        }
export type NotesQueryHookResult = ReturnType<typeof useNotesQuery>;
export type NotesLazyQueryHookResult = ReturnType<typeof useNotesLazyQuery>;
export type NotesSuspenseQueryHookResult = ReturnType<typeof useNotesSuspenseQuery>;
export type NotesQueryResult = Apollo.QueryResult<NotesQuery, NotesQueryVariables>;
export const CreateNoteDocument = gql`
    mutation createNote($createNoteInput: CreateChatNoteInput!) {
  createNote(createNoteInput: $createNoteInput) {
    ...noteFragment
  }
}
    ${NoteFragmentFragmentDoc}`;
export type CreateNoteMutationFn = Apollo.MutationFunction<CreateNoteMutation, CreateNoteMutationVariables>;

/**
 * __useCreateNoteMutation__
 *
 * To run a mutation, you first call `useCreateNoteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateNoteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createNoteMutation, { data, loading, error }] = useCreateNoteMutation({
 *   variables: {
 *      createNoteInput: // value for 'createNoteInput'
 *   },
 * });
 */
export function useCreateNoteMutation(baseOptions?: Apollo.MutationHookOptions<CreateNoteMutation, CreateNoteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateNoteMutation, CreateNoteMutationVariables>(CreateNoteDocument, options);
      }
export type CreateNoteMutationHookResult = ReturnType<typeof useCreateNoteMutation>;
export type CreateNoteMutationResult = Apollo.MutationResult<CreateNoteMutation>;
export type CreateNoteMutationOptions = Apollo.BaseMutationOptions<CreateNoteMutation, CreateNoteMutationVariables>;
export const UpdateNoteDocument = gql`
    mutation updateNote($updateNoteInput: UpdateChatNoteInput!) {
  updateNote(updateNoteInput: $updateNoteInput) {
    ...noteFragment
  }
}
    ${NoteFragmentFragmentDoc}`;
export type UpdateNoteMutationFn = Apollo.MutationFunction<UpdateNoteMutation, UpdateNoteMutationVariables>;

/**
 * __useUpdateNoteMutation__
 *
 * To run a mutation, you first call `useUpdateNoteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateNoteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateNoteMutation, { data, loading, error }] = useUpdateNoteMutation({
 *   variables: {
 *      updateNoteInput: // value for 'updateNoteInput'
 *   },
 * });
 */
export function useUpdateNoteMutation(baseOptions?: Apollo.MutationHookOptions<UpdateNoteMutation, UpdateNoteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateNoteMutation, UpdateNoteMutationVariables>(UpdateNoteDocument, options);
      }
export type UpdateNoteMutationHookResult = ReturnType<typeof useUpdateNoteMutation>;
export type UpdateNoteMutationResult = Apollo.MutationResult<UpdateNoteMutation>;
export type UpdateNoteMutationOptions = Apollo.BaseMutationOptions<UpdateNoteMutation, UpdateNoteMutationVariables>;
export const RemoveNoteDocument = gql`
    mutation removeNote($id: String!, $chatId: String!) {
  removeNote(id: $id, chatId: $chatId) {
    ...noteFragment
  }
}
    ${NoteFragmentFragmentDoc}`;
export type RemoveNoteMutationFn = Apollo.MutationFunction<RemoveNoteMutation, RemoveNoteMutationVariables>;

/**
 * __useRemoveNoteMutation__
 *
 * To run a mutation, you first call `useRemoveNoteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRemoveNoteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [removeNoteMutation, { data, loading, error }] = useRemoveNoteMutation({
 *   variables: {
 *      id: // value for 'id'
 *      chatId: // value for 'chatId'
 *   },
 * });
 */
export function useRemoveNoteMutation(baseOptions?: Apollo.MutationHookOptions<RemoveNoteMutation, RemoveNoteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RemoveNoteMutation, RemoveNoteMutationVariables>(RemoveNoteDocument, options);
      }
export type RemoveNoteMutationHookResult = ReturnType<typeof useRemoveNoteMutation>;
export type RemoveNoteMutationResult = Apollo.MutationResult<RemoveNoteMutation>;
export type RemoveNoteMutationOptions = Apollo.BaseMutationOptions<RemoveNoteMutation, RemoveNoteMutationVariables>;
export const ChatReplySettingDocument = gql`
    query chatReplySetting($inputOrganizationId: String) {
  chatReplySetting(inputOrganizationId: $inputOrganizationId) {
    ...chatReplySetting
  }
}
    ${ChatReplySettingFragmentDoc}`;

/**
 * __useChatReplySettingQuery__
 *
 * To run a query within a React component, call `useChatReplySettingQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatReplySettingQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatReplySettingQuery({
 *   variables: {
 *      inputOrganizationId: // value for 'inputOrganizationId'
 *   },
 * });
 */
export function useChatReplySettingQuery(baseOptions?: Apollo.QueryHookOptions<ChatReplySettingQuery, ChatReplySettingQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatReplySettingQuery, ChatReplySettingQueryVariables>(ChatReplySettingDocument, options);
      }
export function useChatReplySettingLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatReplySettingQuery, ChatReplySettingQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatReplySettingQuery, ChatReplySettingQueryVariables>(ChatReplySettingDocument, options);
        }
// @ts-ignore
export function useChatReplySettingSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatReplySettingQuery, ChatReplySettingQueryVariables>): Apollo.UseSuspenseQueryResult<ChatReplySettingQuery, ChatReplySettingQueryVariables>;
export function useChatReplySettingSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatReplySettingQuery, ChatReplySettingQueryVariables>): Apollo.UseSuspenseQueryResult<ChatReplySettingQuery | undefined, ChatReplySettingQueryVariables>;
export function useChatReplySettingSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatReplySettingQuery, ChatReplySettingQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatReplySettingQuery, ChatReplySettingQueryVariables>(ChatReplySettingDocument, options);
        }
export type ChatReplySettingQueryHookResult = ReturnType<typeof useChatReplySettingQuery>;
export type ChatReplySettingLazyQueryHookResult = ReturnType<typeof useChatReplySettingLazyQuery>;
export type ChatReplySettingSuspenseQueryHookResult = ReturnType<typeof useChatReplySettingSuspenseQuery>;
export type ChatReplySettingQueryResult = Apollo.QueryResult<ChatReplySettingQuery, ChatReplySettingQueryVariables>;
export const CreateChatReplySettingDocument = gql`
    mutation createChatReplySetting($createChatReplySettingInput: CreateChatReplySettingInput!, $inputOrganizationId: String) {
  createChatReplySetting(
    createChatReplySettingInput: $createChatReplySettingInput
    inputOrganizationId: $inputOrganizationId
  ) {
    ...chatReplySetting
  }
}
    ${ChatReplySettingFragmentDoc}`;
export type CreateChatReplySettingMutationFn = Apollo.MutationFunction<CreateChatReplySettingMutation, CreateChatReplySettingMutationVariables>;

/**
 * __useCreateChatReplySettingMutation__
 *
 * To run a mutation, you first call `useCreateChatReplySettingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateChatReplySettingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createChatReplySettingMutation, { data, loading, error }] = useCreateChatReplySettingMutation({
 *   variables: {
 *      createChatReplySettingInput: // value for 'createChatReplySettingInput'
 *      inputOrganizationId: // value for 'inputOrganizationId'
 *   },
 * });
 */
export function useCreateChatReplySettingMutation(baseOptions?: Apollo.MutationHookOptions<CreateChatReplySettingMutation, CreateChatReplySettingMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateChatReplySettingMutation, CreateChatReplySettingMutationVariables>(CreateChatReplySettingDocument, options);
      }
export type CreateChatReplySettingMutationHookResult = ReturnType<typeof useCreateChatReplySettingMutation>;
export type CreateChatReplySettingMutationResult = Apollo.MutationResult<CreateChatReplySettingMutation>;
export type CreateChatReplySettingMutationOptions = Apollo.BaseMutationOptions<CreateChatReplySettingMutation, CreateChatReplySettingMutationVariables>;
export const UpdateChatReplySettingDocument = gql`
    mutation updateChatReplySetting($updateChatReplySettingInput: UpdateChatReplySettingInput!) {
  updateChatReplySetting(
    updateChatReplySettingInput: $updateChatReplySettingInput
  ) {
    ...chatReplySetting
  }
}
    ${ChatReplySettingFragmentDoc}`;
export type UpdateChatReplySettingMutationFn = Apollo.MutationFunction<UpdateChatReplySettingMutation, UpdateChatReplySettingMutationVariables>;

/**
 * __useUpdateChatReplySettingMutation__
 *
 * To run a mutation, you first call `useUpdateChatReplySettingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateChatReplySettingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateChatReplySettingMutation, { data, loading, error }] = useUpdateChatReplySettingMutation({
 *   variables: {
 *      updateChatReplySettingInput: // value for 'updateChatReplySettingInput'
 *   },
 * });
 */
export function useUpdateChatReplySettingMutation(baseOptions?: Apollo.MutationHookOptions<UpdateChatReplySettingMutation, UpdateChatReplySettingMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateChatReplySettingMutation, UpdateChatReplySettingMutationVariables>(UpdateChatReplySettingDocument, options);
      }
export type UpdateChatReplySettingMutationHookResult = ReturnType<typeof useUpdateChatReplySettingMutation>;
export type UpdateChatReplySettingMutationResult = Apollo.MutationResult<UpdateChatReplySettingMutation>;
export type UpdateChatReplySettingMutationOptions = Apollo.BaseMutationOptions<UpdateChatReplySettingMutation, UpdateChatReplySettingMutationVariables>;
export const ChatFilesForEndUserDocument = gql`
    query ChatFilesForEndUser($take: Int, $cursorId: String, $cursorCreatedAt: DateTime) {
  chatFilesForEndUser(
    take: $take
    cursorId: $cursorId
    cursorCreatedAt: $cursorCreatedAt
  ) {
    items {
      id
      chatId
      fileName
      originalFileName
      fileSize
      mimeType
      status
      createdAt
      uploaderOperatorId
      uploaderEndUserId
      uploaderOperatorName
      uploaderEndUserName
    }
    nextCursorId
    nextCursorCreatedAt
    hasMore
    totalCount
  }
}
    `;

/**
 * __useChatFilesForEndUserQuery__
 *
 * To run a query within a React component, call `useChatFilesForEndUserQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatFilesForEndUserQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatFilesForEndUserQuery({
 *   variables: {
 *      take: // value for 'take'
 *      cursorId: // value for 'cursorId'
 *      cursorCreatedAt: // value for 'cursorCreatedAt'
 *   },
 * });
 */
export function useChatFilesForEndUserQuery(baseOptions?: Apollo.QueryHookOptions<ChatFilesForEndUserQuery, ChatFilesForEndUserQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatFilesForEndUserQuery, ChatFilesForEndUserQueryVariables>(ChatFilesForEndUserDocument, options);
      }
export function useChatFilesForEndUserLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatFilesForEndUserQuery, ChatFilesForEndUserQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatFilesForEndUserQuery, ChatFilesForEndUserQueryVariables>(ChatFilesForEndUserDocument, options);
        }
// @ts-ignore
export function useChatFilesForEndUserSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatFilesForEndUserQuery, ChatFilesForEndUserQueryVariables>): Apollo.UseSuspenseQueryResult<ChatFilesForEndUserQuery, ChatFilesForEndUserQueryVariables>;
export function useChatFilesForEndUserSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatFilesForEndUserQuery, ChatFilesForEndUserQueryVariables>): Apollo.UseSuspenseQueryResult<ChatFilesForEndUserQuery | undefined, ChatFilesForEndUserQueryVariables>;
export function useChatFilesForEndUserSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatFilesForEndUserQuery, ChatFilesForEndUserQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatFilesForEndUserQuery, ChatFilesForEndUserQueryVariables>(ChatFilesForEndUserDocument, options);
        }
export type ChatFilesForEndUserQueryHookResult = ReturnType<typeof useChatFilesForEndUserQuery>;
export type ChatFilesForEndUserLazyQueryHookResult = ReturnType<typeof useChatFilesForEndUserLazyQuery>;
export type ChatFilesForEndUserSuspenseQueryHookResult = ReturnType<typeof useChatFilesForEndUserSuspenseQuery>;
export type ChatFilesForEndUserQueryResult = Apollo.QueryResult<ChatFilesForEndUserQuery, ChatFilesForEndUserQueryVariables>;
export const ChatFileDownloadUrlForEndUserDocument = gql`
    query ChatFileDownloadUrlForEndUser($input: DownloadChatFileEndUserInput!) {
  chatFileDownloadUrlForEndUser(input: $input) {
    signedUrl
    fileName
    mimeType
  }
}
    `;

/**
 * __useChatFileDownloadUrlForEndUserQuery__
 *
 * To run a query within a React component, call `useChatFileDownloadUrlForEndUserQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatFileDownloadUrlForEndUserQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatFileDownloadUrlForEndUserQuery({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useChatFileDownloadUrlForEndUserQuery(baseOptions: Apollo.QueryHookOptions<ChatFileDownloadUrlForEndUserQuery, ChatFileDownloadUrlForEndUserQueryVariables> & ({ variables: ChatFileDownloadUrlForEndUserQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatFileDownloadUrlForEndUserQuery, ChatFileDownloadUrlForEndUserQueryVariables>(ChatFileDownloadUrlForEndUserDocument, options);
      }
export function useChatFileDownloadUrlForEndUserLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatFileDownloadUrlForEndUserQuery, ChatFileDownloadUrlForEndUserQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatFileDownloadUrlForEndUserQuery, ChatFileDownloadUrlForEndUserQueryVariables>(ChatFileDownloadUrlForEndUserDocument, options);
        }
// @ts-ignore
export function useChatFileDownloadUrlForEndUserSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatFileDownloadUrlForEndUserQuery, ChatFileDownloadUrlForEndUserQueryVariables>): Apollo.UseSuspenseQueryResult<ChatFileDownloadUrlForEndUserQuery, ChatFileDownloadUrlForEndUserQueryVariables>;
export function useChatFileDownloadUrlForEndUserSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatFileDownloadUrlForEndUserQuery, ChatFileDownloadUrlForEndUserQueryVariables>): Apollo.UseSuspenseQueryResult<ChatFileDownloadUrlForEndUserQuery | undefined, ChatFileDownloadUrlForEndUserQueryVariables>;
export function useChatFileDownloadUrlForEndUserSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatFileDownloadUrlForEndUserQuery, ChatFileDownloadUrlForEndUserQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatFileDownloadUrlForEndUserQuery, ChatFileDownloadUrlForEndUserQueryVariables>(ChatFileDownloadUrlForEndUserDocument, options);
        }
export type ChatFileDownloadUrlForEndUserQueryHookResult = ReturnType<typeof useChatFileDownloadUrlForEndUserQuery>;
export type ChatFileDownloadUrlForEndUserLazyQueryHookResult = ReturnType<typeof useChatFileDownloadUrlForEndUserLazyQuery>;
export type ChatFileDownloadUrlForEndUserSuspenseQueryHookResult = ReturnType<typeof useChatFileDownloadUrlForEndUserSuspenseQuery>;
export type ChatFileDownloadUrlForEndUserQueryResult = Apollo.QueryResult<ChatFileDownloadUrlForEndUserQuery, ChatFileDownloadUrlForEndUserQueryVariables>;
export const UploadChatFileForEndUserDocument = gql`
    mutation UploadChatFileForEndUser($input: UploadChatFileEndUserInput!) {
  uploadChatFileForEndUser(input: $input) {
    signedUrl
    chatFile {
      id
    }
  }
}
    `;
export type UploadChatFileForEndUserMutationFn = Apollo.MutationFunction<UploadChatFileForEndUserMutation, UploadChatFileForEndUserMutationVariables>;

/**
 * __useUploadChatFileForEndUserMutation__
 *
 * To run a mutation, you first call `useUploadChatFileForEndUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUploadChatFileForEndUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [uploadChatFileForEndUserMutation, { data, loading, error }] = useUploadChatFileForEndUserMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUploadChatFileForEndUserMutation(baseOptions?: Apollo.MutationHookOptions<UploadChatFileForEndUserMutation, UploadChatFileForEndUserMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UploadChatFileForEndUserMutation, UploadChatFileForEndUserMutationVariables>(UploadChatFileForEndUserDocument, options);
      }
export type UploadChatFileForEndUserMutationHookResult = ReturnType<typeof useUploadChatFileForEndUserMutation>;
export type UploadChatFileForEndUserMutationResult = Apollo.MutationResult<UploadChatFileForEndUserMutation>;
export type UploadChatFileForEndUserMutationOptions = Apollo.BaseMutationOptions<UploadChatFileForEndUserMutation, UploadChatFileForEndUserMutationVariables>;
export const DeleteChatFileForEndUserDocument = gql`
    mutation DeleteChatFileForEndUser($input: DeleteChatFileEndUserInput!) {
  deleteChatFileForEndUser(input: $input) {
    success
  }
}
    `;
export type DeleteChatFileForEndUserMutationFn = Apollo.MutationFunction<DeleteChatFileForEndUserMutation, DeleteChatFileForEndUserMutationVariables>;

/**
 * __useDeleteChatFileForEndUserMutation__
 *
 * To run a mutation, you first call `useDeleteChatFileForEndUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteChatFileForEndUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteChatFileForEndUserMutation, { data, loading, error }] = useDeleteChatFileForEndUserMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useDeleteChatFileForEndUserMutation(baseOptions?: Apollo.MutationHookOptions<DeleteChatFileForEndUserMutation, DeleteChatFileForEndUserMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteChatFileForEndUserMutation, DeleteChatFileForEndUserMutationVariables>(DeleteChatFileForEndUserDocument, options);
      }
export type DeleteChatFileForEndUserMutationHookResult = ReturnType<typeof useDeleteChatFileForEndUserMutation>;
export type DeleteChatFileForEndUserMutationResult = Apollo.MutationResult<DeleteChatFileForEndUserMutation>;
export type DeleteChatFileForEndUserMutationOptions = Apollo.BaseMutationOptions<DeleteChatFileForEndUserMutation, DeleteChatFileForEndUserMutationVariables>;
export const ConfirmChatFileUploadForEndUserDocument = gql`
    mutation ConfirmChatFileUploadForEndUser($input: ConfirmChatFileUploadEndUserInput!) {
  confirmChatFileUploadForEndUser(input: $input) {
    success
    chatFile {
      id
      fileName
      originalFileName
      fileSize
      mimeType
      status
    }
  }
}
    `;
export type ConfirmChatFileUploadForEndUserMutationFn = Apollo.MutationFunction<ConfirmChatFileUploadForEndUserMutation, ConfirmChatFileUploadForEndUserMutationVariables>;

/**
 * __useConfirmChatFileUploadForEndUserMutation__
 *
 * To run a mutation, you first call `useConfirmChatFileUploadForEndUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useConfirmChatFileUploadForEndUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [confirmChatFileUploadForEndUserMutation, { data, loading, error }] = useConfirmChatFileUploadForEndUserMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useConfirmChatFileUploadForEndUserMutation(baseOptions?: Apollo.MutationHookOptions<ConfirmChatFileUploadForEndUserMutation, ConfirmChatFileUploadForEndUserMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ConfirmChatFileUploadForEndUserMutation, ConfirmChatFileUploadForEndUserMutationVariables>(ConfirmChatFileUploadForEndUserDocument, options);
      }
export type ConfirmChatFileUploadForEndUserMutationHookResult = ReturnType<typeof useConfirmChatFileUploadForEndUserMutation>;
export type ConfirmChatFileUploadForEndUserMutationResult = Apollo.MutationResult<ConfirmChatFileUploadForEndUserMutation>;
export type ConfirmChatFileUploadForEndUserMutationOptions = Apollo.BaseMutationOptions<ConfirmChatFileUploadForEndUserMutation, ConfirmChatFileUploadForEndUserMutationVariables>;
export const MemberFeedColumnsDocument = gql`
    query memberFeedColumns {
  memberFeedColumns {
    ...memberFeedColumnFragment
  }
}
    ${MemberFeedColumnFragmentFragmentDoc}`;

/**
 * __useMemberFeedColumnsQuery__
 *
 * To run a query within a React component, call `useMemberFeedColumnsQuery` and pass it any options that fit your needs.
 * When your component renders, `useMemberFeedColumnsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMemberFeedColumnsQuery({
 *   variables: {
 *   },
 * });
 */
export function useMemberFeedColumnsQuery(baseOptions?: Apollo.QueryHookOptions<MemberFeedColumnsQuery, MemberFeedColumnsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<MemberFeedColumnsQuery, MemberFeedColumnsQueryVariables>(MemberFeedColumnsDocument, options);
      }
export function useMemberFeedColumnsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<MemberFeedColumnsQuery, MemberFeedColumnsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<MemberFeedColumnsQuery, MemberFeedColumnsQueryVariables>(MemberFeedColumnsDocument, options);
        }
// @ts-ignore
export function useMemberFeedColumnsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<MemberFeedColumnsQuery, MemberFeedColumnsQueryVariables>): Apollo.UseSuspenseQueryResult<MemberFeedColumnsQuery, MemberFeedColumnsQueryVariables>;
export function useMemberFeedColumnsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<MemberFeedColumnsQuery, MemberFeedColumnsQueryVariables>): Apollo.UseSuspenseQueryResult<MemberFeedColumnsQuery | undefined, MemberFeedColumnsQueryVariables>;
export function useMemberFeedColumnsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<MemberFeedColumnsQuery, MemberFeedColumnsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<MemberFeedColumnsQuery, MemberFeedColumnsQueryVariables>(MemberFeedColumnsDocument, options);
        }
export type MemberFeedColumnsQueryHookResult = ReturnType<typeof useMemberFeedColumnsQuery>;
export type MemberFeedColumnsLazyQueryHookResult = ReturnType<typeof useMemberFeedColumnsLazyQuery>;
export type MemberFeedColumnsSuspenseQueryHookResult = ReturnType<typeof useMemberFeedColumnsSuspenseQuery>;
export type MemberFeedColumnsQueryResult = Apollo.QueryResult<MemberFeedColumnsQuery, MemberFeedColumnsQueryVariables>;
export const MemberFeedsDocument = gql`
    query MemberFeeds($clientUserId: String) {
  memberFeeds(clientUserId: $clientUserId) {
    columnAlias
    columnName
    value
  }
}
    `;

/**
 * __useMemberFeedsQuery__
 *
 * To run a query within a React component, call `useMemberFeedsQuery` and pass it any options that fit your needs.
 * When your component renders, `useMemberFeedsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMemberFeedsQuery({
 *   variables: {
 *      clientUserId: // value for 'clientUserId'
 *   },
 * });
 */
export function useMemberFeedsQuery(baseOptions?: Apollo.QueryHookOptions<MemberFeedsQuery, MemberFeedsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<MemberFeedsQuery, MemberFeedsQueryVariables>(MemberFeedsDocument, options);
      }
export function useMemberFeedsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<MemberFeedsQuery, MemberFeedsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<MemberFeedsQuery, MemberFeedsQueryVariables>(MemberFeedsDocument, options);
        }
// @ts-ignore
export function useMemberFeedsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<MemberFeedsQuery, MemberFeedsQueryVariables>): Apollo.UseSuspenseQueryResult<MemberFeedsQuery, MemberFeedsQueryVariables>;
export function useMemberFeedsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<MemberFeedsQuery, MemberFeedsQueryVariables>): Apollo.UseSuspenseQueryResult<MemberFeedsQuery | undefined, MemberFeedsQueryVariables>;
export function useMemberFeedsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<MemberFeedsQuery, MemberFeedsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<MemberFeedsQuery, MemberFeedsQueryVariables>(MemberFeedsDocument, options);
        }
export type MemberFeedsQueryHookResult = ReturnType<typeof useMemberFeedsQuery>;
export type MemberFeedsLazyQueryHookResult = ReturnType<typeof useMemberFeedsLazyQuery>;
export type MemberFeedsSuspenseQueryHookResult = ReturnType<typeof useMemberFeedsSuspenseQuery>;
export type MemberFeedsQueryResult = Apollo.QueryResult<MemberFeedsQuery, MemberFeedsQueryVariables>;
export const UpdateMemberFeedSettingDocument = gql`
    mutation updateMemberFeedSetting($updateMemberFeedSettingInput: UpdateMemberFeedSettingInput!) {
  updateMemberFeedSetting(
    updateMemberFeedSettingInput: $updateMemberFeedSettingInput
  ) {
    ...memberFeedColumnFragment
  }
}
    ${MemberFeedColumnFragmentFragmentDoc}`;
export type UpdateMemberFeedSettingMutationFn = Apollo.MutationFunction<UpdateMemberFeedSettingMutation, UpdateMemberFeedSettingMutationVariables>;

/**
 * __useUpdateMemberFeedSettingMutation__
 *
 * To run a mutation, you first call `useUpdateMemberFeedSettingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateMemberFeedSettingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateMemberFeedSettingMutation, { data, loading, error }] = useUpdateMemberFeedSettingMutation({
 *   variables: {
 *      updateMemberFeedSettingInput: // value for 'updateMemberFeedSettingInput'
 *   },
 * });
 */
export function useUpdateMemberFeedSettingMutation(baseOptions?: Apollo.MutationHookOptions<UpdateMemberFeedSettingMutation, UpdateMemberFeedSettingMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateMemberFeedSettingMutation, UpdateMemberFeedSettingMutationVariables>(UpdateMemberFeedSettingDocument, options);
      }
export type UpdateMemberFeedSettingMutationHookResult = ReturnType<typeof useUpdateMemberFeedSettingMutation>;
export type UpdateMemberFeedSettingMutationResult = Apollo.MutationResult<UpdateMemberFeedSettingMutation>;
export type UpdateMemberFeedSettingMutationOptions = Apollo.BaseMutationOptions<UpdateMemberFeedSettingMutation, UpdateMemberFeedSettingMutationVariables>;
export const OrganizationDocument = gql`
    query organization($name: String!) {
  organization(name: $name) {
    ...organizationWithUsersFragment
  }
}
    ${OrganizationWithUsersFragmentFragmentDoc}`;

/**
 * __useOrganizationQuery__
 *
 * To run a query within a React component, call `useOrganizationQuery` and pass it any options that fit your needs.
 * When your component renders, `useOrganizationQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOrganizationQuery({
 *   variables: {
 *      name: // value for 'name'
 *   },
 * });
 */
export function useOrganizationQuery(baseOptions: Apollo.QueryHookOptions<OrganizationQuery, OrganizationQueryVariables> & ({ variables: OrganizationQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<OrganizationQuery, OrganizationQueryVariables>(OrganizationDocument, options);
      }
export function useOrganizationLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<OrganizationQuery, OrganizationQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<OrganizationQuery, OrganizationQueryVariables>(OrganizationDocument, options);
        }
// @ts-ignore
export function useOrganizationSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<OrganizationQuery, OrganizationQueryVariables>): Apollo.UseSuspenseQueryResult<OrganizationQuery, OrganizationQueryVariables>;
export function useOrganizationSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<OrganizationQuery, OrganizationQueryVariables>): Apollo.UseSuspenseQueryResult<OrganizationQuery | undefined, OrganizationQueryVariables>;
export function useOrganizationSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<OrganizationQuery, OrganizationQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<OrganizationQuery, OrganizationQueryVariables>(OrganizationDocument, options);
        }
export type OrganizationQueryHookResult = ReturnType<typeof useOrganizationQuery>;
export type OrganizationLazyQueryHookResult = ReturnType<typeof useOrganizationLazyQuery>;
export type OrganizationSuspenseQueryHookResult = ReturnType<typeof useOrganizationSuspenseQuery>;
export type OrganizationQueryResult = Apollo.QueryResult<OrganizationQuery, OrganizationQueryVariables>;
export const OrganizationsDocument = gql`
    query organizations {
  organizations {
    items {
      ...organizationWithUsersFragment
    }
    count
  }
}
    ${OrganizationWithUsersFragmentFragmentDoc}`;

/**
 * __useOrganizationsQuery__
 *
 * To run a query within a React component, call `useOrganizationsQuery` and pass it any options that fit your needs.
 * When your component renders, `useOrganizationsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOrganizationsQuery({
 *   variables: {
 *   },
 * });
 */
export function useOrganizationsQuery(baseOptions?: Apollo.QueryHookOptions<OrganizationsQuery, OrganizationsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<OrganizationsQuery, OrganizationsQueryVariables>(OrganizationsDocument, options);
      }
export function useOrganizationsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<OrganizationsQuery, OrganizationsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<OrganizationsQuery, OrganizationsQueryVariables>(OrganizationsDocument, options);
        }
// @ts-ignore
export function useOrganizationsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<OrganizationsQuery, OrganizationsQueryVariables>): Apollo.UseSuspenseQueryResult<OrganizationsQuery, OrganizationsQueryVariables>;
export function useOrganizationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<OrganizationsQuery, OrganizationsQueryVariables>): Apollo.UseSuspenseQueryResult<OrganizationsQuery | undefined, OrganizationsQueryVariables>;
export function useOrganizationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<OrganizationsQuery, OrganizationsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<OrganizationsQuery, OrganizationsQueryVariables>(OrganizationsDocument, options);
        }
export type OrganizationsQueryHookResult = ReturnType<typeof useOrganizationsQuery>;
export type OrganizationsLazyQueryHookResult = ReturnType<typeof useOrganizationsLazyQuery>;
export type OrganizationsSuspenseQueryHookResult = ReturnType<typeof useOrganizationsSuspenseQuery>;
export type OrganizationsQueryResult = Apollo.QueryResult<OrganizationsQuery, OrganizationsQueryVariables>;
export const PaginatedOrganizationsDocument = gql`
    query paginatedOrganizations($skip: Int, $take: Int, $filter: FilterInput) {
  organizations(skip: $skip, take: $take, filter: $filter) {
    items {
      ...organizationWithUsersFragment
    }
    count
  }
}
    ${OrganizationWithUsersFragmentFragmentDoc}`;

/**
 * __usePaginatedOrganizationsQuery__
 *
 * To run a query within a React component, call `usePaginatedOrganizationsQuery` and pass it any options that fit your needs.
 * When your component renders, `usePaginatedOrganizationsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePaginatedOrganizationsQuery({
 *   variables: {
 *      skip: // value for 'skip'
 *      take: // value for 'take'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function usePaginatedOrganizationsQuery(baseOptions?: Apollo.QueryHookOptions<PaginatedOrganizationsQuery, PaginatedOrganizationsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PaginatedOrganizationsQuery, PaginatedOrganizationsQueryVariables>(PaginatedOrganizationsDocument, options);
      }
export function usePaginatedOrganizationsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PaginatedOrganizationsQuery, PaginatedOrganizationsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PaginatedOrganizationsQuery, PaginatedOrganizationsQueryVariables>(PaginatedOrganizationsDocument, options);
        }
// @ts-ignore
export function usePaginatedOrganizationsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<PaginatedOrganizationsQuery, PaginatedOrganizationsQueryVariables>): Apollo.UseSuspenseQueryResult<PaginatedOrganizationsQuery, PaginatedOrganizationsQueryVariables>;
export function usePaginatedOrganizationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<PaginatedOrganizationsQuery, PaginatedOrganizationsQueryVariables>): Apollo.UseSuspenseQueryResult<PaginatedOrganizationsQuery | undefined, PaginatedOrganizationsQueryVariables>;
export function usePaginatedOrganizationsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<PaginatedOrganizationsQuery, PaginatedOrganizationsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<PaginatedOrganizationsQuery, PaginatedOrganizationsQueryVariables>(PaginatedOrganizationsDocument, options);
        }
export type PaginatedOrganizationsQueryHookResult = ReturnType<typeof usePaginatedOrganizationsQuery>;
export type PaginatedOrganizationsLazyQueryHookResult = ReturnType<typeof usePaginatedOrganizationsLazyQuery>;
export type PaginatedOrganizationsSuspenseQueryHookResult = ReturnType<typeof usePaginatedOrganizationsSuspenseQuery>;
export type PaginatedOrganizationsQueryResult = Apollo.QueryResult<PaginatedOrganizationsQuery, PaginatedOrganizationsQueryVariables>;
export const CreateOrganizationDocument = gql`
    mutation createOrganization($createOrganizationInput: CreateOrganizationInput!) {
  createOrganization(createOrganizationInput: $createOrganizationInput) {
    ...organizationWithUsersFragment
  }
}
    ${OrganizationWithUsersFragmentFragmentDoc}`;
export type CreateOrganizationMutationFn = Apollo.MutationFunction<CreateOrganizationMutation, CreateOrganizationMutationVariables>;

/**
 * __useCreateOrganizationMutation__
 *
 * To run a mutation, you first call `useCreateOrganizationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateOrganizationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createOrganizationMutation, { data, loading, error }] = useCreateOrganizationMutation({
 *   variables: {
 *      createOrganizationInput: // value for 'createOrganizationInput'
 *   },
 * });
 */
export function useCreateOrganizationMutation(baseOptions?: Apollo.MutationHookOptions<CreateOrganizationMutation, CreateOrganizationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateOrganizationMutation, CreateOrganizationMutationVariables>(CreateOrganizationDocument, options);
      }
export type CreateOrganizationMutationHookResult = ReturnType<typeof useCreateOrganizationMutation>;
export type CreateOrganizationMutationResult = Apollo.MutationResult<CreateOrganizationMutation>;
export type CreateOrganizationMutationOptions = Apollo.BaseMutationOptions<CreateOrganizationMutation, CreateOrganizationMutationVariables>;
export const UpdateOrganizationDocument = gql`
    mutation updateOrganization($updateOrganizationInput: UpdateOrganizationInput!) {
  updateOrganization(updateOrganizationInput: $updateOrganizationInput) {
    ...organizationWithUsersFragment
  }
}
    ${OrganizationWithUsersFragmentFragmentDoc}`;
export type UpdateOrganizationMutationFn = Apollo.MutationFunction<UpdateOrganizationMutation, UpdateOrganizationMutationVariables>;

/**
 * __useUpdateOrganizationMutation__
 *
 * To run a mutation, you first call `useUpdateOrganizationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateOrganizationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateOrganizationMutation, { data, loading, error }] = useUpdateOrganizationMutation({
 *   variables: {
 *      updateOrganizationInput: // value for 'updateOrganizationInput'
 *   },
 * });
 */
export function useUpdateOrganizationMutation(baseOptions?: Apollo.MutationHookOptions<UpdateOrganizationMutation, UpdateOrganizationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateOrganizationMutation, UpdateOrganizationMutationVariables>(UpdateOrganizationDocument, options);
      }
export type UpdateOrganizationMutationHookResult = ReturnType<typeof useUpdateOrganizationMutation>;
export type UpdateOrganizationMutationResult = Apollo.MutationResult<UpdateOrganizationMutation>;
export type UpdateOrganizationMutationOptions = Apollo.BaseMutationOptions<UpdateOrganizationMutation, UpdateOrganizationMutationVariables>;
export const ToggleOrganizationStatusDocument = gql`
    mutation toggleOrganizationStatus($name: String!) {
  toggleOrganizationStatus(name: $name) {
    ...organizationWithUsersFragment
  }
}
    ${OrganizationWithUsersFragmentFragmentDoc}`;
export type ToggleOrganizationStatusMutationFn = Apollo.MutationFunction<ToggleOrganizationStatusMutation, ToggleOrganizationStatusMutationVariables>;

/**
 * __useToggleOrganizationStatusMutation__
 *
 * To run a mutation, you first call `useToggleOrganizationStatusMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useToggleOrganizationStatusMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [toggleOrganizationStatusMutation, { data, loading, error }] = useToggleOrganizationStatusMutation({
 *   variables: {
 *      name: // value for 'name'
 *   },
 * });
 */
export function useToggleOrganizationStatusMutation(baseOptions?: Apollo.MutationHookOptions<ToggleOrganizationStatusMutation, ToggleOrganizationStatusMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ToggleOrganizationStatusMutation, ToggleOrganizationStatusMutationVariables>(ToggleOrganizationStatusDocument, options);
      }
export type ToggleOrganizationStatusMutationHookResult = ReturnType<typeof useToggleOrganizationStatusMutation>;
export type ToggleOrganizationStatusMutationResult = Apollo.MutationResult<ToggleOrganizationStatusMutation>;
export type ToggleOrganizationStatusMutationOptions = Apollo.BaseMutationOptions<ToggleOrganizationStatusMutation, ToggleOrganizationStatusMutationVariables>;
export const ChatAssignFiltersDocument = gql`
    query chatAssignFilters($skip: Int, $take: Int, $filter: FilterInput) {
  chatAssignFilters: chatAssignFiltersWithCount(
    filter: $filter
    skip: $skip
    take: $take
  ) {
    items {
      ...chatAssignFilterFragment
    }
    count
  }
}
    ${ChatAssignFilterFragmentFragmentDoc}`;

/**
 * __useChatAssignFiltersQuery__
 *
 * To run a query within a React component, call `useChatAssignFiltersQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatAssignFiltersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatAssignFiltersQuery({
 *   variables: {
 *      skip: // value for 'skip'
 *      take: // value for 'take'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useChatAssignFiltersQuery(baseOptions?: Apollo.QueryHookOptions<ChatAssignFiltersQuery, ChatAssignFiltersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatAssignFiltersQuery, ChatAssignFiltersQueryVariables>(ChatAssignFiltersDocument, options);
      }
export function useChatAssignFiltersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatAssignFiltersQuery, ChatAssignFiltersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatAssignFiltersQuery, ChatAssignFiltersQueryVariables>(ChatAssignFiltersDocument, options);
        }
// @ts-ignore
export function useChatAssignFiltersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatAssignFiltersQuery, ChatAssignFiltersQueryVariables>): Apollo.UseSuspenseQueryResult<ChatAssignFiltersQuery, ChatAssignFiltersQueryVariables>;
export function useChatAssignFiltersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatAssignFiltersQuery, ChatAssignFiltersQueryVariables>): Apollo.UseSuspenseQueryResult<ChatAssignFiltersQuery | undefined, ChatAssignFiltersQueryVariables>;
export function useChatAssignFiltersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatAssignFiltersQuery, ChatAssignFiltersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatAssignFiltersQuery, ChatAssignFiltersQueryVariables>(ChatAssignFiltersDocument, options);
        }
export type ChatAssignFiltersQueryHookResult = ReturnType<typeof useChatAssignFiltersQuery>;
export type ChatAssignFiltersLazyQueryHookResult = ReturnType<typeof useChatAssignFiltersLazyQuery>;
export type ChatAssignFiltersSuspenseQueryHookResult = ReturnType<typeof useChatAssignFiltersSuspenseQuery>;
export type ChatAssignFiltersQueryResult = Apollo.QueryResult<ChatAssignFiltersQuery, ChatAssignFiltersQueryVariables>;
export const ChatAssignFilterDocument = gql`
    query chatAssignFilter($id: String!) {
  chatAssignFilter(id: $id) {
    ...chatAssignFilterFragment
  }
}
    ${ChatAssignFilterFragmentFragmentDoc}`;

/**
 * __useChatAssignFilterQuery__
 *
 * To run a query within a React component, call `useChatAssignFilterQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatAssignFilterQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatAssignFilterQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useChatAssignFilterQuery(baseOptions: Apollo.QueryHookOptions<ChatAssignFilterQuery, ChatAssignFilterQueryVariables> & ({ variables: ChatAssignFilterQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatAssignFilterQuery, ChatAssignFilterQueryVariables>(ChatAssignFilterDocument, options);
      }
export function useChatAssignFilterLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatAssignFilterQuery, ChatAssignFilterQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatAssignFilterQuery, ChatAssignFilterQueryVariables>(ChatAssignFilterDocument, options);
        }
// @ts-ignore
export function useChatAssignFilterSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatAssignFilterQuery, ChatAssignFilterQueryVariables>): Apollo.UseSuspenseQueryResult<ChatAssignFilterQuery, ChatAssignFilterQueryVariables>;
export function useChatAssignFilterSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatAssignFilterQuery, ChatAssignFilterQueryVariables>): Apollo.UseSuspenseQueryResult<ChatAssignFilterQuery | undefined, ChatAssignFilterQueryVariables>;
export function useChatAssignFilterSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatAssignFilterQuery, ChatAssignFilterQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatAssignFilterQuery, ChatAssignFilterQueryVariables>(ChatAssignFilterDocument, options);
        }
export type ChatAssignFilterQueryHookResult = ReturnType<typeof useChatAssignFilterQuery>;
export type ChatAssignFilterLazyQueryHookResult = ReturnType<typeof useChatAssignFilterLazyQuery>;
export type ChatAssignFilterSuspenseQueryHookResult = ReturnType<typeof useChatAssignFilterSuspenseQuery>;
export type ChatAssignFilterQueryResult = Apollo.QueryResult<ChatAssignFilterQuery, ChatAssignFilterQueryVariables>;
export const CreateChatAssignFilterDocument = gql`
    mutation createChatAssignFilter($createChatAssignFilterInput: CreateChatAssignFilterInput!) {
  createChatAssignFilter(
    createChatAssignFilterInput: $createChatAssignFilterInput
  ) {
    ...chatAssignFilterFragment
  }
}
    ${ChatAssignFilterFragmentFragmentDoc}`;
export type CreateChatAssignFilterMutationFn = Apollo.MutationFunction<CreateChatAssignFilterMutation, CreateChatAssignFilterMutationVariables>;

/**
 * __useCreateChatAssignFilterMutation__
 *
 * To run a mutation, you first call `useCreateChatAssignFilterMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateChatAssignFilterMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createChatAssignFilterMutation, { data, loading, error }] = useCreateChatAssignFilterMutation({
 *   variables: {
 *      createChatAssignFilterInput: // value for 'createChatAssignFilterInput'
 *   },
 * });
 */
export function useCreateChatAssignFilterMutation(baseOptions?: Apollo.MutationHookOptions<CreateChatAssignFilterMutation, CreateChatAssignFilterMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateChatAssignFilterMutation, CreateChatAssignFilterMutationVariables>(CreateChatAssignFilterDocument, options);
      }
export type CreateChatAssignFilterMutationHookResult = ReturnType<typeof useCreateChatAssignFilterMutation>;
export type CreateChatAssignFilterMutationResult = Apollo.MutationResult<CreateChatAssignFilterMutation>;
export type CreateChatAssignFilterMutationOptions = Apollo.BaseMutationOptions<CreateChatAssignFilterMutation, CreateChatAssignFilterMutationVariables>;
export const UpdateChatAssignFilterDocument = gql`
    mutation updateChatAssignFilter($updateChatAssignFilterInput: UpdateChatAssignFilterInput!) {
  updateChatAssignFilter(
    updateChatAssignFilterInput: $updateChatAssignFilterInput
  ) {
    ...chatAssignFilterFragment
  }
}
    ${ChatAssignFilterFragmentFragmentDoc}`;
export type UpdateChatAssignFilterMutationFn = Apollo.MutationFunction<UpdateChatAssignFilterMutation, UpdateChatAssignFilterMutationVariables>;

/**
 * __useUpdateChatAssignFilterMutation__
 *
 * To run a mutation, you first call `useUpdateChatAssignFilterMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateChatAssignFilterMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateChatAssignFilterMutation, { data, loading, error }] = useUpdateChatAssignFilterMutation({
 *   variables: {
 *      updateChatAssignFilterInput: // value for 'updateChatAssignFilterInput'
 *   },
 * });
 */
export function useUpdateChatAssignFilterMutation(baseOptions?: Apollo.MutationHookOptions<UpdateChatAssignFilterMutation, UpdateChatAssignFilterMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateChatAssignFilterMutation, UpdateChatAssignFilterMutationVariables>(UpdateChatAssignFilterDocument, options);
      }
export type UpdateChatAssignFilterMutationHookResult = ReturnType<typeof useUpdateChatAssignFilterMutation>;
export type UpdateChatAssignFilterMutationResult = Apollo.MutationResult<UpdateChatAssignFilterMutation>;
export type UpdateChatAssignFilterMutationOptions = Apollo.BaseMutationOptions<UpdateChatAssignFilterMutation, UpdateChatAssignFilterMutationVariables>;
export const DeleteChatAssignFilterDocument = gql`
    mutation deleteChatAssignFilter($id: String!) {
  deleteChatAssignFilter(id: $id) {
    id
  }
}
    `;
export type DeleteChatAssignFilterMutationFn = Apollo.MutationFunction<DeleteChatAssignFilterMutation, DeleteChatAssignFilterMutationVariables>;

/**
 * __useDeleteChatAssignFilterMutation__
 *
 * To run a mutation, you first call `useDeleteChatAssignFilterMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteChatAssignFilterMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteChatAssignFilterMutation, { data, loading, error }] = useDeleteChatAssignFilterMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteChatAssignFilterMutation(baseOptions?: Apollo.MutationHookOptions<DeleteChatAssignFilterMutation, DeleteChatAssignFilterMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteChatAssignFilterMutation, DeleteChatAssignFilterMutationVariables>(DeleteChatAssignFilterDocument, options);
      }
export type DeleteChatAssignFilterMutationHookResult = ReturnType<typeof useDeleteChatAssignFilterMutation>;
export type DeleteChatAssignFilterMutationResult = Apollo.MutationResult<DeleteChatAssignFilterMutation>;
export type DeleteChatAssignFilterMutationOptions = Apollo.BaseMutationOptions<DeleteChatAssignFilterMutation, DeleteChatAssignFilterMutationVariables>;
export const ChatAssignRulesDocument = gql`
    query chatAssignRules($skip: Int, $take: Int, $filter: FilterInput) {
  chatAssignRules(skip: $skip, take: $take, filter: $filter) {
    items {
      ...chatAssignRuleFragment
    }
    count
  }
}
    ${ChatAssignRuleFragmentFragmentDoc}`;

/**
 * __useChatAssignRulesQuery__
 *
 * To run a query within a React component, call `useChatAssignRulesQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatAssignRulesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatAssignRulesQuery({
 *   variables: {
 *      skip: // value for 'skip'
 *      take: // value for 'take'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useChatAssignRulesQuery(baseOptions?: Apollo.QueryHookOptions<ChatAssignRulesQuery, ChatAssignRulesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatAssignRulesQuery, ChatAssignRulesQueryVariables>(ChatAssignRulesDocument, options);
      }
export function useChatAssignRulesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatAssignRulesQuery, ChatAssignRulesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatAssignRulesQuery, ChatAssignRulesQueryVariables>(ChatAssignRulesDocument, options);
        }
// @ts-ignore
export function useChatAssignRulesSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatAssignRulesQuery, ChatAssignRulesQueryVariables>): Apollo.UseSuspenseQueryResult<ChatAssignRulesQuery, ChatAssignRulesQueryVariables>;
export function useChatAssignRulesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatAssignRulesQuery, ChatAssignRulesQueryVariables>): Apollo.UseSuspenseQueryResult<ChatAssignRulesQuery | undefined, ChatAssignRulesQueryVariables>;
export function useChatAssignRulesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatAssignRulesQuery, ChatAssignRulesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatAssignRulesQuery, ChatAssignRulesQueryVariables>(ChatAssignRulesDocument, options);
        }
export type ChatAssignRulesQueryHookResult = ReturnType<typeof useChatAssignRulesQuery>;
export type ChatAssignRulesLazyQueryHookResult = ReturnType<typeof useChatAssignRulesLazyQuery>;
export type ChatAssignRulesSuspenseQueryHookResult = ReturnType<typeof useChatAssignRulesSuspenseQuery>;
export type ChatAssignRulesQueryResult = Apollo.QueryResult<ChatAssignRulesQuery, ChatAssignRulesQueryVariables>;
export const ChatAssignRuleDocument = gql`
    query chatAssignRule($id: String!) {
  chatAssignRule(id: $id) {
    ...chatAssignRuleFragment
  }
}
    ${ChatAssignRuleFragmentFragmentDoc}`;

/**
 * __useChatAssignRuleQuery__
 *
 * To run a query within a React component, call `useChatAssignRuleQuery` and pass it any options that fit your needs.
 * When your component renders, `useChatAssignRuleQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useChatAssignRuleQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useChatAssignRuleQuery(baseOptions: Apollo.QueryHookOptions<ChatAssignRuleQuery, ChatAssignRuleQueryVariables> & ({ variables: ChatAssignRuleQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ChatAssignRuleQuery, ChatAssignRuleQueryVariables>(ChatAssignRuleDocument, options);
      }
export function useChatAssignRuleLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ChatAssignRuleQuery, ChatAssignRuleQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ChatAssignRuleQuery, ChatAssignRuleQueryVariables>(ChatAssignRuleDocument, options);
        }
// @ts-ignore
export function useChatAssignRuleSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ChatAssignRuleQuery, ChatAssignRuleQueryVariables>): Apollo.UseSuspenseQueryResult<ChatAssignRuleQuery, ChatAssignRuleQueryVariables>;
export function useChatAssignRuleSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatAssignRuleQuery, ChatAssignRuleQueryVariables>): Apollo.UseSuspenseQueryResult<ChatAssignRuleQuery | undefined, ChatAssignRuleQueryVariables>;
export function useChatAssignRuleSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ChatAssignRuleQuery, ChatAssignRuleQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ChatAssignRuleQuery, ChatAssignRuleQueryVariables>(ChatAssignRuleDocument, options);
        }
export type ChatAssignRuleQueryHookResult = ReturnType<typeof useChatAssignRuleQuery>;
export type ChatAssignRuleLazyQueryHookResult = ReturnType<typeof useChatAssignRuleLazyQuery>;
export type ChatAssignRuleSuspenseQueryHookResult = ReturnType<typeof useChatAssignRuleSuspenseQuery>;
export type ChatAssignRuleQueryResult = Apollo.QueryResult<ChatAssignRuleQuery, ChatAssignRuleQueryVariables>;
export const SelectableChatAssignFiltersDocument = gql`
    query selectableChatAssignFilters {
  selectableChatAssignFilters {
    id
    name
    targetTable
  }
}
    `;

/**
 * __useSelectableChatAssignFiltersQuery__
 *
 * To run a query within a React component, call `useSelectableChatAssignFiltersQuery` and pass it any options that fit your needs.
 * When your component renders, `useSelectableChatAssignFiltersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSelectableChatAssignFiltersQuery({
 *   variables: {
 *   },
 * });
 */
export function useSelectableChatAssignFiltersQuery(baseOptions?: Apollo.QueryHookOptions<SelectableChatAssignFiltersQuery, SelectableChatAssignFiltersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SelectableChatAssignFiltersQuery, SelectableChatAssignFiltersQueryVariables>(SelectableChatAssignFiltersDocument, options);
      }
export function useSelectableChatAssignFiltersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SelectableChatAssignFiltersQuery, SelectableChatAssignFiltersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SelectableChatAssignFiltersQuery, SelectableChatAssignFiltersQueryVariables>(SelectableChatAssignFiltersDocument, options);
        }
// @ts-ignore
export function useSelectableChatAssignFiltersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SelectableChatAssignFiltersQuery, SelectableChatAssignFiltersQueryVariables>): Apollo.UseSuspenseQueryResult<SelectableChatAssignFiltersQuery, SelectableChatAssignFiltersQueryVariables>;
export function useSelectableChatAssignFiltersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SelectableChatAssignFiltersQuery, SelectableChatAssignFiltersQueryVariables>): Apollo.UseSuspenseQueryResult<SelectableChatAssignFiltersQuery | undefined, SelectableChatAssignFiltersQueryVariables>;
export function useSelectableChatAssignFiltersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SelectableChatAssignFiltersQuery, SelectableChatAssignFiltersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SelectableChatAssignFiltersQuery, SelectableChatAssignFiltersQueryVariables>(SelectableChatAssignFiltersDocument, options);
        }
export type SelectableChatAssignFiltersQueryHookResult = ReturnType<typeof useSelectableChatAssignFiltersQuery>;
export type SelectableChatAssignFiltersLazyQueryHookResult = ReturnType<typeof useSelectableChatAssignFiltersLazyQuery>;
export type SelectableChatAssignFiltersSuspenseQueryHookResult = ReturnType<typeof useSelectableChatAssignFiltersSuspenseQuery>;
export type SelectableChatAssignFiltersQueryResult = Apollo.QueryResult<SelectableChatAssignFiltersQuery, SelectableChatAssignFiltersQueryVariables>;
export const CreateChatAssignRuleDocument = gql`
    mutation createChatAssignRule($createChatAssignRuleInput: CreateChatAssignRuleInput!) {
  createChatAssignRule(createChatAssignRuleInput: $createChatAssignRuleInput) {
    ...chatAssignRuleFragment
  }
}
    ${ChatAssignRuleFragmentFragmentDoc}`;
export type CreateChatAssignRuleMutationFn = Apollo.MutationFunction<CreateChatAssignRuleMutation, CreateChatAssignRuleMutationVariables>;

/**
 * __useCreateChatAssignRuleMutation__
 *
 * To run a mutation, you first call `useCreateChatAssignRuleMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateChatAssignRuleMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createChatAssignRuleMutation, { data, loading, error }] = useCreateChatAssignRuleMutation({
 *   variables: {
 *      createChatAssignRuleInput: // value for 'createChatAssignRuleInput'
 *   },
 * });
 */
export function useCreateChatAssignRuleMutation(baseOptions?: Apollo.MutationHookOptions<CreateChatAssignRuleMutation, CreateChatAssignRuleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateChatAssignRuleMutation, CreateChatAssignRuleMutationVariables>(CreateChatAssignRuleDocument, options);
      }
export type CreateChatAssignRuleMutationHookResult = ReturnType<typeof useCreateChatAssignRuleMutation>;
export type CreateChatAssignRuleMutationResult = Apollo.MutationResult<CreateChatAssignRuleMutation>;
export type CreateChatAssignRuleMutationOptions = Apollo.BaseMutationOptions<CreateChatAssignRuleMutation, CreateChatAssignRuleMutationVariables>;
export const UpdateChatAssignRuleDocument = gql`
    mutation updateChatAssignRule($updateChatAssignRuleInput: UpdateChatAssignRuleInput!) {
  updateChatAssignRule(updateChatAssignRuleInput: $updateChatAssignRuleInput) {
    ...chatAssignRuleFragment
  }
}
    ${ChatAssignRuleFragmentFragmentDoc}`;
export type UpdateChatAssignRuleMutationFn = Apollo.MutationFunction<UpdateChatAssignRuleMutation, UpdateChatAssignRuleMutationVariables>;

/**
 * __useUpdateChatAssignRuleMutation__
 *
 * To run a mutation, you first call `useUpdateChatAssignRuleMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateChatAssignRuleMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateChatAssignRuleMutation, { data, loading, error }] = useUpdateChatAssignRuleMutation({
 *   variables: {
 *      updateChatAssignRuleInput: // value for 'updateChatAssignRuleInput'
 *   },
 * });
 */
export function useUpdateChatAssignRuleMutation(baseOptions?: Apollo.MutationHookOptions<UpdateChatAssignRuleMutation, UpdateChatAssignRuleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateChatAssignRuleMutation, UpdateChatAssignRuleMutationVariables>(UpdateChatAssignRuleDocument, options);
      }
export type UpdateChatAssignRuleMutationHookResult = ReturnType<typeof useUpdateChatAssignRuleMutation>;
export type UpdateChatAssignRuleMutationResult = Apollo.MutationResult<UpdateChatAssignRuleMutation>;
export type UpdateChatAssignRuleMutationOptions = Apollo.BaseMutationOptions<UpdateChatAssignRuleMutation, UpdateChatAssignRuleMutationVariables>;
export const DeleteChatAssignRuleDocument = gql`
    mutation deleteChatAssignRule($id: String!) {
  deleteChatAssignRule(id: $id) {
    id
  }
}
    `;
export type DeleteChatAssignRuleMutationFn = Apollo.MutationFunction<DeleteChatAssignRuleMutation, DeleteChatAssignRuleMutationVariables>;

/**
 * __useDeleteChatAssignRuleMutation__
 *
 * To run a mutation, you first call `useDeleteChatAssignRuleMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteChatAssignRuleMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteChatAssignRuleMutation, { data, loading, error }] = useDeleteChatAssignRuleMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteChatAssignRuleMutation(baseOptions?: Apollo.MutationHookOptions<DeleteChatAssignRuleMutation, DeleteChatAssignRuleMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteChatAssignRuleMutation, DeleteChatAssignRuleMutationVariables>(DeleteChatAssignRuleDocument, options);
      }
export type DeleteChatAssignRuleMutationHookResult = ReturnType<typeof useDeleteChatAssignRuleMutation>;
export type DeleteChatAssignRuleMutationResult = Apollo.MutationResult<DeleteChatAssignRuleMutation>;
export type DeleteChatAssignRuleMutationOptions = Apollo.BaseMutationOptions<DeleteChatAssignRuleMutation, DeleteChatAssignRuleMutationVariables>;
export const StoreDocument = gql`
    query store($id: String!) {
  store(id: $id) {
    ...storeFragment
  }
}
    ${StoreFragmentFragmentDoc}`;

/**
 * __useStoreQuery__
 *
 * To run a query within a React component, call `useStoreQuery` and pass it any options that fit your needs.
 * When your component renders, `useStoreQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useStoreQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useStoreQuery(baseOptions: Apollo.QueryHookOptions<StoreQuery, StoreQueryVariables> & ({ variables: StoreQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<StoreQuery, StoreQueryVariables>(StoreDocument, options);
      }
export function useStoreLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<StoreQuery, StoreQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<StoreQuery, StoreQueryVariables>(StoreDocument, options);
        }
// @ts-ignore
export function useStoreSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<StoreQuery, StoreQueryVariables>): Apollo.UseSuspenseQueryResult<StoreQuery, StoreQueryVariables>;
export function useStoreSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<StoreQuery, StoreQueryVariables>): Apollo.UseSuspenseQueryResult<StoreQuery | undefined, StoreQueryVariables>;
export function useStoreSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<StoreQuery, StoreQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<StoreQuery, StoreQueryVariables>(StoreDocument, options);
        }
export type StoreQueryHookResult = ReturnType<typeof useStoreQuery>;
export type StoreLazyQueryHookResult = ReturnType<typeof useStoreLazyQuery>;
export type StoreSuspenseQueryHookResult = ReturnType<typeof useStoreSuspenseQuery>;
export type StoreQueryResult = Apollo.QueryResult<StoreQuery, StoreQueryVariables>;
export const StoresInfiniteScrollDocument = gql`
    query storesInfiniteScroll($organizationId: String, $cursorId: String, $cursorCreatedAt: DateTime, $take: Int) {
  storesCursor(
    inputOrganizationId: $organizationId
    cursorId: $cursorId
    cursorCreatedAt: $cursorCreatedAt
    take: $take
  ) {
    items {
      ...storeFragment
    }
    hasMore
    nextCursorId
    nextCursorCreatedAt
  }
}
    ${StoreFragmentFragmentDoc}`;

/**
 * __useStoresInfiniteScrollQuery__
 *
 * To run a query within a React component, call `useStoresInfiniteScrollQuery` and pass it any options that fit your needs.
 * When your component renders, `useStoresInfiniteScrollQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useStoresInfiniteScrollQuery({
 *   variables: {
 *      organizationId: // value for 'organizationId'
 *      cursorId: // value for 'cursorId'
 *      cursorCreatedAt: // value for 'cursorCreatedAt'
 *      take: // value for 'take'
 *   },
 * });
 */
export function useStoresInfiniteScrollQuery(baseOptions?: Apollo.QueryHookOptions<StoresInfiniteScrollQuery, StoresInfiniteScrollQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<StoresInfiniteScrollQuery, StoresInfiniteScrollQueryVariables>(StoresInfiniteScrollDocument, options);
      }
export function useStoresInfiniteScrollLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<StoresInfiniteScrollQuery, StoresInfiniteScrollQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<StoresInfiniteScrollQuery, StoresInfiniteScrollQueryVariables>(StoresInfiniteScrollDocument, options);
        }
// @ts-ignore
export function useStoresInfiniteScrollSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<StoresInfiniteScrollQuery, StoresInfiniteScrollQueryVariables>): Apollo.UseSuspenseQueryResult<StoresInfiniteScrollQuery, StoresInfiniteScrollQueryVariables>;
export function useStoresInfiniteScrollSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<StoresInfiniteScrollQuery, StoresInfiniteScrollQueryVariables>): Apollo.UseSuspenseQueryResult<StoresInfiniteScrollQuery | undefined, StoresInfiniteScrollQueryVariables>;
export function useStoresInfiniteScrollSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<StoresInfiniteScrollQuery, StoresInfiniteScrollQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<StoresInfiniteScrollQuery, StoresInfiniteScrollQueryVariables>(StoresInfiniteScrollDocument, options);
        }
export type StoresInfiniteScrollQueryHookResult = ReturnType<typeof useStoresInfiniteScrollQuery>;
export type StoresInfiniteScrollLazyQueryHookResult = ReturnType<typeof useStoresInfiniteScrollLazyQuery>;
export type StoresInfiniteScrollSuspenseQueryHookResult = ReturnType<typeof useStoresInfiniteScrollSuspenseQuery>;
export type StoresInfiniteScrollQueryResult = Apollo.QueryResult<StoresInfiniteScrollQuery, StoresInfiniteScrollQueryVariables>;
export const StoresDocument = gql`
    query stores($skip: Int, $take: Int, $filter: FilterInput) {
  stores(skip: $skip, take: $take, filter: $filter) {
    items {
      ...storeFragment
    }
    count
  }
}
    ${StoreFragmentFragmentDoc}`;

/**
 * __useStoresQuery__
 *
 * To run a query within a React component, call `useStoresQuery` and pass it any options that fit your needs.
 * When your component renders, `useStoresQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useStoresQuery({
 *   variables: {
 *      skip: // value for 'skip'
 *      take: // value for 'take'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useStoresQuery(baseOptions?: Apollo.QueryHookOptions<StoresQuery, StoresQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<StoresQuery, StoresQueryVariables>(StoresDocument, options);
      }
export function useStoresLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<StoresQuery, StoresQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<StoresQuery, StoresQueryVariables>(StoresDocument, options);
        }
// @ts-ignore
export function useStoresSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<StoresQuery, StoresQueryVariables>): Apollo.UseSuspenseQueryResult<StoresQuery, StoresQueryVariables>;
export function useStoresSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<StoresQuery, StoresQueryVariables>): Apollo.UseSuspenseQueryResult<StoresQuery | undefined, StoresQueryVariables>;
export function useStoresSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<StoresQuery, StoresQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<StoresQuery, StoresQueryVariables>(StoresDocument, options);
        }
export type StoresQueryHookResult = ReturnType<typeof useStoresQuery>;
export type StoresLazyQueryHookResult = ReturnType<typeof useStoresLazyQuery>;
export type StoresSuspenseQueryHookResult = ReturnType<typeof useStoresSuspenseQuery>;
export type StoresQueryResult = Apollo.QueryResult<StoresQuery, StoresQueryVariables>;
export const SurveysDocument = gql`
    query surveys($chatId: String!) {
  surveys(chatId: $chatId) {
    columnAlias
    columnName
    value
  }
}
    `;

/**
 * __useSurveysQuery__
 *
 * To run a query within a React component, call `useSurveysQuery` and pass it any options that fit your needs.
 * When your component renders, `useSurveysQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSurveysQuery({
 *   variables: {
 *      chatId: // value for 'chatId'
 *   },
 * });
 */
export function useSurveysQuery(baseOptions: Apollo.QueryHookOptions<SurveysQuery, SurveysQueryVariables> & ({ variables: SurveysQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SurveysQuery, SurveysQueryVariables>(SurveysDocument, options);
      }
export function useSurveysLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SurveysQuery, SurveysQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SurveysQuery, SurveysQueryVariables>(SurveysDocument, options);
        }
// @ts-ignore
export function useSurveysSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SurveysQuery, SurveysQueryVariables>): Apollo.UseSuspenseQueryResult<SurveysQuery, SurveysQueryVariables>;
export function useSurveysSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SurveysQuery, SurveysQueryVariables>): Apollo.UseSuspenseQueryResult<SurveysQuery | undefined, SurveysQueryVariables>;
export function useSurveysSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SurveysQuery, SurveysQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SurveysQuery, SurveysQueryVariables>(SurveysDocument, options);
        }
export type SurveysQueryHookResult = ReturnType<typeof useSurveysQuery>;
export type SurveysLazyQueryHookResult = ReturnType<typeof useSurveysLazyQuery>;
export type SurveysSuspenseQueryHookResult = ReturnType<typeof useSurveysSuspenseQuery>;
export type SurveysQueryResult = Apollo.QueryResult<SurveysQuery, SurveysQueryVariables>;
export const SurveyColumnsDocument = gql`
    query surveyColumns {
  surveyColumns {
    ...surveyColumnFragment
  }
}
    ${SurveyColumnFragmentFragmentDoc}`;

/**
 * __useSurveyColumnsQuery__
 *
 * To run a query within a React component, call `useSurveyColumnsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSurveyColumnsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSurveyColumnsQuery({
 *   variables: {
 *   },
 * });
 */
export function useSurveyColumnsQuery(baseOptions?: Apollo.QueryHookOptions<SurveyColumnsQuery, SurveyColumnsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SurveyColumnsQuery, SurveyColumnsQueryVariables>(SurveyColumnsDocument, options);
      }
export function useSurveyColumnsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SurveyColumnsQuery, SurveyColumnsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SurveyColumnsQuery, SurveyColumnsQueryVariables>(SurveyColumnsDocument, options);
        }
// @ts-ignore
export function useSurveyColumnsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SurveyColumnsQuery, SurveyColumnsQueryVariables>): Apollo.UseSuspenseQueryResult<SurveyColumnsQuery, SurveyColumnsQueryVariables>;
export function useSurveyColumnsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SurveyColumnsQuery, SurveyColumnsQueryVariables>): Apollo.UseSuspenseQueryResult<SurveyColumnsQuery | undefined, SurveyColumnsQueryVariables>;
export function useSurveyColumnsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SurveyColumnsQuery, SurveyColumnsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SurveyColumnsQuery, SurveyColumnsQueryVariables>(SurveyColumnsDocument, options);
        }
export type SurveyColumnsQueryHookResult = ReturnType<typeof useSurveyColumnsQuery>;
export type SurveyColumnsLazyQueryHookResult = ReturnType<typeof useSurveyColumnsLazyQuery>;
export type SurveyColumnsSuspenseQueryHookResult = ReturnType<typeof useSurveyColumnsSuspenseQuery>;
export type SurveyColumnsQueryResult = Apollo.QueryResult<SurveyColumnsQuery, SurveyColumnsQueryVariables>;
export const UpdateSurveySettingDocument = gql`
    mutation updateSurveySetting($updateSurveySettingInput: UpdateSurveySettingInput!) {
  updateSurveySetting(updateSurveySettingInput: $updateSurveySettingInput) {
    ...surveyColumnFragment
  }
}
    ${SurveyColumnFragmentFragmentDoc}`;
export type UpdateSurveySettingMutationFn = Apollo.MutationFunction<UpdateSurveySettingMutation, UpdateSurveySettingMutationVariables>;

/**
 * __useUpdateSurveySettingMutation__
 *
 * To run a mutation, you first call `useUpdateSurveySettingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateSurveySettingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateSurveySettingMutation, { data, loading, error }] = useUpdateSurveySettingMutation({
 *   variables: {
 *      updateSurveySettingInput: // value for 'updateSurveySettingInput'
 *   },
 * });
 */
export function useUpdateSurveySettingMutation(baseOptions?: Apollo.MutationHookOptions<UpdateSurveySettingMutation, UpdateSurveySettingMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateSurveySettingMutation, UpdateSurveySettingMutationVariables>(UpdateSurveySettingDocument, options);
      }
export type UpdateSurveySettingMutationHookResult = ReturnType<typeof useUpdateSurveySettingMutation>;
export type UpdateSurveySettingMutationResult = Apollo.MutationResult<UpdateSurveySettingMutation>;
export type UpdateSurveySettingMutationOptions = Apollo.BaseMutationOptions<UpdateSurveySettingMutation, UpdateSurveySettingMutationVariables>;
export const CursorPaginatedTagsDocument = gql`
    query cursorPaginatedTags($take: Int, $cursorId: String, $cursorCreatedAt: DateTime) {
  cursorPaginatedTags(
    take: $take
    cursorId: $cursorId
    cursorCreatedAt: $cursorCreatedAt
  ) {
    items {
      ...tagFragment
    }
    hasMore
    nextCursorId
    nextCursorCreatedAt
  }
}
    ${TagFragmentFragmentDoc}`;

/**
 * __useCursorPaginatedTagsQuery__
 *
 * To run a query within a React component, call `useCursorPaginatedTagsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCursorPaginatedTagsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCursorPaginatedTagsQuery({
 *   variables: {
 *      take: // value for 'take'
 *      cursorId: // value for 'cursorId'
 *      cursorCreatedAt: // value for 'cursorCreatedAt'
 *   },
 * });
 */
export function useCursorPaginatedTagsQuery(baseOptions?: Apollo.QueryHookOptions<CursorPaginatedTagsQuery, CursorPaginatedTagsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CursorPaginatedTagsQuery, CursorPaginatedTagsQueryVariables>(CursorPaginatedTagsDocument, options);
      }
export function useCursorPaginatedTagsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CursorPaginatedTagsQuery, CursorPaginatedTagsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CursorPaginatedTagsQuery, CursorPaginatedTagsQueryVariables>(CursorPaginatedTagsDocument, options);
        }
// @ts-ignore
export function useCursorPaginatedTagsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CursorPaginatedTagsQuery, CursorPaginatedTagsQueryVariables>): Apollo.UseSuspenseQueryResult<CursorPaginatedTagsQuery, CursorPaginatedTagsQueryVariables>;
export function useCursorPaginatedTagsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CursorPaginatedTagsQuery, CursorPaginatedTagsQueryVariables>): Apollo.UseSuspenseQueryResult<CursorPaginatedTagsQuery | undefined, CursorPaginatedTagsQueryVariables>;
export function useCursorPaginatedTagsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CursorPaginatedTagsQuery, CursorPaginatedTagsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CursorPaginatedTagsQuery, CursorPaginatedTagsQueryVariables>(CursorPaginatedTagsDocument, options);
        }
export type CursorPaginatedTagsQueryHookResult = ReturnType<typeof useCursorPaginatedTagsQuery>;
export type CursorPaginatedTagsLazyQueryHookResult = ReturnType<typeof useCursorPaginatedTagsLazyQuery>;
export type CursorPaginatedTagsSuspenseQueryHookResult = ReturnType<typeof useCursorPaginatedTagsSuspenseQuery>;
export type CursorPaginatedTagsQueryResult = Apollo.QueryResult<CursorPaginatedTagsQuery, CursorPaginatedTagsQueryVariables>;
export const TagsDocument = gql`
    query tags($skip: Int, $take: Int, $filter: FilterInput) {
  tags(skip: $skip, take: $take, filter: $filter) {
    items {
      ...tagFragment
    }
    count
  }
}
    ${TagFragmentFragmentDoc}`;

/**
 * __useTagsQuery__
 *
 * To run a query within a React component, call `useTagsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTagsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTagsQuery({
 *   variables: {
 *      skip: // value for 'skip'
 *      take: // value for 'take'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useTagsQuery(baseOptions?: Apollo.QueryHookOptions<TagsQuery, TagsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TagsQuery, TagsQueryVariables>(TagsDocument, options);
      }
export function useTagsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TagsQuery, TagsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TagsQuery, TagsQueryVariables>(TagsDocument, options);
        }
// @ts-ignore
export function useTagsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TagsQuery, TagsQueryVariables>): Apollo.UseSuspenseQueryResult<TagsQuery, TagsQueryVariables>;
export function useTagsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TagsQuery, TagsQueryVariables>): Apollo.UseSuspenseQueryResult<TagsQuery | undefined, TagsQueryVariables>;
export function useTagsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TagsQuery, TagsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TagsQuery, TagsQueryVariables>(TagsDocument, options);
        }
export type TagsQueryHookResult = ReturnType<typeof useTagsQuery>;
export type TagsLazyQueryHookResult = ReturnType<typeof useTagsLazyQuery>;
export type TagsSuspenseQueryHookResult = ReturnType<typeof useTagsSuspenseQuery>;
export type TagsQueryResult = Apollo.QueryResult<TagsQuery, TagsQueryVariables>;
export const TagDocument = gql`
    query tag($id: String!) {
  tag(id: $id) {
    ...tagFragment
  }
}
    ${TagFragmentFragmentDoc}`;

/**
 * __useTagQuery__
 *
 * To run a query within a React component, call `useTagQuery` and pass it any options that fit your needs.
 * When your component renders, `useTagQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTagQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useTagQuery(baseOptions: Apollo.QueryHookOptions<TagQuery, TagQueryVariables> & ({ variables: TagQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TagQuery, TagQueryVariables>(TagDocument, options);
      }
export function useTagLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TagQuery, TagQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TagQuery, TagQueryVariables>(TagDocument, options);
        }
// @ts-ignore
export function useTagSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TagQuery, TagQueryVariables>): Apollo.UseSuspenseQueryResult<TagQuery, TagQueryVariables>;
export function useTagSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TagQuery, TagQueryVariables>): Apollo.UseSuspenseQueryResult<TagQuery | undefined, TagQueryVariables>;
export function useTagSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TagQuery, TagQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TagQuery, TagQueryVariables>(TagDocument, options);
        }
export type TagQueryHookResult = ReturnType<typeof useTagQuery>;
export type TagLazyQueryHookResult = ReturnType<typeof useTagLazyQuery>;
export type TagSuspenseQueryHookResult = ReturnType<typeof useTagSuspenseQuery>;
export type TagQueryResult = Apollo.QueryResult<TagQuery, TagQueryVariables>;
export const CreateTagDocument = gql`
    mutation createTag($createTagInput: CreateTagInput!) {
  createTag(createTagInput: $createTagInput) {
    ...tagFragment
  }
}
    ${TagFragmentFragmentDoc}`;
export type CreateTagMutationFn = Apollo.MutationFunction<CreateTagMutation, CreateTagMutationVariables>;

/**
 * __useCreateTagMutation__
 *
 * To run a mutation, you first call `useCreateTagMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateTagMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createTagMutation, { data, loading, error }] = useCreateTagMutation({
 *   variables: {
 *      createTagInput: // value for 'createTagInput'
 *   },
 * });
 */
export function useCreateTagMutation(baseOptions?: Apollo.MutationHookOptions<CreateTagMutation, CreateTagMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateTagMutation, CreateTagMutationVariables>(CreateTagDocument, options);
      }
export type CreateTagMutationHookResult = ReturnType<typeof useCreateTagMutation>;
export type CreateTagMutationResult = Apollo.MutationResult<CreateTagMutation>;
export type CreateTagMutationOptions = Apollo.BaseMutationOptions<CreateTagMutation, CreateTagMutationVariables>;
export const UpdateTagDocument = gql`
    mutation updateTag($updateTagInput: UpdateTagInput!) {
  updateTag(updateTagInput: $updateTagInput) {
    ...tagFragment
  }
}
    ${TagFragmentFragmentDoc}`;
export type UpdateTagMutationFn = Apollo.MutationFunction<UpdateTagMutation, UpdateTagMutationVariables>;

/**
 * __useUpdateTagMutation__
 *
 * To run a mutation, you first call `useUpdateTagMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateTagMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateTagMutation, { data, loading, error }] = useUpdateTagMutation({
 *   variables: {
 *      updateTagInput: // value for 'updateTagInput'
 *   },
 * });
 */
export function useUpdateTagMutation(baseOptions?: Apollo.MutationHookOptions<UpdateTagMutation, UpdateTagMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateTagMutation, UpdateTagMutationVariables>(UpdateTagDocument, options);
      }
export type UpdateTagMutationHookResult = ReturnType<typeof useUpdateTagMutation>;
export type UpdateTagMutationResult = Apollo.MutationResult<UpdateTagMutation>;
export type UpdateTagMutationOptions = Apollo.BaseMutationOptions<UpdateTagMutation, UpdateTagMutationVariables>;
export const ToggleTagStatusDocument = gql`
    mutation toggleTagStatus($id: String!) {
  toggleTagStatus(id: $id) {
    ...tagFragment
  }
}
    ${TagFragmentFragmentDoc}`;
export type ToggleTagStatusMutationFn = Apollo.MutationFunction<ToggleTagStatusMutation, ToggleTagStatusMutationVariables>;

/**
 * __useToggleTagStatusMutation__
 *
 * To run a mutation, you first call `useToggleTagStatusMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useToggleTagStatusMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [toggleTagStatusMutation, { data, loading, error }] = useToggleTagStatusMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useToggleTagStatusMutation(baseOptions?: Apollo.MutationHookOptions<ToggleTagStatusMutation, ToggleTagStatusMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ToggleTagStatusMutation, ToggleTagStatusMutationVariables>(ToggleTagStatusDocument, options);
      }
export type ToggleTagStatusMutationHookResult = ReturnType<typeof useToggleTagStatusMutation>;
export type ToggleTagStatusMutationResult = Apollo.MutationResult<ToggleTagStatusMutation>;
export type ToggleTagStatusMutationOptions = Apollo.BaseMutationOptions<ToggleTagStatusMutation, ToggleTagStatusMutationVariables>;
export const DisableTagDocument = gql`
    mutation disableTag($id: String!) {
  disableTag(id: $id) {
    ...tagFragment
  }
}
    ${TagFragmentFragmentDoc}`;
export type DisableTagMutationFn = Apollo.MutationFunction<DisableTagMutation, DisableTagMutationVariables>;

/**
 * __useDisableTagMutation__
 *
 * To run a mutation, you first call `useDisableTagMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDisableTagMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [disableTagMutation, { data, loading, error }] = useDisableTagMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDisableTagMutation(baseOptions?: Apollo.MutationHookOptions<DisableTagMutation, DisableTagMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DisableTagMutation, DisableTagMutationVariables>(DisableTagDocument, options);
      }
export type DisableTagMutationHookResult = ReturnType<typeof useDisableTagMutation>;
export type DisableTagMutationResult = Apollo.MutationResult<DisableTagMutation>;
export type DisableTagMutationOptions = Apollo.BaseMutationOptions<DisableTagMutation, DisableTagMutationVariables>;
export const TeamDocument = gql`
    query team($id: String!, $organizationId: String) {
  team(id: $id, inputOrganizationId: $organizationId) {
    ...teamFragment
  }
}
    ${TeamFragmentFragmentDoc}`;

/**
 * __useTeamQuery__
 *
 * To run a query within a React component, call `useTeamQuery` and pass it any options that fit your needs.
 * When your component renders, `useTeamQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTeamQuery({
 *   variables: {
 *      id: // value for 'id'
 *      organizationId: // value for 'organizationId'
 *   },
 * });
 */
export function useTeamQuery(baseOptions: Apollo.QueryHookOptions<TeamQuery, TeamQueryVariables> & ({ variables: TeamQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TeamQuery, TeamQueryVariables>(TeamDocument, options);
      }
export function useTeamLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TeamQuery, TeamQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TeamQuery, TeamQueryVariables>(TeamDocument, options);
        }
// @ts-ignore
export function useTeamSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TeamQuery, TeamQueryVariables>): Apollo.UseSuspenseQueryResult<TeamQuery, TeamQueryVariables>;
export function useTeamSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TeamQuery, TeamQueryVariables>): Apollo.UseSuspenseQueryResult<TeamQuery | undefined, TeamQueryVariables>;
export function useTeamSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TeamQuery, TeamQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TeamQuery, TeamQueryVariables>(TeamDocument, options);
        }
export type TeamQueryHookResult = ReturnType<typeof useTeamQuery>;
export type TeamLazyQueryHookResult = ReturnType<typeof useTeamLazyQuery>;
export type TeamSuspenseQueryHookResult = ReturnType<typeof useTeamSuspenseQuery>;
export type TeamQueryResult = Apollo.QueryResult<TeamQuery, TeamQueryVariables>;
export const TeamsDocument = gql`
    query teams {
  teams {
    items {
      ...teamFragment
    }
    count
  }
}
    ${TeamFragmentFragmentDoc}`;

/**
 * __useTeamsQuery__
 *
 * To run a query within a React component, call `useTeamsQuery` and pass it any options that fit your needs.
 * When your component renders, `useTeamsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTeamsQuery({
 *   variables: {
 *   },
 * });
 */
export function useTeamsQuery(baseOptions?: Apollo.QueryHookOptions<TeamsQuery, TeamsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TeamsQuery, TeamsQueryVariables>(TeamsDocument, options);
      }
export function useTeamsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TeamsQuery, TeamsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TeamsQuery, TeamsQueryVariables>(TeamsDocument, options);
        }
// @ts-ignore
export function useTeamsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TeamsQuery, TeamsQueryVariables>): Apollo.UseSuspenseQueryResult<TeamsQuery, TeamsQueryVariables>;
export function useTeamsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TeamsQuery, TeamsQueryVariables>): Apollo.UseSuspenseQueryResult<TeamsQuery | undefined, TeamsQueryVariables>;
export function useTeamsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TeamsQuery, TeamsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TeamsQuery, TeamsQueryVariables>(TeamsDocument, options);
        }
export type TeamsQueryHookResult = ReturnType<typeof useTeamsQuery>;
export type TeamsLazyQueryHookResult = ReturnType<typeof useTeamsLazyQuery>;
export type TeamsSuspenseQueryHookResult = ReturnType<typeof useTeamsSuspenseQuery>;
export type TeamsQueryResult = Apollo.QueryResult<TeamsQuery, TeamsQueryVariables>;
export const PaginatedTeamsDocument = gql`
    query paginatedTeams($skip: Int, $take: Int, $organizationId: String, $filter: FilterInput) {
  teams(
    skip: $skip
    take: $take
    inputOrganizationId: $organizationId
    filter: $filter
  ) {
    items {
      ...teamFragment
    }
    count
  }
}
    ${TeamFragmentFragmentDoc}`;

/**
 * __usePaginatedTeamsQuery__
 *
 * To run a query within a React component, call `usePaginatedTeamsQuery` and pass it any options that fit your needs.
 * When your component renders, `usePaginatedTeamsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePaginatedTeamsQuery({
 *   variables: {
 *      skip: // value for 'skip'
 *      take: // value for 'take'
 *      organizationId: // value for 'organizationId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function usePaginatedTeamsQuery(baseOptions?: Apollo.QueryHookOptions<PaginatedTeamsQuery, PaginatedTeamsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PaginatedTeamsQuery, PaginatedTeamsQueryVariables>(PaginatedTeamsDocument, options);
      }
export function usePaginatedTeamsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PaginatedTeamsQuery, PaginatedTeamsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PaginatedTeamsQuery, PaginatedTeamsQueryVariables>(PaginatedTeamsDocument, options);
        }
// @ts-ignore
export function usePaginatedTeamsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<PaginatedTeamsQuery, PaginatedTeamsQueryVariables>): Apollo.UseSuspenseQueryResult<PaginatedTeamsQuery, PaginatedTeamsQueryVariables>;
export function usePaginatedTeamsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<PaginatedTeamsQuery, PaginatedTeamsQueryVariables>): Apollo.UseSuspenseQueryResult<PaginatedTeamsQuery | undefined, PaginatedTeamsQueryVariables>;
export function usePaginatedTeamsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<PaginatedTeamsQuery, PaginatedTeamsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<PaginatedTeamsQuery, PaginatedTeamsQueryVariables>(PaginatedTeamsDocument, options);
        }
export type PaginatedTeamsQueryHookResult = ReturnType<typeof usePaginatedTeamsQuery>;
export type PaginatedTeamsLazyQueryHookResult = ReturnType<typeof usePaginatedTeamsLazyQuery>;
export type PaginatedTeamsSuspenseQueryHookResult = ReturnType<typeof usePaginatedTeamsSuspenseQuery>;
export type PaginatedTeamsQueryResult = Apollo.QueryResult<PaginatedTeamsQuery, PaginatedTeamsQueryVariables>;
export const TeamsInChatDocument = gql`
    query teamsInChat($chatId: String!) {
  teamsInChat(chatId: $chatId) {
    id
    name
    isDefault
    operators {
      ...userFragment
    }
  }
}
    ${UserFragmentFragmentDoc}`;

/**
 * __useTeamsInChatQuery__
 *
 * To run a query within a React component, call `useTeamsInChatQuery` and pass it any options that fit your needs.
 * When your component renders, `useTeamsInChatQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useTeamsInChatQuery({
 *   variables: {
 *      chatId: // value for 'chatId'
 *   },
 * });
 */
export function useTeamsInChatQuery(baseOptions: Apollo.QueryHookOptions<TeamsInChatQuery, TeamsInChatQueryVariables> & ({ variables: TeamsInChatQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<TeamsInChatQuery, TeamsInChatQueryVariables>(TeamsInChatDocument, options);
      }
export function useTeamsInChatLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<TeamsInChatQuery, TeamsInChatQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<TeamsInChatQuery, TeamsInChatQueryVariables>(TeamsInChatDocument, options);
        }
// @ts-ignore
export function useTeamsInChatSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<TeamsInChatQuery, TeamsInChatQueryVariables>): Apollo.UseSuspenseQueryResult<TeamsInChatQuery, TeamsInChatQueryVariables>;
export function useTeamsInChatSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TeamsInChatQuery, TeamsInChatQueryVariables>): Apollo.UseSuspenseQueryResult<TeamsInChatQuery | undefined, TeamsInChatQueryVariables>;
export function useTeamsInChatSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<TeamsInChatQuery, TeamsInChatQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<TeamsInChatQuery, TeamsInChatQueryVariables>(TeamsInChatDocument, options);
        }
export type TeamsInChatQueryHookResult = ReturnType<typeof useTeamsInChatQuery>;
export type TeamsInChatLazyQueryHookResult = ReturnType<typeof useTeamsInChatLazyQuery>;
export type TeamsInChatSuspenseQueryHookResult = ReturnType<typeof useTeamsInChatSuspenseQuery>;
export type TeamsInChatQueryResult = Apollo.QueryResult<TeamsInChatQuery, TeamsInChatQueryVariables>;
export const SelectableTeamsDocument = gql`
    query selectableTeams {
  selectableTeams {
    ...selectabeTeamFragment
  }
}
    ${SelectabeTeamFragmentFragmentDoc}`;

/**
 * __useSelectableTeamsQuery__
 *
 * To run a query within a React component, call `useSelectableTeamsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSelectableTeamsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSelectableTeamsQuery({
 *   variables: {
 *   },
 * });
 */
export function useSelectableTeamsQuery(baseOptions?: Apollo.QueryHookOptions<SelectableTeamsQuery, SelectableTeamsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SelectableTeamsQuery, SelectableTeamsQueryVariables>(SelectableTeamsDocument, options);
      }
export function useSelectableTeamsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SelectableTeamsQuery, SelectableTeamsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SelectableTeamsQuery, SelectableTeamsQueryVariables>(SelectableTeamsDocument, options);
        }
// @ts-ignore
export function useSelectableTeamsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SelectableTeamsQuery, SelectableTeamsQueryVariables>): Apollo.UseSuspenseQueryResult<SelectableTeamsQuery, SelectableTeamsQueryVariables>;
export function useSelectableTeamsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SelectableTeamsQuery, SelectableTeamsQueryVariables>): Apollo.UseSuspenseQueryResult<SelectableTeamsQuery | undefined, SelectableTeamsQueryVariables>;
export function useSelectableTeamsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SelectableTeamsQuery, SelectableTeamsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SelectableTeamsQuery, SelectableTeamsQueryVariables>(SelectableTeamsDocument, options);
        }
export type SelectableTeamsQueryHookResult = ReturnType<typeof useSelectableTeamsQuery>;
export type SelectableTeamsLazyQueryHookResult = ReturnType<typeof useSelectableTeamsLazyQuery>;
export type SelectableTeamsSuspenseQueryHookResult = ReturnType<typeof useSelectableTeamsSuspenseQuery>;
export type SelectableTeamsQueryResult = Apollo.QueryResult<SelectableTeamsQuery, SelectableTeamsQueryVariables>;
export const SelectableTeamsForChatFilterDocument = gql`
    query selectableTeamsForChatFilter {
  selectableTeamsForChatFilter {
    ...selectabeTeamFragment
  }
}
    ${SelectabeTeamFragmentFragmentDoc}`;

/**
 * __useSelectableTeamsForChatFilterQuery__
 *
 * To run a query within a React component, call `useSelectableTeamsForChatFilterQuery` and pass it any options that fit your needs.
 * When your component renders, `useSelectableTeamsForChatFilterQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSelectableTeamsForChatFilterQuery({
 *   variables: {
 *   },
 * });
 */
export function useSelectableTeamsForChatFilterQuery(baseOptions?: Apollo.QueryHookOptions<SelectableTeamsForChatFilterQuery, SelectableTeamsForChatFilterQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<SelectableTeamsForChatFilterQuery, SelectableTeamsForChatFilterQueryVariables>(SelectableTeamsForChatFilterDocument, options);
      }
export function useSelectableTeamsForChatFilterLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<SelectableTeamsForChatFilterQuery, SelectableTeamsForChatFilterQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<SelectableTeamsForChatFilterQuery, SelectableTeamsForChatFilterQueryVariables>(SelectableTeamsForChatFilterDocument, options);
        }
// @ts-ignore
export function useSelectableTeamsForChatFilterSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<SelectableTeamsForChatFilterQuery, SelectableTeamsForChatFilterQueryVariables>): Apollo.UseSuspenseQueryResult<SelectableTeamsForChatFilterQuery, SelectableTeamsForChatFilterQueryVariables>;
export function useSelectableTeamsForChatFilterSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SelectableTeamsForChatFilterQuery, SelectableTeamsForChatFilterQueryVariables>): Apollo.UseSuspenseQueryResult<SelectableTeamsForChatFilterQuery | undefined, SelectableTeamsForChatFilterQueryVariables>;
export function useSelectableTeamsForChatFilterSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<SelectableTeamsForChatFilterQuery, SelectableTeamsForChatFilterQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<SelectableTeamsForChatFilterQuery, SelectableTeamsForChatFilterQueryVariables>(SelectableTeamsForChatFilterDocument, options);
        }
export type SelectableTeamsForChatFilterQueryHookResult = ReturnType<typeof useSelectableTeamsForChatFilterQuery>;
export type SelectableTeamsForChatFilterLazyQueryHookResult = ReturnType<typeof useSelectableTeamsForChatFilterLazyQuery>;
export type SelectableTeamsForChatFilterSuspenseQueryHookResult = ReturnType<typeof useSelectableTeamsForChatFilterSuspenseQuery>;
export type SelectableTeamsForChatFilterQueryResult = Apollo.QueryResult<SelectableTeamsForChatFilterQuery, SelectableTeamsForChatFilterQueryVariables>;
export const CreateTeamDocument = gql`
    mutation createTeam($createTeamInput: CreateTeamInput!, $organizationId: String) {
  createTeam(
    createTeamInput: $createTeamInput
    inputOrganizationId: $organizationId
  ) {
    ...teamFragment
  }
}
    ${TeamFragmentFragmentDoc}`;
export type CreateTeamMutationFn = Apollo.MutationFunction<CreateTeamMutation, CreateTeamMutationVariables>;

/**
 * __useCreateTeamMutation__
 *
 * To run a mutation, you first call `useCreateTeamMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateTeamMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createTeamMutation, { data, loading, error }] = useCreateTeamMutation({
 *   variables: {
 *      createTeamInput: // value for 'createTeamInput'
 *      organizationId: // value for 'organizationId'
 *   },
 * });
 */
export function useCreateTeamMutation(baseOptions?: Apollo.MutationHookOptions<CreateTeamMutation, CreateTeamMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateTeamMutation, CreateTeamMutationVariables>(CreateTeamDocument, options);
      }
export type CreateTeamMutationHookResult = ReturnType<typeof useCreateTeamMutation>;
export type CreateTeamMutationResult = Apollo.MutationResult<CreateTeamMutation>;
export type CreateTeamMutationOptions = Apollo.BaseMutationOptions<CreateTeamMutation, CreateTeamMutationVariables>;
export const UpdateTeamDocument = gql`
    mutation updateTeam($updateTeamInput: UpdateTeamInput!, $organizationId: String) {
  updateTeam(
    updateTeamInput: $updateTeamInput
    inputOrganizationId: $organizationId
  ) {
    ...teamFragment
  }
}
    ${TeamFragmentFragmentDoc}`;
export type UpdateTeamMutationFn = Apollo.MutationFunction<UpdateTeamMutation, UpdateTeamMutationVariables>;

/**
 * __useUpdateTeamMutation__
 *
 * To run a mutation, you first call `useUpdateTeamMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateTeamMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateTeamMutation, { data, loading, error }] = useUpdateTeamMutation({
 *   variables: {
 *      updateTeamInput: // value for 'updateTeamInput'
 *      organizationId: // value for 'organizationId'
 *   },
 * });
 */
export function useUpdateTeamMutation(baseOptions?: Apollo.MutationHookOptions<UpdateTeamMutation, UpdateTeamMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateTeamMutation, UpdateTeamMutationVariables>(UpdateTeamDocument, options);
      }
export type UpdateTeamMutationHookResult = ReturnType<typeof useUpdateTeamMutation>;
export type UpdateTeamMutationResult = Apollo.MutationResult<UpdateTeamMutation>;
export type UpdateTeamMutationOptions = Apollo.BaseMutationOptions<UpdateTeamMutation, UpdateTeamMutationVariables>;
export const ToggleTeamStatusDocument = gql`
    mutation toggleTeamStatus($id: String!, $organizationId: String) {
  toggleTeamStatus(id: $id, inputOrganizationId: $organizationId) {
    ...teamFragment
  }
}
    ${TeamFragmentFragmentDoc}`;
export type ToggleTeamStatusMutationFn = Apollo.MutationFunction<ToggleTeamStatusMutation, ToggleTeamStatusMutationVariables>;

/**
 * __useToggleTeamStatusMutation__
 *
 * To run a mutation, you first call `useToggleTeamStatusMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useToggleTeamStatusMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [toggleTeamStatusMutation, { data, loading, error }] = useToggleTeamStatusMutation({
 *   variables: {
 *      id: // value for 'id'
 *      organizationId: // value for 'organizationId'
 *   },
 * });
 */
export function useToggleTeamStatusMutation(baseOptions?: Apollo.MutationHookOptions<ToggleTeamStatusMutation, ToggleTeamStatusMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ToggleTeamStatusMutation, ToggleTeamStatusMutationVariables>(ToggleTeamStatusDocument, options);
      }
export type ToggleTeamStatusMutationHookResult = ReturnType<typeof useToggleTeamStatusMutation>;
export type ToggleTeamStatusMutationResult = Apollo.MutationResult<ToggleTeamStatusMutation>;
export type ToggleTeamStatusMutationOptions = Apollo.BaseMutationOptions<ToggleTeamStatusMutation, ToggleTeamStatusMutationVariables>;
export const DisableTeamDocument = gql`
    mutation disableTeam($disableTeamId: String!, $organizationId: String) {
  disableTeam(id: $disableTeamId, inputOrganizationId: $organizationId) {
    ...teamFragment
  }
}
    ${TeamFragmentFragmentDoc}`;
export type DisableTeamMutationFn = Apollo.MutationFunction<DisableTeamMutation, DisableTeamMutationVariables>;

/**
 * __useDisableTeamMutation__
 *
 * To run a mutation, you first call `useDisableTeamMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDisableTeamMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [disableTeamMutation, { data, loading, error }] = useDisableTeamMutation({
 *   variables: {
 *      disableTeamId: // value for 'disableTeamId'
 *      organizationId: // value for 'organizationId'
 *   },
 * });
 */
export function useDisableTeamMutation(baseOptions?: Apollo.MutationHookOptions<DisableTeamMutation, DisableTeamMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DisableTeamMutation, DisableTeamMutationVariables>(DisableTeamDocument, options);
      }
export type DisableTeamMutationHookResult = ReturnType<typeof useDisableTeamMutation>;
export type DisableTeamMutationResult = Apollo.MutationResult<DisableTeamMutation>;
export type DisableTeamMutationOptions = Apollo.BaseMutationOptions<DisableTeamMutation, DisableTeamMutationVariables>;
export const MeDocument = gql`
    query me {
  me {
    ...userFragment
  }
}
    ${UserFragmentFragmentDoc}`;

/**
 * __useMeQuery__
 *
 * To run a query within a React component, call `useMeQuery` and pass it any options that fit your needs.
 * When your component renders, `useMeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMeQuery({
 *   variables: {
 *   },
 * });
 */
export function useMeQuery(baseOptions?: Apollo.QueryHookOptions<MeQuery, MeQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<MeQuery, MeQueryVariables>(MeDocument, options);
      }
export function useMeLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<MeQuery, MeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<MeQuery, MeQueryVariables>(MeDocument, options);
        }
// @ts-ignore
export function useMeSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<MeQuery, MeQueryVariables>): Apollo.UseSuspenseQueryResult<MeQuery, MeQueryVariables>;
export function useMeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<MeQuery, MeQueryVariables>): Apollo.UseSuspenseQueryResult<MeQuery | undefined, MeQueryVariables>;
export function useMeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<MeQuery, MeQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<MeQuery, MeQueryVariables>(MeDocument, options);
        }
export type MeQueryHookResult = ReturnType<typeof useMeQuery>;
export type MeLazyQueryHookResult = ReturnType<typeof useMeLazyQuery>;
export type MeSuspenseQueryHookResult = ReturnType<typeof useMeSuspenseQuery>;
export type MeQueryResult = Apollo.QueryResult<MeQuery, MeQueryVariables>;
export const ManagersDocument = gql`
    query managers($organizationId: String, $cursorId: String, $cursorCreatedAt: DateTime, $take: Int) {
  managers(
    inputOrganizationId: $organizationId
    cursorId: $cursorId
    cursorCreatedAt: $cursorCreatedAt
    take: $take
  ) {
    items {
      ...userFragment
    }
    hasMore
    nextCursorId
    nextCursorCreatedAt
  }
}
    ${UserFragmentFragmentDoc}`;

/**
 * __useManagersQuery__
 *
 * To run a query within a React component, call `useManagersQuery` and pass it any options that fit your needs.
 * When your component renders, `useManagersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useManagersQuery({
 *   variables: {
 *      organizationId: // value for 'organizationId'
 *      cursorId: // value for 'cursorId'
 *      cursorCreatedAt: // value for 'cursorCreatedAt'
 *      take: // value for 'take'
 *   },
 * });
 */
export function useManagersQuery(baseOptions?: Apollo.QueryHookOptions<ManagersQuery, ManagersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ManagersQuery, ManagersQueryVariables>(ManagersDocument, options);
      }
export function useManagersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ManagersQuery, ManagersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ManagersQuery, ManagersQueryVariables>(ManagersDocument, options);
        }
// @ts-ignore
export function useManagersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<ManagersQuery, ManagersQueryVariables>): Apollo.UseSuspenseQueryResult<ManagersQuery, ManagersQueryVariables>;
export function useManagersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ManagersQuery, ManagersQueryVariables>): Apollo.UseSuspenseQueryResult<ManagersQuery | undefined, ManagersQueryVariables>;
export function useManagersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ManagersQuery, ManagersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ManagersQuery, ManagersQueryVariables>(ManagersDocument, options);
        }
export type ManagersQueryHookResult = ReturnType<typeof useManagersQuery>;
export type ManagersLazyQueryHookResult = ReturnType<typeof useManagersLazyQuery>;
export type ManagersSuspenseQueryHookResult = ReturnType<typeof useManagersSuspenseQuery>;
export type ManagersQueryResult = Apollo.QueryResult<ManagersQuery, ManagersQueryVariables>;
export const AllSelectableOperatorsDocument = gql`
    query allSelectableOperators($organizationId: String, $cursorId: String, $cursorCreatedAt: DateTime, $take: Int) {
  allSelectableOperators(
    inputOrganizationId: $organizationId
    cursorId: $cursorId
    cursorCreatedAt: $cursorCreatedAt
    take: $take
  ) {
    items {
      ...userFragment
    }
    hasMore
    nextCursorId
    nextCursorCreatedAt
  }
}
    ${UserFragmentFragmentDoc}`;

/**
 * __useAllSelectableOperatorsQuery__
 *
 * To run a query within a React component, call `useAllSelectableOperatorsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAllSelectableOperatorsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAllSelectableOperatorsQuery({
 *   variables: {
 *      organizationId: // value for 'organizationId'
 *      cursorId: // value for 'cursorId'
 *      cursorCreatedAt: // value for 'cursorCreatedAt'
 *      take: // value for 'take'
 *   },
 * });
 */
export function useAllSelectableOperatorsQuery(baseOptions?: Apollo.QueryHookOptions<AllSelectableOperatorsQuery, AllSelectableOperatorsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AllSelectableOperatorsQuery, AllSelectableOperatorsQueryVariables>(AllSelectableOperatorsDocument, options);
      }
export function useAllSelectableOperatorsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AllSelectableOperatorsQuery, AllSelectableOperatorsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AllSelectableOperatorsQuery, AllSelectableOperatorsQueryVariables>(AllSelectableOperatorsDocument, options);
        }
// @ts-ignore
export function useAllSelectableOperatorsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AllSelectableOperatorsQuery, AllSelectableOperatorsQueryVariables>): Apollo.UseSuspenseQueryResult<AllSelectableOperatorsQuery, AllSelectableOperatorsQueryVariables>;
export function useAllSelectableOperatorsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllSelectableOperatorsQuery, AllSelectableOperatorsQueryVariables>): Apollo.UseSuspenseQueryResult<AllSelectableOperatorsQuery | undefined, AllSelectableOperatorsQueryVariables>;
export function useAllSelectableOperatorsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AllSelectableOperatorsQuery, AllSelectableOperatorsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AllSelectableOperatorsQuery, AllSelectableOperatorsQueryVariables>(AllSelectableOperatorsDocument, options);
        }
export type AllSelectableOperatorsQueryHookResult = ReturnType<typeof useAllSelectableOperatorsQuery>;
export type AllSelectableOperatorsLazyQueryHookResult = ReturnType<typeof useAllSelectableOperatorsLazyQuery>;
export type AllSelectableOperatorsSuspenseQueryHookResult = ReturnType<typeof useAllSelectableOperatorsSuspenseQuery>;
export type AllSelectableOperatorsQueryResult = Apollo.QueryResult<AllSelectableOperatorsQuery, AllSelectableOperatorsQueryVariables>;
export const AdminOperatorsDocument = gql`
    query adminOperators($take: Int, $cursorId: String, $cursorCreatedAt: DateTime) {
  adminOperators(
    take: $take
    cursorId: $cursorId
    cursorCreatedAt: $cursorCreatedAt
  ) {
    items {
      ...userFragment
    }
    hasMore
    nextCursorId
    nextCursorCreatedAt
  }
}
    ${UserFragmentFragmentDoc}`;

/**
 * __useAdminOperatorsQuery__
 *
 * To run a query within a React component, call `useAdminOperatorsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAdminOperatorsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAdminOperatorsQuery({
 *   variables: {
 *      take: // value for 'take'
 *      cursorId: // value for 'cursorId'
 *      cursorCreatedAt: // value for 'cursorCreatedAt'
 *   },
 * });
 */
export function useAdminOperatorsQuery(baseOptions?: Apollo.QueryHookOptions<AdminOperatorsQuery, AdminOperatorsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AdminOperatorsQuery, AdminOperatorsQueryVariables>(AdminOperatorsDocument, options);
      }
export function useAdminOperatorsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AdminOperatorsQuery, AdminOperatorsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AdminOperatorsQuery, AdminOperatorsQueryVariables>(AdminOperatorsDocument, options);
        }
// @ts-ignore
export function useAdminOperatorsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<AdminOperatorsQuery, AdminOperatorsQueryVariables>): Apollo.UseSuspenseQueryResult<AdminOperatorsQuery, AdminOperatorsQueryVariables>;
export function useAdminOperatorsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AdminOperatorsQuery, AdminOperatorsQueryVariables>): Apollo.UseSuspenseQueryResult<AdminOperatorsQuery | undefined, AdminOperatorsQueryVariables>;
export function useAdminOperatorsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AdminOperatorsQuery, AdminOperatorsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AdminOperatorsQuery, AdminOperatorsQueryVariables>(AdminOperatorsDocument, options);
        }
export type AdminOperatorsQueryHookResult = ReturnType<typeof useAdminOperatorsQuery>;
export type AdminOperatorsLazyQueryHookResult = ReturnType<typeof useAdminOperatorsLazyQuery>;
export type AdminOperatorsSuspenseQueryHookResult = ReturnType<typeof useAdminOperatorsSuspenseQuery>;
export type AdminOperatorsQueryResult = Apollo.QueryResult<AdminOperatorsQuery, AdminOperatorsQueryVariables>;
export const UsersDocument = gql`
    query users($skip: Int, $take: Int, $filter: FilterInput) {
  users(skip: $skip, take: $take, filter: $filter) {
    items {
      ...userFragment
    }
    count
  }
  operatorCount
  maxOperatorCount
}
    ${UserFragmentFragmentDoc}`;

/**
 * __useUsersQuery__
 *
 * To run a query within a React component, call `useUsersQuery` and pass it any options that fit your needs.
 * When your component renders, `useUsersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useUsersQuery({
 *   variables: {
 *      skip: // value for 'skip'
 *      take: // value for 'take'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useUsersQuery(baseOptions?: Apollo.QueryHookOptions<UsersQuery, UsersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<UsersQuery, UsersQueryVariables>(UsersDocument, options);
      }
export function useUsersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<UsersQuery, UsersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<UsersQuery, UsersQueryVariables>(UsersDocument, options);
        }
// @ts-ignore
export function useUsersSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<UsersQuery, UsersQueryVariables>): Apollo.UseSuspenseQueryResult<UsersQuery, UsersQueryVariables>;
export function useUsersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<UsersQuery, UsersQueryVariables>): Apollo.UseSuspenseQueryResult<UsersQuery | undefined, UsersQueryVariables>;
export function useUsersSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<UsersQuery, UsersQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<UsersQuery, UsersQueryVariables>(UsersDocument, options);
        }
export type UsersQueryHookResult = ReturnType<typeof useUsersQuery>;
export type UsersLazyQueryHookResult = ReturnType<typeof useUsersLazyQuery>;
export type UsersSuspenseQueryHookResult = ReturnType<typeof useUsersSuspenseQuery>;
export type UsersQueryResult = Apollo.QueryResult<UsersQuery, UsersQueryVariables>;
export const UserDocument = gql`
    query user($id: String!) {
  user(id: $id) {
    ...userFragment
  }
}
    ${UserFragmentFragmentDoc}`;

/**
 * __useUserQuery__
 *
 * To run a query within a React component, call `useUserQuery` and pass it any options that fit your needs.
 * When your component renders, `useUserQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useUserQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useUserQuery(baseOptions: Apollo.QueryHookOptions<UserQuery, UserQueryVariables> & ({ variables: UserQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<UserQuery, UserQueryVariables>(UserDocument, options);
      }
export function useUserLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<UserQuery, UserQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<UserQuery, UserQueryVariables>(UserDocument, options);
        }
// @ts-ignore
export function useUserSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<UserQuery, UserQueryVariables>): Apollo.UseSuspenseQueryResult<UserQuery, UserQueryVariables>;
export function useUserSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<UserQuery, UserQueryVariables>): Apollo.UseSuspenseQueryResult<UserQuery | undefined, UserQueryVariables>;
export function useUserSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<UserQuery, UserQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<UserQuery, UserQueryVariables>(UserDocument, options);
        }
export type UserQueryHookResult = ReturnType<typeof useUserQuery>;
export type UserLazyQueryHookResult = ReturnType<typeof useUserLazyQuery>;
export type UserSuspenseQueryHookResult = ReturnType<typeof useUserSuspenseQuery>;
export type UserQueryResult = Apollo.QueryResult<UserQuery, UserQueryVariables>;
export const CheckUserExistsDocument = gql`
    query checkUserExists($email: String!) {
  checkUserExists(email: $email)
}
    `;

/**
 * __useCheckUserExistsQuery__
 *
 * To run a query within a React component, call `useCheckUserExistsQuery` and pass it any options that fit your needs.
 * When your component renders, `useCheckUserExistsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCheckUserExistsQuery({
 *   variables: {
 *      email: // value for 'email'
 *   },
 * });
 */
export function useCheckUserExistsQuery(baseOptions: Apollo.QueryHookOptions<CheckUserExistsQuery, CheckUserExistsQueryVariables> & ({ variables: CheckUserExistsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<CheckUserExistsQuery, CheckUserExistsQueryVariables>(CheckUserExistsDocument, options);
      }
export function useCheckUserExistsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<CheckUserExistsQuery, CheckUserExistsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<CheckUserExistsQuery, CheckUserExistsQueryVariables>(CheckUserExistsDocument, options);
        }
// @ts-ignore
export function useCheckUserExistsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<CheckUserExistsQuery, CheckUserExistsQueryVariables>): Apollo.UseSuspenseQueryResult<CheckUserExistsQuery, CheckUserExistsQueryVariables>;
export function useCheckUserExistsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CheckUserExistsQuery, CheckUserExistsQueryVariables>): Apollo.UseSuspenseQueryResult<CheckUserExistsQuery | undefined, CheckUserExistsQueryVariables>;
export function useCheckUserExistsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<CheckUserExistsQuery, CheckUserExistsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<CheckUserExistsQuery, CheckUserExistsQueryVariables>(CheckUserExistsDocument, options);
        }
export type CheckUserExistsQueryHookResult = ReturnType<typeof useCheckUserExistsQuery>;
export type CheckUserExistsLazyQueryHookResult = ReturnType<typeof useCheckUserExistsLazyQuery>;
export type CheckUserExistsSuspenseQueryHookResult = ReturnType<typeof useCheckUserExistsSuspenseQuery>;
export type CheckUserExistsQueryResult = Apollo.QueryResult<CheckUserExistsQuery, CheckUserExistsQueryVariables>;
export const CreateUserDocument = gql`
    mutation createUser($createUserInput: CreateUserInput!) {
  createUser(createUserInput: $createUserInput) {
    ...userFragment
  }
}
    ${UserFragmentFragmentDoc}`;
export type CreateUserMutationFn = Apollo.MutationFunction<CreateUserMutation, CreateUserMutationVariables>;

/**
 * __useCreateUserMutation__
 *
 * To run a mutation, you first call `useCreateUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createUserMutation, { data, loading, error }] = useCreateUserMutation({
 *   variables: {
 *      createUserInput: // value for 'createUserInput'
 *   },
 * });
 */
export function useCreateUserMutation(baseOptions?: Apollo.MutationHookOptions<CreateUserMutation, CreateUserMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateUserMutation, CreateUserMutationVariables>(CreateUserDocument, options);
      }
export type CreateUserMutationHookResult = ReturnType<typeof useCreateUserMutation>;
export type CreateUserMutationResult = Apollo.MutationResult<CreateUserMutation>;
export type CreateUserMutationOptions = Apollo.BaseMutationOptions<CreateUserMutation, CreateUserMutationVariables>;
export const UpdateUserDocument = gql`
    mutation updateUser($updateUserInput: UpdateUserInput!) {
  updateUser(updateUserInput: $updateUserInput) {
    ...userFragment
  }
}
    ${UserFragmentFragmentDoc}`;
export type UpdateUserMutationFn = Apollo.MutationFunction<UpdateUserMutation, UpdateUserMutationVariables>;

/**
 * __useUpdateUserMutation__
 *
 * To run a mutation, you first call `useUpdateUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateUserMutation, { data, loading, error }] = useUpdateUserMutation({
 *   variables: {
 *      updateUserInput: // value for 'updateUserInput'
 *   },
 * });
 */
export function useUpdateUserMutation(baseOptions?: Apollo.MutationHookOptions<UpdateUserMutation, UpdateUserMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateUserMutation, UpdateUserMutationVariables>(UpdateUserDocument, options);
      }
export type UpdateUserMutationHookResult = ReturnType<typeof useUpdateUserMutation>;
export type UpdateUserMutationResult = Apollo.MutationResult<UpdateUserMutation>;
export type UpdateUserMutationOptions = Apollo.BaseMutationOptions<UpdateUserMutation, UpdateUserMutationVariables>;
export const ToggleUserStatusDocument = gql`
    mutation toggleUserStatus($id: String!) {
  toggleUserStatus(id: $id) {
    ...userFragment
  }
}
    ${UserFragmentFragmentDoc}`;
export type ToggleUserStatusMutationFn = Apollo.MutationFunction<ToggleUserStatusMutation, ToggleUserStatusMutationVariables>;

/**
 * __useToggleUserStatusMutation__
 *
 * To run a mutation, you first call `useToggleUserStatusMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useToggleUserStatusMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [toggleUserStatusMutation, { data, loading, error }] = useToggleUserStatusMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useToggleUserStatusMutation(baseOptions?: Apollo.MutationHookOptions<ToggleUserStatusMutation, ToggleUserStatusMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ToggleUserStatusMutation, ToggleUserStatusMutationVariables>(ToggleUserStatusDocument, options);
      }
export type ToggleUserStatusMutationHookResult = ReturnType<typeof useToggleUserStatusMutation>;
export type ToggleUserStatusMutationResult = Apollo.MutationResult<ToggleUserStatusMutation>;
export type ToggleUserStatusMutationOptions = Apollo.BaseMutationOptions<ToggleUserStatusMutation, ToggleUserStatusMutationVariables>;
export const RemoveUserDocument = gql`
    mutation removeUser($id: String!) {
  removeUser(id: $id)
}
    `;
export type RemoveUserMutationFn = Apollo.MutationFunction<RemoveUserMutation, RemoveUserMutationVariables>;

/**
 * __useRemoveUserMutation__
 *
 * To run a mutation, you first call `useRemoveUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRemoveUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [removeUserMutation, { data, loading, error }] = useRemoveUserMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRemoveUserMutation(baseOptions?: Apollo.MutationHookOptions<RemoveUserMutation, RemoveUserMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RemoveUserMutation, RemoveUserMutationVariables>(RemoveUserDocument, options);
      }
export type RemoveUserMutationHookResult = ReturnType<typeof useRemoveUserMutation>;
export type RemoveUserMutationResult = Apollo.MutationResult<RemoveUserMutation>;
export type RemoveUserMutationOptions = Apollo.BaseMutationOptions<RemoveUserMutation, RemoveUserMutationVariables>;
export const UpdateDisplayNameDocument = gql`
    mutation updateDisplayName($updateDisplayNameInput: UpdateDisplayNameInput!) {
  updateDisplayName(updateDisplayNameInput: $updateDisplayNameInput) {
    ...userFragment
  }
}
    ${UserFragmentFragmentDoc}`;
export type UpdateDisplayNameMutationFn = Apollo.MutationFunction<UpdateDisplayNameMutation, UpdateDisplayNameMutationVariables>;

/**
 * __useUpdateDisplayNameMutation__
 *
 * To run a mutation, you first call `useUpdateDisplayNameMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateDisplayNameMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateDisplayNameMutation, { data, loading, error }] = useUpdateDisplayNameMutation({
 *   variables: {
 *      updateDisplayNameInput: // value for 'updateDisplayNameInput'
 *   },
 * });
 */
export function useUpdateDisplayNameMutation(baseOptions?: Apollo.MutationHookOptions<UpdateDisplayNameMutation, UpdateDisplayNameMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateDisplayNameMutation, UpdateDisplayNameMutationVariables>(UpdateDisplayNameDocument, options);
      }
export type UpdateDisplayNameMutationHookResult = ReturnType<typeof useUpdateDisplayNameMutation>;
export type UpdateDisplayNameMutationResult = Apollo.MutationResult<UpdateDisplayNameMutation>;
export type UpdateDisplayNameMutationOptions = Apollo.BaseMutationOptions<UpdateDisplayNameMutation, UpdateDisplayNameMutationVariables>;
export const UpdateSenderNameDocument = gql`
    mutation updateSenderName($updateSenderNameInput: UpdateSenderNameInput!) {
  updateSenderName(updateSenderNameInput: $updateSenderNameInput) {
    ...userFragment
  }
}
    ${UserFragmentFragmentDoc}`;
export type UpdateSenderNameMutationFn = Apollo.MutationFunction<UpdateSenderNameMutation, UpdateSenderNameMutationVariables>;

/**
 * __useUpdateSenderNameMutation__
 *
 * To run a mutation, you first call `useUpdateSenderNameMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateSenderNameMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateSenderNameMutation, { data, loading, error }] = useUpdateSenderNameMutation({
 *   variables: {
 *      updateSenderNameInput: // value for 'updateSenderNameInput'
 *   },
 * });
 */
export function useUpdateSenderNameMutation(baseOptions?: Apollo.MutationHookOptions<UpdateSenderNameMutation, UpdateSenderNameMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateSenderNameMutation, UpdateSenderNameMutationVariables>(UpdateSenderNameDocument, options);
      }
export type UpdateSenderNameMutationHookResult = ReturnType<typeof useUpdateSenderNameMutation>;
export type UpdateSenderNameMutationResult = Apollo.MutationResult<UpdateSenderNameMutation>;
export type UpdateSenderNameMutationOptions = Apollo.BaseMutationOptions<UpdateSenderNameMutation, UpdateSenderNameMutationVariables>;
export const ResetPasswordDocument = gql`
    mutation resetPassword($resetPasswordInput: ResetPasswordInput!) {
  resetPassword(resetPasswordInput: $resetPasswordInput) {
    ...userFragment
  }
}
    ${UserFragmentFragmentDoc}`;
export type ResetPasswordMutationFn = Apollo.MutationFunction<ResetPasswordMutation, ResetPasswordMutationVariables>;

/**
 * __useResetPasswordMutation__
 *
 * To run a mutation, you first call `useResetPasswordMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useResetPasswordMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [resetPasswordMutation, { data, loading, error }] = useResetPasswordMutation({
 *   variables: {
 *      resetPasswordInput: // value for 'resetPasswordInput'
 *   },
 * });
 */
export function useResetPasswordMutation(baseOptions?: Apollo.MutationHookOptions<ResetPasswordMutation, ResetPasswordMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ResetPasswordMutation, ResetPasswordMutationVariables>(ResetPasswordDocument, options);
      }
export type ResetPasswordMutationHookResult = ReturnType<typeof useResetPasswordMutation>;
export type ResetPasswordMutationResult = Apollo.MutationResult<ResetPasswordMutation>;
export type ResetPasswordMutationOptions = Apollo.BaseMutationOptions<ResetPasswordMutation, ResetPasswordMutationVariables>;