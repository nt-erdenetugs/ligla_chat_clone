import { type BaseUser } from '~/generated/graphql/types';

export type Inputs = {
  noteValue: string;
  chatId: string;
};

export interface INote {
  id: string;
  chatId: string;
  noteValue: string;
  userId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: BaseUser;
}
