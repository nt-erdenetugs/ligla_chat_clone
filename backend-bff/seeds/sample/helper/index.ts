export const generateColumns = (prefix: string, count: number) => {
  const columns: Record<string, string> = {};
  for (let i = 1; i <= count; i++) {
    columns[`${prefix}${i}`] = `${prefix}_${i}`;
  }
  return columns;
};
