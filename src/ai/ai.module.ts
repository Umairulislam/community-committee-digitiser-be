import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiContextService } from './ai-context.service';
import { OpenAiService } from './openai.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiContextService, OpenAiService],
})
export class AiModule {}
