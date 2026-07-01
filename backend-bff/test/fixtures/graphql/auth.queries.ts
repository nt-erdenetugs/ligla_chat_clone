export const AUTH_QUERIES = {
  LOGIN: `
    mutation Login($loginInput: LoginInput!) {
      login(loginInput: $loginInput) {
        accessToken
      }
    }
  `,

  LOGIN_TO_HYPERVISOR: `
    mutation LoginToHypervisor($loginInput: LoginInput!) {
      loginToHypervisor(loginInput: $loginInput) {
        accessToken
      }
    }
  `,
};
