export const generateRange = (length: number, start = 1): number[] =>
  Array.from({ length }, (_, i) => i + start);
