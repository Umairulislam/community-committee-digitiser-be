import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatCompletionParams {
  systemPrompt: string;
  context: string;
  question: string;
}

interface OpenAiChoice {
  message?: { content?: string | null };
}

interface OpenAiChatResponse {
  choices?: OpenAiChoice[];
}

/**
 * Isolated OpenAI REST client. The only integration point with the
 * external AI provider. Receives plain strings and returns a plain
 * string — it never touches the database or business logic.
 */
@Injectable()
export class OpenAiService {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    this.baseUrl = (
      this.configService.get<string>('OPENAI_BASE_URL') ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    this.timeoutMs = this.configService.get<number>('OPENAI_TIMEOUT_MS', 30000);
  }

  async chatCompletion(params: ChatCompletionParams): Promise<string> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'AI assistant is not configured. Please contact the administrator.',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: params.systemPrompt },
            {
              role: 'user',
              content: `Committee data context:\n${params.context}\n\nQuestion: ${params.question}`,
            },
          ],
          temperature: 0.2,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ServiceUnavailableException(
          'AI assistant request timed out. Please try again.',
        );
      }
      throw new ServiceUnavailableException(
        'AI assistant is temporarily unavailable. Please try again later.',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        this.unavailableMessageForStatus(response.status),
      );
    }

    let body: OpenAiChatResponse;
    try {
      body = (await response.json()) as OpenAiChatResponse;
    } catch {
      throw new ServiceUnavailableException(
        'AI assistant returned an unexpected response.',
      );
    }

    const answer = body.choices?.[0]?.message?.content;
    if (!answer || !answer.trim()) {
      throw new ServiceUnavailableException(
        'AI assistant returned an unexpected response.',
      );
    }

    return answer.trim();
  }

  private unavailableMessageForStatus(status: number): string {
    if (status === 401 || status === 403) {
      return 'AI assistant authentication failed. Please contact the administrator.';
    }
    if (status === 429) {
      return 'AI assistant is busy right now. Please try again in a moment.';
    }
    return 'AI assistant is temporarily unavailable. Please try again later.';
  }
}
