import { randomBytes } from 'crypto';

import { BadRequestException } from '@nestjs/common';

export const trimAndCleanSpaces = (name?: string): string => {
  return name?.trim()?.replace(/\s+/g, ' ') || '';
};

export const trimAndCleanSpacesWithoutNewline = (value?: string): string => {
  if (!value) return '';
  return value.trim().replace(/\n\s*\n\s*\n+/g, '\n\n');
};

export const convertArrayToString = (array: string[]): Nullable<string> => {
  if (Array.isArray(array) && array.every((item) => typeof item === 'string')) {
    return array.length ? array.join(',') : null;
  }

  throw new BadRequestException('Invalid input: Expected an array of strings');
};

export const convertCsvStringToArray = (csvString: Nullish<string>): string[] => {
  return csvString && csvString.length ? csvString.split(',') : [];
};

export const generateRandomPassword = (): string => {
  return randomBytes(8).toString('hex');
};

export const truncate = (text: string, limit: number, postfix?: string) => {
  if (!text) return '';
  if (text.length <= limit) return text;

  return `${text.slice(0, limit)}${postfix ?? ''}`;
};
