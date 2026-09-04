import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

describe('AiController', () => {
  let controller: AiController;

  const userId = 'user-1';
  const mockReq = { user: { id: userId } };

  const mockAiService = {
    ask: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: mockAiService }],
    }).compile();

    controller = module.get<AiController>(AiController);
    jest.resetAllMocks();
  });

  it('should return the answer for the authenticated user', async () => {
    const dto = { question: 'How much have I contributed?' };
    const expectedResult = { answer: 'You contributed 10000.' };
    mockAiService.ask.mockResolvedValue(expectedResult);

    const result = await controller.ask(dto, mockReq as any);

    expect(result).toEqual(expectedResult);
    expect(mockAiService.ask).toHaveBeenCalledWith(userId, dto);
  });

  it('should pass committeeId through to the service', async () => {
    const dto = {
      question: 'Who won the last lottery?',
      committeeId: 'comm-1',
    };
    mockAiService.ask.mockResolvedValue({ answer: 'Alice won.' });

    await controller.ask(dto, mockReq as any);

    expect(mockAiService.ask).toHaveBeenCalledWith(userId, dto);
  });
});
