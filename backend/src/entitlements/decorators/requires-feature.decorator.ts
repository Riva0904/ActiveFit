import { SetMetadata } from '@nestjs/common';
import type { FeatureKey } from '../feature-catalogue';

export const REQUIRES_FEATURE_KEY = 'requiresFeature';

/** Gate a controller or handler on a plan feature. Needs EntitlementGuard in scope. */
export const RequiresFeature = (feature: FeatureKey) => SetMetadata(REQUIRES_FEATURE_KEY, feature);
