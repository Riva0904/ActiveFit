import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or whole controller) as reachable without a JWT.
 * JwtAuthGuard is registered globally, so every handler is authenticated unless
 * explicitly opted out with this decorator.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
