export const truncate = (str: string, len: number | undefined, delimiter: string = '…') => {
  return len && str.length > len ? str.substring(0, len) + delimiter : str;
};

export const isTextTooLong = (text: string, limit: number) => {
  if (!text) return false;
  return text.length > limit;
};

export const uniqueKey = (prefix?: string) => {
  const key = Math.random().toString(36).slice(-8) + Date.now().toString(36).slice(-8);
  return `${prefix ?? 'unique'}-${key}`;
};
