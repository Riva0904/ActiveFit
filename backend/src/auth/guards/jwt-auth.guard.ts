import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * Registered as a global APP_GUARD (see AppModule) so it runs *before* GymScopeGuard
 * and populates req.user for it. Routes opt out with @Public().
 *
 * Controllers may still list it in @UseGuards() for readability — that is harmless,
 * passport just re-validates the same token.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    // Already authenticated by the global instance — skip the second passport round
    // trip (and its DB lookup) when a controller also lists this guard in @UseGuards().
    if (context.switchToHttp().getRequest()?.user) return true;
    return super.canActivate(context);
  }
}
