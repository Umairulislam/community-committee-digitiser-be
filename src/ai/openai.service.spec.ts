import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { OpenAiService } from './openai.service';

describe('OpenAiService', () => {
  let service: OpenAiService;

  const mockConfig = {
    OPENAI_API_KEY: 'test-api-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_TIMEOUT_MS: 30000,
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const originalFetch = global.fetch;

  beforeEach(async () => {
    // Re-establish the implementation: resetAllMocks strips it between tests.
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: string | number) => {
        const value = (mockConfig as Record<string, unknown>)[key];
        return value !== undefined ? value : defaultValue;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAiService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OpenAiService>(OpenAiService);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const params = {
    systemPrompt: 'You are a test assistant.',
    context: '{"committees":[]}',
    question: 'How much have I contributed?',
  };

  function mockFetchSuccess(content = 'You contributed 10000.') {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content } }],
      }),
    });
  }

  function mockFetchError(status: number) {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status,
      json: async () => ({}),
    });
  }

  it('should return the answer content on success', async () => {
    mockFetchSuccess('You contributed 10000 in total.');

    const result = await service.chatCompletion(params);

    expect(result).toBe('You contributed 10000 in total.');
  });

  it('should send the correct request payload and headers', async () => {
    mockFetchSuccess();

    await service.chatCompletion(params);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-api-key',
        },
      }),
    );

    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    );
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(500);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('You are a test assistant.');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toContain('How much have I contributed?');
    expect(body.messages[1].content).toContain('{"committees":[]}');
  });

  it('should throw when the API key is not configured', async () => {
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: string | number) =>
        key === 'OPENAI_API_KEY' ? undefined : defaultValue,
    );
    const unconfigured = new OpenAiService(mockConfigService as any);

    await expect(unconfigured.chatCompletion(params)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should throw an authentication failure message on 401', async () => {
    mockFetchError(401);

    await expect(service.chatCompletion(params)).rejects.toThrow(
      'AI assistant authentication failed. Please contact the administrator.',
    );
  });

  it('should throw a busy message on 429', async () => {
    mockFetchError(429);

    await expect(service.chatCompletion(params)).rejects.toThrow(
      'AI assistant is busy right now. Please try again in a moment.',
    );
  });

  it('should throw an unavailable message on 500', async () => {
    mockFetchError(500);

    await expect(service.chatCompletion(params)).rejects.toThrow(
      'AI assistant is temporarily unavailable. Please try again later.',
    );
  });

  it('should throw an unavailable message on network errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.chatCompletion(params)).rejects.toThrow(
      'AI assistant is temporarily unavailable. Please try again later.',
    );
  });

  it('should throw a timeout message when the request times out', async () => {
    const timeoutError = new Error('The operation was aborted');
    timeoutError.name = 'TimeoutError';
    (global.fetch as jest.Mock).mockRejectedValue(timeoutError);

    await expect(service.chatCompletion(params)).rejects.toThrow(
      'AI assistant request timed out. Please try again.',
    );
  });

  it('should throw when the response body is not valid JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    });

    await expect(service.chatCompletion(params)).rejects.toThrow(
      'AI assistant returned an unexpected response.',
    );
  });

  it('should throw when the response has no choices', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await expect(service.chatCompletion(params)).rejects.toThrow(
      'AI assistant returned an unexpected response.',
    );
  });

  it('should throw when the answer content is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '   ' } }],
      }),
    });

    await expect(service.chatCompletion(params)).rejects.toThrow(
      'AI assistant returned an unexpected response.',
    );
  });

  it('should never include the API key in error messages', async () => {
    mockFetchError(401);

    try {
      await service.chatCompletion(params);
      fail('Expected ServiceUnavailableException');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain('test-api-key');
    }
  });
});
