import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AiService } from './ai.service';
import { AskAssistantDto } from './dto/ask-assistant.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('assistant')
  ask(@Body() dto: AskAssistantDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.aiService.ask(user.id, dto);
  }
}
