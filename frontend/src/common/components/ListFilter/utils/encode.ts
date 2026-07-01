const isNode = typeof Buffer !== 'undefined';

export const encode = (input: string): string => {
  if (isNode) {
    return Buffer.from(input, 'utf8')
      .toString('base64')
      .replace(/[+/=]/g, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''));
  }
  const binary = encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
  return btoa(binary).replace(/[+/=]/g, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''));
};

export const decode = (value?: string | null): string => {
  if (!value) return '';
  try {
    let base64 = value.replace(/[-_]/g, (c) => (c === '-' ? '+' : '/'));
    const pad = (4 - (base64.length % 4)) % 4;
    if (pad > 0) base64 += '='.repeat(pad);
    if (isNode) {
      return Buffer.from(base64, 'base64').toString('utf8');
    }
    const binary = atob(base64);
    const percentEncoded = Array.from(binary)
      .map((ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('');
    return decodeURIComponent(percentEncoded);
  } catch {
    return '';
  }
};
