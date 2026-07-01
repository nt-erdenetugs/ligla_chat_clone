export function parseDateInput(v: unknown): Date | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v;
  if (typeof v !== 'string') return undefined;

  if (/(?:[Zz]|[+-]\d{2}:\d{2})$/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  const m = (v as string).match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}(?:\.\d{1,3})?))?$/,
  );
  if (!m) return undefined;
  const [, ys, ms, ds, hs, mins, secs] = m;
  const year = Number(ys);
  const month = Number(ms) - 1;
  const day = Number(ds);
  const hour = Number(hs);
  const minute = Number(mins);
  const second = secs ? Number(secs) : 0;
  const date = new Date(year, month, day, hour, minute, second);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
