export const msgBubbleStyles = {
  container: (styles: object) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 1,
    paddingY: 0.5,
    paddingX: 1.2,
    justifyContent: 'flex-start',
    ...styles,
  }),
  avatar: { width: { xs: 24, sm: 32 }, height: { xs: 24, sm: 32 }, fontSize: '14px' },
  paper: (styles: object) => ({
    padding: 1,
    maxWidth: '75%',
    borderRadius: 2,
    position: 'relative',
    fontSize: { xs: 10, sm: 12 },
    boxShadow: 'none',
    ...styles,
  }),
  time: (styles: object) => ({
    fontSize: 8,
    alignSelf: 'flex-end',
    fontWeight: 500,
    ...styles,
  }),
  sentBy: (styles: object) => ({
    fontSize: { xs: 9, sm: 10 },
    fontWeight: 500,
    position: 'absolute',
    right: 0,
    bottom: '100%',
    whiteSpace: 'nowrap',
    maxWidth: '300px',
    ...styles,
  }),
  errorContainer: {
    display: 'flex',
    padding: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: '2px',
  },
  errorMsg: {
    fontSize: { xs: 12, sm: 16 },
    color: '#d32f2f',
  },
  errorText: {
    lineHeight: '1',
  },
  actionsContainer: {
    display: 'flex',
    justifyContent: 'end',
    gap: 0.5,
  },
  actionButton: {
    padding: '0px',
  },
  errorIcon: {
    width: { xs: 16, sm: 20 },
    color: '#d32f2f',
  },
  loadingIcon: {
    color: '#6CE131',
  },
};
