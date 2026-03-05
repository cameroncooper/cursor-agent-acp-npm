import type { AuthMethod, Implementation } from '@agentclientprotocol/sdk';

export const CURSOR_AGENT_LOGIN_AUTH_METHOD_ID = 'cursor-agent-login';

const ZED_CLIENT_NAME = 'zed';

export function buildCursorTerminalAuthMethod(): AuthMethod {
  return {
    id: CURSOR_AGENT_LOGIN_AUTH_METHOD_ID,
    name: 'Login',
    description: 'Login with your Cursor account',
    _meta: {
      'terminal-auth': {
        label: 'Cursor CLI login',
        command: 'cursor-agent',
        args: ['login'],
        env: {},
      },
    },
  };
}

export function isZedClient(clientInfo?: Implementation | null): boolean {
  return clientInfo?.name?.toLowerCase() === ZED_CLIENT_NAME;
}

export function getCursorAuthenticationMessage(error?: string): string {
  return error || 'Cursor CLI is not authenticated. Run: cursor-agent login';
}
