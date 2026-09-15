import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementsService } from '../entitlements.service';
import { REQUIRES_FEATURE_KEY } from '../decorators/requires-feature.decorator';
import type { FeatureKey } from '../feature-catalogue';

/**
 * Blocks a route when the caller's gym is not on a tier that includes the
 * feature. Applied per controller, never globally — a global entitlement guard
 * would brick member check-in for a gym whose subscription lapsed.
 */
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<FeatureKey>(REQUIRES_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    const user = context.switchToHttp().getRequest().user;
    // Super admin has no gym context and is never limited by a tenant's plan.
    if (!user?.gymId || user.role === 'SUPER_ADMIN') return true;

    await this.entitlements.assertFeature(user.gymId, feature);
    return true;
  }
}
