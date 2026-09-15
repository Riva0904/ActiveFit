import { Module } from '@nestjs/common';
import { SaasPlansService } from './saas-plans.service';
import { SaasPlansController } from './saas-plans.controller';

@Module({
  controllers: [SaasPlansController],
  providers: [SaasPlansService],
  exports: [SaasPlansService],
})
export class SaasPlansModule {}
