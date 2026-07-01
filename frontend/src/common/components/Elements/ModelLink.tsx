import { type FunctionComponent } from 'react';

import { Link } from '@mui/material';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router';

import { type FormProps, type ShowProps } from './DataTableWithHeader';

// Maximum number of additional dialogs to open at the link destination
export const MAX_DIALOG_COUNT = 4;

export type ModelLinkProps = {
  id: string;
  title: string;
  paramKey: string;
  Show: FunctionComponent<ShowProps>;
  Form?: FunctionComponent<FormProps>;
  depth?: number;
  onClose?: () => void;
};

export const MODEL_LINK_PARAM_KEY_PREFIX = 'action_';

export const ModelLink = ({ id, title, paramKey, Show, Form, depth, onClose }: ModelLinkProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const actionKey = paramKey
    ? `${MODEL_LINK_PARAM_KEY_PREFIX}${paramKey}${depth ? `_${depth}` : ''}`
    : 'dialog_action';

  const handleClick = () => {
    searchParams.set(actionKey, 'show');
    setSearchParams(searchParams);
  };

  const handleClose = () => {
    searchParams.delete(actionKey);
    setSearchParams(searchParams);
    onClose?.();
  };

  // 別のダイアログから開かれている場合、その先のダイアログは編集不可にする
  const editDisabled = Form === undefined || !!depth;

  return depth && depth >= MAX_DIALOG_COUNT - 1 ? (
    <div>{title}</div>
  ) : (
    <>
      <Link sx={{ cursor: 'pointer' }} onClick={handleClick}>
        {title}
      </Link>
      {searchParams.has(actionKey, 'show') &&
        createPortal(
          <Show
            id={id}
            onClose={handleClose}
            dialogProps={{ actionKey, editDisabled }}
            depth={depth ? depth + 1 : 1}
          />,
          document.body,
        )}
      {!editDisabled &&
        searchParams.has(actionKey, 'edit') &&
        createPortal(<Form id={id} onClose={handleClose} />, document.body)}
    </>
  );
};
