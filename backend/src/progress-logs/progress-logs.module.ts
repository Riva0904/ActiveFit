import { Module } from '@nestjs/common';
import { ProgressLogsService } from './progress-logs.service';
import { ProgressLogsController } from './progress-logs.controller';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [GamificationModule],
  controllers: [ProgressLogsController],
  providers: [ProgressLogsService],
})
export class ProgressLogsModule {}
