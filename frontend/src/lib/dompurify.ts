import DOMPurify, { type Config } from 'dompurify';

const config: Config = {
  ALLOWED_ATTR: ['target', 'rel', 'href'],
};

export const sanitizeContent = (content: string): string => {
  return DOMPurify.sanitize(content, config);
};
