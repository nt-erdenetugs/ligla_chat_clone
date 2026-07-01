export const styles = {
  border: '1px solid #ccc',
  scheduleLabel: (minWidth: number) => ({
    minWidth,
    textAlign: 'right',
    fontSize: 12,
    pr: 1,
  }),
  barContainer: {
    border: '1px solid #ccc',
    width: '100%',
    py: 1,
    cursor: 'pointer',
    '&:hover .time-bar': {
      backgroundColor: '#ddd',
    },
    '&:hover .time-range': {
      backgroundColor: 'darkgreen',
    },
  },
  timeBar: {
    position: 'relative',
    height: 25,
    backgroundColor: '#eee',
    transition: 'background-color 0.2s ease',
  },
  timeRange: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'green',
    transition: 'background-color 0.2s ease',
  },
  guidelineContainer: (left: number) => ({
    position: 'absolute',
    left,
    right: 0,
    top: 0,
    bottom: 0,
  }),
  verticalLine: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    width: '1px',
    bgcolor: '#ccc',
  },
  timeLabel: {
    fontSize: 12,
    position: 'absolute' as const,
    top: -25,
    left: '50%',
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
    color: 'text.secondary',
  },
};
