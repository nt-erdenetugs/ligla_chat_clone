let idToken: string | null = null;
let organizationCode: string | null = null;

export const setLiffSession = (session: { idToken: string; organizationCode: string }): void => {
  idToken = session.idToken;
  organizationCode = session.organizationCode;
};

export const clearLiffSession = (): void => {
  idToken = null;
  organizationCode = null;
};

export const getLiffSession = (): { idToken: string; organizationCode: string } | null => {
  if (!idToken || !organizationCode) return null;
  return { idToken, organizationCode };
};
