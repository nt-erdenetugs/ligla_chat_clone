export type IAction = (typeof ACTIONS_TYPE)[keyof typeof ACTIONS_TYPE];
export type IActions = IAction[];

export const ACTIONS_TYPE = {
  NEW: 'new',
  SHOW: 'show',
  EDIT: 'edit',
  DELETE: 'delete',
  RESTORE: 'restore',
} as const;

export const ACTION_LABEL_KEYS: Record<IAction, string> = {
  [ACTIONS_TYPE.NEW]: 'actions.new',
  [ACTIONS_TYPE.SHOW]: 'actions.show',
  [ACTIONS_TYPE.EDIT]: 'actions.edit',
  [ACTIONS_TYPE.DELETE]: 'actions.delete',
  [ACTIONS_TYPE.RESTORE]: 'actions.restore',
};

export const ALL_ACTIONS: IAction[] = Object.values(ACTIONS_TYPE);
export const MAIN_ACTIONS: IAction[] = Object.values(ACTIONS_TYPE).filter(
  (action) => action !== ACTIONS_TYPE.NEW,
);
export const TABLE_ROW_ACTIONS: IAction[] = [ACTIONS_TYPE.EDIT, ACTIONS_TYPE.DELETE];

export const ACTION_PARAM_KEY = 'action';
export const ID_PARAM_KEY = 'id';
