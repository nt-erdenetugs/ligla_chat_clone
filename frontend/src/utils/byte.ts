export const formatBytes = (bytes?: number): string => {
  if (bytes == null || typeof bytes !== 'number' || bytes < 0) return '';
  if (bytes === 0) {
    return '0.00 B';
  }

  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const size = bytes / Math.pow(k, i);
  return `${size.toFixed(2)} ${units[i]}`;
};
