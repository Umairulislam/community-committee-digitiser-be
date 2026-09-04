import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { AiContextService } from './ai-context.service';
import { OpenAiService } from './openai.service';

describe('AiService', () => {
  let service: AiService;

  const mockAiContextService = {
    buildContext: jest.fn(),
  };

  const mockOpenAiService = {
    chatCompletion: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AiContextService, useValue: mockAiContextService },
        { provide: OpenAiService, useValue: mockOpenAiService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    jest.resetAllMocks();
  });

  const dto = { question: 'How much have I contributed?' };

  it('should return a canned answer without calling OpenAI when the user has no committees', async () => {
    mockAiContextService.buildContext.mockResolvedValue({
      committees: [],
      truncated: false,
    });

    const result = await service.ask('user-1', dto);

    expect(result.answer).toContain('not currently part of any committee');
    expect(mockOpenAiService.chatCompletion).not.toHaveBeenCalled();
  });

  it('should call OpenAI with the system prompt, context, and question', async () => {
    const committeeContext = {
      name: 'Test Committee',
      status: 'ACTIVE',
      contributionAmount: 10000,
      memberLimit: 10,
      totalCycles: 5,
      dueDay: 5,
      activeMemberCount: 8,
      completedCycles: 1,
      currentCycleNumber: 2,
      yourRole: 'MEMBER',
      yourMemberStatus: 'ACTIVE',
      yourContributions: [],
      yourLotteryWins: [],
      yourPayouts: [],
      lastLotteryResult: null,
    };
    mockAiContextService.buildContext.mockResolvedValue({
      committees: [committeeContext],
      truncated: false,
    });
    mockOpenAiService.chatCompletion.mockResolvedValue(
      'You have contributed 10000 so far.',
    );

    const result = await service.ask('user-1', dto);

    expect(result).toEqual({ answer: 'You have contributed 10000 so far.' });
    expect(mockOpenAiService.chatCompletion).toHaveBeenCalledTimes(1);

    const call = mockOpenAiService.chatCompletion.mock.calls[0][0];
    expect(call.question).toBe('How much have I contributed?');
    expect(call.systemPrompt).toContain('ONLY the committee data');
    expect(call.systemPrompt).toContain('Never make financial decisions');
    expect(call.context).toContain('Test Committee');
    expect(call.context).toContain('generatedAt');
  });

  it('should pass committeeId through to the context service', async () => {
    mockAiContextService.buildContext.mockResolvedValue({
      committees: [],
      truncated: false,
    });

    await service.ask('user-1', {
      question: 'What is my contribution status?',
      committeeId: 'comm-1',
    });

    expect(mockAiContextService.buildContext).toHaveBeenCalledWith(
      'user-1',
      'comm-1',
    );
  });

  it('should include a truncation note in the context when committees are capped', async () => {
    const committeeContext = {
      name: 'Test Committee',
      status: 'ACTIVE',
      contributionAmount: 10000,
      memberLimit: 10,
      totalCycles: 5,
      dueDay: 5,
      activeMemberCount: 8,
      completedCycles: 1,
      currentCycleNumber: 2,
      yourRole: 'MEMBER',
      yourMemberStatus: 'ACTIVE',
      yourContributions: [],
      yourLotteryWins: [],
      yourPayouts: [],
      lastLotteryResult: null,
    };
    mockAiContextService.buildContext.mockResolvedValue({
      committees: Array(5).fill(committeeContext),
      truncated: true,
    });
    mockOpenAiService.chatCompletion.mockResolvedValue('Answer.');

    await service.ask('user-1', dto);

    const context = mockOpenAiService.chatCompletion.mock.calls[0][0].context;
    expect(context).toContain('most recent committees');
  });

  it('should propagate authorisation errors from the context service', async () => {
    mockAiContextService.buildContext.mockRejectedValue(
      new Error('Forbidden'),
    );

    await expect(service.ask('user-1', dto)).rejects.toThrow('Forbidden');
    expect(mockOpenAiService.chatCompletion).not.toHaveBeenCalled();
  });

  it('should propagate OpenAI service errors', async () => {
    mockAiContextService.buildContext.mockResolvedValue({
      committees: [
        {
          name: 'Test Committee',
          status: 'ACTIVE',
          contributionAmount: 10000,
          memberLimit: 10,
          totalCycles: 5,
          dueDay: 5,
          activeMemberCount: 8,
          completedCycles: 1,
          currentCycleNumber: 2,
          yourRole: 'MEMBER',
          yourMemberStatus: 'ACTIVE',
          yourContributions: [],
          yourLotteryWins: [],
          yourPayouts: [],
          lastLotteryResult: null,
        },
      ],
      truncated: false,
    });
    mockOpenAiService.chatCompletion.mockRejectedValue(
      new Error('AI assistant is not configured. Please contact the administrator.'),
    );

    await expect(service.ask('user-1', dto)).rejects.toThrow(
      'AI assistant is not configured',
    );
  });
});
