function hasOwnKey<Obj extends object, K extends PropertyKey>(
  obj: Obj,
  key: K,
): obj is Obj & Record<K, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function isValidDateValue(value: unknown): value is string | number | Date {
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return !isNaN(d.getTime());
  }
  return false;
}

export function compareObjectsByDate<T extends Record<string, any>, K extends Record<string, any>>(
  obj1: T | undefined,
  obj2: K | undefined,
  key1: keyof T = 'createdAt',
  key2?: keyof K,
) {
  if (!obj1) return obj2 ?? null;
  if (!obj2) return obj1;

  const k2 = key2 ?? (key1 as unknown as keyof K);

  if (!hasOwnKey(obj1, key1) || !hasOwnKey(obj2, k2)) {
    return null;
  }

  const raw1 = obj1[key1];
  const raw2 = obj2[k2];

  if (!isValidDateValue(raw1) || !isValidDateValue(raw2)) {
    return null;
  }

  const d1 = new Date(raw1);
  const d2 = new Date(raw2);

  return d1.getTime() > d2.getTime() ? obj1 : obj2;
}
