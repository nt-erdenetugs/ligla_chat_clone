export const textFieldStyle = (isEnabled: boolean) => ({
  flexGrow: 1,
  '& .MuiOutlinedInput-root': {
    bgcolor: isEnabled ? 'white' : '#F5F5F5',
    borderRadius: 2,
    border: 'none',
    py: 1,
    px: 2,
    fontSize: 14,
    '&:hover *': {
      cursor: isEnabled ? 'text' : 'not-allowed',
    },
  },
  '& .MuiOutlinedInput-input': {
    pr: '12px',
  },
});

export const notesListContainer = {
  display: 'flex',
  flexDirection: 'column',
  mt: 2,
};

export const inputAdornmentStyle = (isEnabled: boolean) => ({
  '&:hover *': {
    cursor: isEnabled ? 'pointer !important' : 'not-allowed',
  },
  ml: '3px',
  '&.MuiInputAdornment-positionEnd>*': {
    p: 0,
  },
});
