import { createContext, useContext, useState } from 'react';

import { useSearchParams } from 'react-router';

import { ACTION_PARAM_KEY, MAIN_ACTIONS, ID_PARAM_KEY, type IAction } from '~/common/constants';
import { type ID } from '~/common/types';

type ActionContextProps = {
  actions: IAction[];
  setActions: (actions: IAction[]) => void;
  setActionAndId: (action: IAction, id: ID) => void;
  resetActions: () => void;
};

const defaultContext = {
  actions: [],
  setActions: () => {},
  setActionAndId: () => {},
  resetActions: () => {},
};

const ActionContext = createContext<ActionContextProps>(defaultContext);

type ActionProviderProps = {
  children: React.ReactNode;
};

const ActionProvider = ({ children }: ActionProviderProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [actions, setActions] = useState<IAction[]>(MAIN_ACTIONS);

  const setActionAndId = (action: IAction, id: ID) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set(ACTION_PARAM_KEY, action);
    newSearchParams.set(ID_PARAM_KEY, String(id));
    setSearchParams(newSearchParams);
  };

  const resetActions = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete(ACTION_PARAM_KEY);
    newSearchParams.delete(ID_PARAM_KEY);
    setSearchParams(newSearchParams);
  };

  return (
    <ActionContext.Provider value={{ setActionAndId, resetActions, actions, setActions }}>
      {children}
    </ActionContext.Provider>
  );
};

export const useActionContext = () => useContext(ActionContext);

export default ActionProvider;
