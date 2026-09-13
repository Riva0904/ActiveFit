import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../../src/auth/auth.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { OtpService } from '../../../src/otp/otp.service';
import { EmailService } from '../../../src/email/email.service';
import { TokenBlacklistService } from '../../../src/auth/token-blacklist.service';
import { AuditService } from '../../../src/common/services/audit.service';
import { RegisterDto } from '../../../src/auth/dto/auth.dto';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashed'),
  compare: jest.fn().mockResolvedValue(true),
}));

/**
 * POST /auth/register is public. It used to accept `role` and `gymId` in the body
 * and persist them verbatim — anyone could self-register as SUPER_ADMIN.
 * Two independent layers now close that:
 *   1. RegisterDto no longer declares the fields → global ValidationPipe
 *      (whitelist + forbidNonWhitelisted) rejects the request with 400.
 *   2. AuthService.register hardcodes role MEMBER / gymId null regardless of input,
 *      so even a caller that bypasses the pipe cannot escalate.
 */

// Same options as main.ts
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const validate = (body: any) => pipe.transform(body, { type: 'body', metatype: RegisterDto });

const validBody = { firstName: 'Eve', lastName: 'Mallory', email: 'eve@example.com', password: 'Password1' };

describe('RegisterDto — validation layer', () => {
  it('accepts a plain member registration', async () => {
    await expect(validate({ ...validBody })).resolves.toMatchObject(validBody);
  });

  it.each(['SUPER_ADMIN', 'GYM_ADMIN', 'STAFF', 'TRAINER', 'MEMBER'])(
    'rejects role=%s with 400 (field is not on the DTO)',
    async (role) => {
      await expect(validate({ ...validBody, role })).rejects.toThrow(BadRequestException);
    },
  );

  it('rejects gymId with 400', async () => {
    await expect(validate({ ...validBody, gymId: 'gym-victim' })).rejects.toThrow(BadRequestException);
  });

  it('rejects role + gymId together', async () => {
    await expect(validate({ ...validBody, role: 'GYM_ADMIN', gymId: 'gym-victim' })).rejects.toThrow(BadRequestException);
  });

  it('still enforces password policy', async () => {
    await expect(validate({ ...validBody, password: 'weak' })).rejects.toThrow(BadRequestException);
  });
});

describe('AuthService.register — service layer', () => {
  let service: AuthService;
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
  const otp = { sendOtp: jest.fn().mockResolvedValue({ message: 'sent' }) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('t') } },
        { provide: ConfigService, useValue: { get: jest.fn((_k: string, d?: any) => d) } },
        { provide: OtpService, useValue: otp },
        { provide: EmailService, useValue: {} },
        { provide: TokenBlacklistService, useValue: {} },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = module.get(AuthService);
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
  });

  it('persists role MEMBER and gymId null for a normal registration', async () => {
    await service.register(validBody as RegisterDto);
    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data.role).toBe('MEMBER');
    expect(data.gymId).toBeNull();
  });

  it.each(['SUPER_ADMIN', 'GYM_ADMIN', 'STAFF', 'TRAINER'])(
    'ignores a smuggled role=%s (defense in depth if the pipe is bypassed)',
    async (role) => {
      await service.register({ ...validBody, role, gymId: 'gym-victim' } as any);
      const { data } = prisma.user.create.mock.calls[0][0];
      expect(data.role).toBe('MEMBER');
      expect(data.gymId).toBeNull();
    },
  );

  it('does not echo a role back from the returned user beyond MEMBER', async () => {
    const res = await service.register({ ...validBody, role: 'SUPER_ADMIN' } as any);
    expect(res.user.role).toBe('MEMBER');
    expect(res.requiresEmailVerification).toBe(true);
  });
});
