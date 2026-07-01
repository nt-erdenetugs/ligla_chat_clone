export const isArrayEqual = function (array1: unknown[], array2: unknown[]) {
  let i = array1.length;
  if (i !== array2.length) return false;

  while (i--) {
    if (array1[i] != array2[i]) return false;
  }
  return true;
};
