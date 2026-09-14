import {
  AccountInfo,
  AuthenticationResult,
  InteractionRequiredAuthError,
  PublicClientApplication,
} from '@azure/msal-browser';
import { AccessTokenProvider } from './SharePointOperationalRepository';
import { RepositoryConfigurationError } from './types';

export interface MsalGraphAuthConfig {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}

export const createMsalGraphTokenProvider = async (config: MsalGraphAuthConfig): Promise<AccessTokenProvider> => {
  if (!config.clientId || !config.tenantId || !config.redirectUri) {
    throw new RepositoryConfigurationError('SharePoint mode requires Microsoft Entra client, tenant, and redirect configuration.');
  }

  const app = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: config.redirectUri,
    },
    cache: { cacheLocation: 'sessionStorage' },
  });

  await app.initialize();
  const redirectResult = await app.handleRedirectPromise();
  let account: AccountInfo | undefined = redirectResult?.account || app.getAllAccounts()[0] || undefined;

  if (!account) {
    await app.loginRedirect({ scopes: config.scopes });
    return async () => { throw new Error('Microsoft sign-in redirect is in progress.'); };
  }

  return async (): Promise<string> => {
    try {
      const result: AuthenticationResult = await app.acquireTokenSilent({ account, scopes: config.scopes });
      return result.accessToken;
    } catch (error) {
      if (!(error instanceof InteractionRequiredAuthError)) throw error;
      const result = await app.acquireTokenPopup({ account, scopes: config.scopes });
      account = result.account || account;
      return result.accessToken;
    }
  };
};
