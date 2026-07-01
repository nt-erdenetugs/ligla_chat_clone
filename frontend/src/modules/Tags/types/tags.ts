export interface ITag {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
}

export type ID = ITag['id'];
