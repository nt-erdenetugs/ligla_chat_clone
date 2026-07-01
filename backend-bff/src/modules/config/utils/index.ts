export const parseEnvToJson = (envString: string): Record<string, any> => {
  const result: Record<string, any> = {};

  envString.split('\n').forEach((line) => {
    const trimmed = line.trim();

    // Skip empty lines or comments
    if (!trimmed || trimmed.startsWith('#')) return;

    const [key, ...rest] = trimmed.split('=');
    if (!key || rest.length === 0) return;

    const rawValue = rest.join('=').trim();

    let value: any;

    try {
      value = JSON.parse(rawValue);
    } catch {
      value = rawValue.replace(/^"(.*)"$/, '$1');
    }

    result[key.trim()] = value;
  });

  return result;
};
