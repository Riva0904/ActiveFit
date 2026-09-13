import { SetMetadata } from '@nestjs/common';
import { SKIP_GYM_SCOPE_KEY } from '../guards/gym-scope.guard';

/**
 * Exempts a route (or controller) from GymScopeGuard's "must have a gym" check.
 * Use for account-level endpoints that a gym-less user (e.g. a freshly self-registered
 * member, or a SUPER_ADMIN-created user awaiting gym assignment) must still reach.
 */
export const SkipGymScope = () => SetMetadata(SKIP_GYM_SCOPE_KEY, true);
