import { Injectable } from '@nestjs/common';
import { AiContextService } from './ai-context.service';
import { OpenAiService } from './openai.service';
import { AskAssistantDto } from './dto/ask-assistant.dto';

const SYSTEM_PROMPT = `You are the AI Committee Assistant for a digital kameti (rotating savings group) platform.
Answer the user's question using ONLY the committee data provided in the context below.

Strict rules:
- Use only the provided context. If the answer is not in the context, say you do not have that information.
- Never invent amounts, dates, names, member details, statuses, or lottery outcomes.
- Never make financial decisions, select or predict lottery winners, or suggest changing any records.
- Never claim to perform actions; you only provide information.
- Your answers are informational only; the official committee records remain the source of truth.
- Be concise, clear, and helpful. Use plain language.
- Dates in the context are ISO 8601 (UTC). Compare them against the context's generatedAt time when answering questions about "next" or "overdue" items.`;

@Injectable()
export class AiService {
  constructor(
    private readonly aiContextService: AiContextService,
    private readonly openAiService: OpenAiService,
  ) {}

  async ask(userId: string, dto: AskAssistantDto): Promise<{ answer: string }> {
    const { committees, truncated } = await this.aiContextService.buildContext(
      userId,
      dto.committeeId,
    );

    if (committees.length === 0) {
      return {
        answer:
          'You are not currently part of any committee, so I have no committee information to answer questions about. Once you join or create a committee, I can help you track contributions, payments, lotteries, and payouts.',
      };
    }

    const context = JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: truncated
        ? `Showing only your ${committees.length} most recent committees.`
        : undefined,
      committees,
    });

    const answer = await this.openAiService.chatCompletion({
      systemPrompt: SYSTEM_PROMPT,
      context,
      question: dto.question,
    });

    return { answer };
  }
}
