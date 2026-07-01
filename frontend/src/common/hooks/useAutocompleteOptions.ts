import { useMemo } from 'react';

export function useMergedAutocompleteOptions<T>(
  loadedItems: T[] | undefined,
  selectedItems: T[] | undefined,
  getId: (item: T) => string,
  getLabel: (item: T) => string,
): [string, string][] {
  return useMemo(() => {
    const map = new Map<string, T>();
    loadedItems?.forEach((item) => {
      map.set(getId(item), item);
    });
    selectedItems?.forEach((item) => {
      map.set(getId(item), item);
    });
    return Array.from(map.values()).map(
      (item) => [getLabel(item), getId(item)] as [string, string],
    );
  }, [loadedItems, selectedItems, getId, getLabel]);
}
