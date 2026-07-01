import { type SxProps } from '@mui/material';

export const BUTTON_SIZE_PX = '30px';

export const buttonStyle: SxProps = {
  height: BUTTON_SIZE_PX,
  width: BUTTON_SIZE_PX,
  padding: '4px',
};

const editedByStyle: SxProps = {
  lineHeight: '1.25',
  fontWeight: '500',
  fontSize: '12px',
};

const nameStyle: SxProps = {
  fontSize: '12px',
  fontWeight: '500',
};

const valueStyle: SxProps = {
  lineHeight: '1.4',
  fontSize: '12px',
};

const titleStyle: SxProps = {
  mb: 0,
};

const textContainerStyle: SxProps = {
  overflowWrap: 'break-word',
  width: `calc(100% - ${BUTTON_SIZE_PX})`,
};

export const chatAttributeStyles = {
  nameStyle,
  valueStyle,
  titleStyle,
  buttonStyle,
  editedByStyle,
  textContainerStyle,
};

export const typographyColors = {
  name: '#364152',
  value: '#737373',
  editedBy: '#a3a3a3',
  operator: '#ff8401',
};
