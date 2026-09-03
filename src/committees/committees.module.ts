import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommitteesController } from './committees.controller';
import { CommitteesService } from './committees.service';

@Module({
  imports: [AuditModule],
  controllers: [CommitteesController],
  providers: [CommitteesService],
  exports: [CommitteesService],
})
export class CommitteesModule {}
