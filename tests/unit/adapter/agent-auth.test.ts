import { jest } from '@jest/globals';
import { CursorAgentAdapter } from '../../../src/adapter/cursor-agent-adapter';
import type { AdapterConfig, Logger } from '../../../src/types';

jest.mock('../../../src/cursor/cli-bridge', () => ({
  CursorCliBridge: jest.fn().mockImplementation(() => ({
    getVersion: jest.fn().mockResolvedValue('1.0.0'),
    checkAuthentication: jest
      .fn()
      .mockResolvedValue({ authenticated: true, user: 'test-user' }),
    createChat: jest.fn().mockResolvedValue('chat-123'),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockLogger: Logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

const testConfig: AdapterConfig = {
  logLevel: 'debug',
  sessionDir: '/tmp/cursor-test-sessions',
  maxSessions: 10,
  sessionTimeout: 60000,
  tools: {
    filesystem: {
      enabled: false,
    },
    terminal: {
      enabled: true,
      maxProcesses: 3,
    },
  },
  cursor: {
    timeout: 30000,
    retries: 1,
  },
};

describe('CursorAgentAdapter agent auth flow', () => {
  let adapter: CursorAgentAdapter;
  let cursorBridge: {
    checkAuthentication: jest.Mock;
  };
  const requestErrorFactory = {
    authRequired: (_data?: unknown, additionalMessage?: string) => {
      const error = new Error(
        `Authentication required${additionalMessage ? `: ${additionalMessage}` : ''}`
      ) as Error & { code: number; name: string };
      error.name = 'RequestError';
      error.code = -32000;
      return error;
    },
    invalidParams: (_data?: unknown, additionalMessage?: string) => {
      const error = new Error(
        `Invalid params${additionalMessage ? `: ${additionalMessage}` : ''}`
      ) as Error & { code: number; name: string };
      error.name = 'RequestError';
      error.code = -32602;
      return error;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    adapter = new CursorAgentAdapter(testConfig, { logger: mockLogger });
    await adapter.initialize();
    cursorBridge = (adapter as any).cursorBridge;
    jest
      .spyOn(adapter as any, 'getRequestErrorClass')
      .mockResolvedValue(requestErrorFactory);
  });

  afterEach(async () => {
    await adapter.shutdown();
  });

  it('should reject newSession with ACP auth required when Cursor is not authenticated', async () => {
    cursorBridge.checkAuthentication.mockResolvedValue({
      authenticated: false,
      error: 'User not authenticated. Please run: cursor-agent login',
    });

    await expect(
      adapter.handleNewSessionFromAgent({
        cwd: '/tmp/project',
        mcpServers: [],
      })
    ).rejects.toMatchObject({
      name: 'RequestError',
      code: -32000,
      message: expect.stringContaining('Authentication required'),
    });
  });

  it('should reject prompt with ACP auth required when Cursor is not authenticated', async () => {
    cursorBridge.checkAuthentication.mockResolvedValue({
      authenticated: false,
      error: 'User not authenticated. Please run: cursor-agent login',
    });

    await expect(
      adapter.handlePromptFromAgent({
        sessionId: 'session-1',
        prompt: [{ type: 'text', text: 'Hello' }],
      })
    ).rejects.toMatchObject({
      name: 'RequestError',
      code: -32000,
      message: expect.stringContaining('Authentication required'),
    });
  });

  it('should validate the supported auth method', async () => {
    await expect(
      adapter.handleAuthenticateFromAgent({
        methodId: 'unsupported-login',
      })
    ).rejects.toMatchObject({
      name: 'RequestError',
      code: -32602,
    });
  });

  it('should succeed after Cursor authentication is verified', async () => {
    const result = await adapter.handleAuthenticateFromAgent({
      methodId: 'cursor-agent-login',
    });

    expect(result._meta).toMatchObject({
      authenticated: true,
      methodId: 'cursor-agent-login',
    });
  });
});
