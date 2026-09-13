import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../src/auth/guards/jwt-auth.guard';
import { GymScopeGuard } from '../../../src/common/guards/gym-scope.guard';
import { Public, IS_PUBLIC_KEY } from '../../../src/common/decorators/public.decorator';
import { SkipGymScope } from '../../../src/common/decorators/skip-gym-scope.decorator';
import { gymScopeOf, scopedWhere } from '../../../src/common/utils/gym-scope';

/**
 * Regression cover for the guard-ordering bug: GymScopeGuard was a global guard
 * while JwtAuthGuard was controller-level. Nest runs global guards first, so
 * req.user was always undefined when the scope guard ran and it never enforced
 * anything. The fix makes JwtAuthGuard global and registers it BEFORE the scope guard.
 */

// Builds a fake ExecutionContext whose handler/class carry the given metadata.
function ctxWith(opts: { user?: any; handlerMeta?: Record<string, any>; classMeta?: Record<string, any> }) {
  const req: any = { user: opts.user };
  const handler = function handler() {};
  class Ctrl {}
  for (const [k, v] of Object.entries(opts.handlerMeta ?? {})) Reflect.defineMetadata(k, v, handler);
  for (const [k, v] of Object.entries(opts.classMeta ?? {})) Reflect.defineMetadata(k, v, Ctrl);
  return {
    getHandler: () => handler,
    getClass: () => Ctrl,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
    getType: () => 'http',
    req,
  } as unknown as ExecutionContext & { req: any };
}

describe('AppModule guard registration', () => {
  it('registers JwtAuthGuard globally, after ThrottlerGuard and before GymScopeGuard', () => {
    // AppModule evaluates ConfigModule.forRoot() (Joi env validation) at import time,
    // and jest forces NODE_ENV=test — so satisfy the schema, then require lazily.
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL ??= 'postgresql://x:y@localhost:5432/z';
    process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-chars-long';
    process.env.RESEND_API_KEY ??= 're_test';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } = require('../../../src/app.module');
    const providers: any[] = Reflect.getMetadata('providers', AppModule) ?? [];
    const guards = providers.filter((p) => p?.provide === APP_GUARD).map((p) => p.useClass);
    expect(guards).toEqual([ThrottlerGuard, JwtAuthGuard, GymScopeGuard]);
  });
});

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let passportSpy: jest.SpyInstance;

  beforeEach(() => {
    guard = new JwtAuthGuard(new Reflector());
    // Stub the passport round-trip; we only care whether it is reached.
    passportSpy = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockImplementation(() => true as any);
  });
  afterEach(() => passportSpy.mockRestore());

  it('bypasses passport entirely for a handler marked @Public()', () => {
    const ctx = ctxWith({ handlerMeta: { [IS_PUBLIC_KEY]: true } });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(passportSpy).not.toHaveBeenCalled();
  });

  it('bypasses passport when the whole controller is @Public()', () => {
    const ctx = ctxWith({ classMeta: { [IS_PUBLIC_KEY]: true } });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(passportSpy).not.toHaveBeenCalled();
  });

  it('short-circuits when the global instance already authenticated the request (no double DB lookup)', () => {
    const ctx = ctxWith({ user: { id: 'u1', role: 'MEMBER', gymId: 'g1' } });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(passportSpy).not.toHaveBeenCalled();
  });

  it('delegates to passport for an unauthenticated, non-public route', () => {
    const ctx = ctxWith({});
    guard.canActivate(ctx);
    expect(passportSpy).toHaveBeenCalledTimes(1);
  });

  it('@Public decorator sets the expected metadata key', () => {
    class T { @Public() h() {} }
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, T.prototype.h)).toBe(true);
  });
});

describe('GymScopeGuard', () => {
  const guard = new GymScopeGuard(new Reflector());

  it('allows SUPER_ADMIN with no gymId (crosses tenant boundaries)', () => {
    const ctx = ctxWith({ user: { id: 'sa', role: 'SUPER_ADMIN', gymId: null } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it.each(['GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER'])(
    'rejects a gym-less %s with 403 on a gym-scoped route',
    (role) => {
      const ctx = ctxWith({ user: { id: 'u', role, gymId: null } });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    },
  );

  it('attaches req.gymId for a gym-scoped user', () => {
    const ctx = ctxWith({ user: { id: 'u', role: 'GYM_ADMIN', gymId: 'gym-A' } });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.req.gymId).toBe('gym-A');
  });

  it('skips the check for @SkipGymScope() handlers (account-level routes)', () => {
    class T { @SkipGymScope() h() {} }
    const ctx = ctxWith({
      user: { id: 'u', role: 'MEMBER', gymId: null },
      handlerMeta: { skipGymScope: Reflect.getMetadata('skipGymScope', T.prototype.h) },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('skips the check for @Public() routes (no user to scope)', () => {
    const ctx = ctxWith({ handlerMeta: { [IS_PUBLIC_KEY]: true } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('lets an unauthenticated request through (JwtAuthGuard already decided 401 or @Public)', () => {
    expect(guard.canActivate(ctxWith({}))).toBe(true);
  });
});

describe('gymScopeOf / scopedWhere', () => {
  it('SUPER_ADMIN → undefined (unscoped)', () => {
    expect(gymScopeOf({ role: 'SUPER_ADMIN', gymId: null })).toBeUndefined();
    expect(gymScopeOf({ role: 'SUPER_ADMIN', gymId: 'ignored' })).toBeUndefined();
  });

  it.each(['GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER'])('%s → own gymId', (role) => {
    expect(gymScopeOf({ role, gymId: 'gym-A' })).toBe('gym-A');
  });

  it.each(['GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER'])(
    'gym-less %s throws instead of silently widening to all gyms',
    (role) => {
      expect(() => gymScopeOf({ role, gymId: null })).toThrow(ForbiddenException);
      expect(() => gymScopeOf({ role, gymId: undefined })).toThrow(ForbiddenException);
      expect(() => gymScopeOf({ role, gymId: '' })).toThrow(ForbiddenException);
    },
  );

  it('scopedWhere yields a gymId filter only when scoped', () => {
    expect(scopedWhere('gym-A')).toEqual({ gymId: 'gym-A' });
    expect(scopedWhere(undefined)).toEqual({});
  });
});
