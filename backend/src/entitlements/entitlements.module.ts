import { Global, Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { EntitlementGuard } from './guards/entitlement.guard';
import { SaasPlansModule } from '../saas-plans/saas-plans.module';

/** Global: limits and feature checks are needed across many modules. */
@Global()
@Module({
  imports: [SaasPlansModule],
  providers: [EntitlementsService, EntitlementGuard],
  exports: [EntitlementsService, EntitlementGuard],
})
export class EntitlementsModule {}
