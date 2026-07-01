export interface IStore {
  id: string;
  name: string;
  isActive: boolean;
  liglaStoreId?: Nullable<number>;
  areaName?: Nullable<string>;
  typeName?: Nullable<string>;
  note?: Nullable<string>;
  startsAt?: Nullable<Date>;
  endsAt?: Nullable<Date>;
  createdAt?: Nullable<Date>;
}
