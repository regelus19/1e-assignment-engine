import { LocalOperationalRepository } from './LocalOperationalRepository';
import { createMsalGraphTokenProvider } from './msalAuth';
import { SharePointOperationalRepository } from './SharePointOperationalRepository';
import { OperationalRepository, RepositoryConfigurationError } from './types';

const env = ((import.meta as ImportMeta & { env?: Record<string,string|undefined> }).env || {});
const mode = (env.VITE_DATA_REPOSITORY_MODE || 'auto').toLowerCase();
const localRepository = new LocalOperationalRepository();

export let operationalRepository: OperationalRepository = localRepository;

export const initializeOperationalRepository = async (): Promise<OperationalRepository> => {
  if (mode === 'local') {
    operationalRepository = localRepository;
    return operationalRepository;
  }

  const siteId = env.VITE_SHAREPOINT_SITE_ID || '';
  const operationalListId = env.VITE_SHAREPOINT_OPERATIONAL_LIST_ID || '';
  const historyListId = env.VITE_SHAREPOINT_HISTORY_LIST_ID || '';
  const clientId = env.VITE_MSAL_CLIENT_ID || '';
  const tenantId = env.VITE_MSAL_TENANT_ID || '';
  const redirectUri = env.VITE_MSAL_REDIRECT_URI || window.location.origin;
  const scopes = (env.VITE_GRAPH_SCOPES || 'https://graph.microsoft.com/Sites.ReadWrite.All')
    .split(',').map(value=>value.trim()).filter(Boolean);
  const complete = !!(siteId && operationalListId && historyListId && clientId && tenantId);

  if (!complete) {
    if (mode === 'sharepoint') {
      throw new RepositoryConfigurationError('SharePoint mode is enabled but required site/list or Microsoft Entra settings are missing.');
    }
    operationalRepository = localRepository;
    return operationalRepository;
  }

  const getAccessToken = await createMsalGraphTokenProvider({ clientId, tenantId, redirectUri, scopes });
  operationalRepository = new SharePointOperationalRepository({
    siteId,
    operationalListId,
    historyListId,
    getAccessToken,
    seedRepository: localRepository,
  });
  return operationalRepository;
};

export * from './types';
export * from './SharePointOperationalRepository';
