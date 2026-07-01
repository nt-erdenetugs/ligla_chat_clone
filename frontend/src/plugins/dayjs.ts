import dayjs, { type Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import { LOCALE_JA } from '~/locales/config';

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

export enum VALID_TIMEZONE {
  JA = 'Asia/Tokyo',
}

const parseDate = (date: Optional<Nullable<Date | Dayjs>>): Nullable<Dayjs> => {
  const parsed = date ? dayjs(date) : null;
  return parsed && parsed.isValid() ? parsed : null;
};

const getRelativeDateFromNow = (now: Dayjs, targetDate: Dayjs, isfullRelative = false) => {
  const isToday = now.isSame(targetDate, 'day');
  const locale = dayjs.locale();

  const todayText = locale === LOCALE_JA ? '今日' : 'Today';

  if (!isfullRelative) {
    return isToday ? todayText : '';
  }

  if (isToday) return targetDate.fromNow();

  if (isfullRelative && now.diff(targetDate, 'day') <= 6) {
    return targetDate.format('ddd'); // e.g., 'Sun', 'Sat'
  }
};

const formatDateTo_MD_or_YYYYMD = (now: Dayjs, targetDate: Dayjs): string => {
  const locale = dayjs.locale();
  const shortDateFormat = locale === LOCALE_JA ? 'M月D日' : 'M/D';
  const longDateFormat = locale === LOCALE_JA ? 'YYYY年MM月DD日' : 'YYYY/M/D';

  return now.isSame(targetDate, 'year')
    ? targetDate.format(shortDateFormat)
    : targetDate.format(longDateFormat);
};

export const formatDateTo_HHmm = (date: Optional<Nullable<Date>>): string => {
  const validDate = parseDate(date);
  if (!validDate) return '';

  return validDate.format('HH:mm');
};

export const formatMessageTime = (date: Optional<Nullable<Date>>): string => {
  const validDate = parseDate(date);
  if (!validDate) return '';

  const now = dayjs();
  const time = validDate.format('HH:mm');

  if (now.isSame(validDate, 'day')) return time;

  return `${formatDateTo_MD_or_YYYYMD(now, validDate)} ${time}`;
};

export const formatDateTime = (date: Optional<Nullable<Date>>): string => {
  const validDate = parseDate(date);
  if (!validDate) return '';

  const now = dayjs();

  return getRelativeDateFromNow(now, validDate) || formatDateTo_MD_or_YYYYMD(now, validDate);
};

export const formatYYYYMMDDHHmm = (date?: Date | number | string, tz?: VALID_TIMEZONE) => {
  if (!date) return '';

  const inputDate = dayjs(date).tz(tz, Boolean(!tz));

  if (!inputDate.isValid()) return 'Invalid datetime';

  return inputDate.format('YYYY-MM-DD HH:mm');
};

export const formatYYYYMMDDHHmmss = (date?: Date | null) => {
  if (!date) return '';

  const inputDate = dayjs(date);

  if (!inputDate.isValid()) return 'Invalid datetime';

  return inputDate.format('YYYY-MM-DD HH:mm:ss');
};

export const formatYYYYMMDDWithDots = (date?: Date | number | string | null) => {
  if (!date) return '';

  const inputDate = dayjs(date);

  if (!inputDate.isValid()) return '';

  return inputDate.format('YYYY.MM.DD');
};
