import { type MemberFeedColumn, type SurveyColumn } from '~/generated/graphql/types';
import { type IChatMessage, type IChat, type IChatMessageUpdatePayload } from '~/modules/Chat';
import { type IOrganization } from '~/modules/Organizations';
import { type IUser } from '~/modules/Users';

const basePath = import.meta.env.VITE_APP_BASE_PATH as Optional<string>;

export const removeBaseFromPath = (path: string): string => {
  if (!basePath || basePath === '/') return path;
  return path.startsWith(basePath) ? path.replace(basePath, '') || '/' : path;
};

export const getAssetPath = (path: string) => {
  return `${basePath && basePath !== '/' ? basePath : ''}/${path}`.replace(/\/+/g, '/');
};

export const discardNull = <T>(value: Nullish<T>): Optional<T> => {
  return value || undefined;
};

export function convertEmptyFieldsToNull<T extends object>(inputs: T): T {
  return Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => [key, value || null]),
  ) as T;
}

export const convertEmptyArrayToNull = <T>(data: T[]) => (data.length ? data : null);

export const isTruthy = <T>(value?: Nullish<T> | false, allowZero = false): value is T =>
  allowZero && value === 0 ? true : Boolean(value);

export const isObject = (value: unknown): value is object =>
  isTruthy(value) && typeof value === 'object';

export const isUser = (obj: unknown): obj is IUser => isObject(obj) && 'roleType' in obj;

export const isOrganization = (obj: unknown): obj is IOrganization =>
  isObject(obj) && 'maxOperator' in obj;

export const isChatMessage = (obj: unknown): obj is IChatMessage =>
  isObject(obj) && 'senderType' in obj && 'isDelivered' in obj;

export const isMessageUpdatePayload = (obj: unknown): obj is IChatMessageUpdatePayload =>
  isObject(obj) && 'messageId' in obj && 'isDelivered' in obj;

export const isChatPayload = (obj: unknown): obj is IChat =>
  isObject(obj) && 'id' in obj && 'chatMessages' in obj && 'latestMessageTimestamp' in obj;

export const isMemberFeedORSurveyColumn = (obj: unknown): obj is MemberFeedColumn | SurveyColumn =>
  isObject(obj) && 'alias' in obj && 'name' in obj;
