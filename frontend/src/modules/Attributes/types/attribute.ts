import { type SelectOption } from '~/modules/Chat';

export interface IAttribute {
  id: string;
  name: string;
  type: string;
  selectOption: SelectOption[];
  isActive: boolean;
  isEncryptionEnabled: boolean;
  createdAt: Date;
}

export interface IAttributeValue {
  id: string;
  selectOptions: SelectOption[];
  type: string;
  chatId: string;
  userId: string;
  attributeId: string;
  value: string;
  isEncryptionEnabled: boolean;
  user: {
    id: string;
    displayName: string;
  };
  createdAt: Date;
}
