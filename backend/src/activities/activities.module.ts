import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [GamificationModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
})
export class ActivitiesModule {}
