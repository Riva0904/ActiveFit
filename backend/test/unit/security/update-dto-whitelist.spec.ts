import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateUserDto } from '../../../src/users/dto/update-user.dto';
import { UpdateTrainerDto } from '../../../src/trainers/dto/update-trainer.dto';
import { UpdateStaffDto } from '../../../src/staffs/dto/update-staff.dto';
import { UpdateSupplementDto } from '../../../src/supplements/dto/update-supplement.dto';
import { UpdateMembershipDto } from '../../../src/memberships/dto/update-membership.dto';
import { SetGymPlanDto, UpdateGymAdminDto, UpdateGymProfileDto, UpdateGymStatusDto } from '../../../src/gyms/dto/update-gym.dto';

/**
 * These endpoints used to take `@Body() body: any`, which the global ValidationPipe
 * skips entirely — a GYM_ADMIN could PATCH /users/:id with { role: 'SUPER_ADMIN' }.
 * Each DTO now whitelists profile fields only; privileged columns are rejected with 400.
 * Also pins the exact payloads the web client sends so the UI keeps working.
 */

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const validate = (metatype: any, body: any) => pipe.transform(body, { type: 'body', metatype });

describe('UpdateUserDto', () => {
  it.each([
    ['role', 'SUPER_ADMIN'],
    ['gymId', 'gym-other'],
    ['isActive', false],
    ['isEmailVerified', true],
    ['password', 'Hacked123'],
    ['refreshToken', 'x'],
    ['id', 'other-id'],
  ])('rejects privileged field %s', async (field, value) => {
    await expect(validate(UpdateUserDto, { firstName: 'A', [field]: value })).rejects.toThrow(BadRequestException);
  });

  it('accepts the EditMemberModal payload (firstName, lastName, email, phone)', async () => {
    const body = { firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '+91 9876543210' };
    await expect(validate(UpdateUserDto, body)).resolves.toMatchObject({ ...body, phone: '+919876543210' });
  });

  it('accepts the staff-edit payload with phone omitted', async () => {
    const body = { firstName: 'S', lastName: 'T', phone: undefined };
    await expect(validate(UpdateUserDto, body)).resolves.toMatchObject({ firstName: 'S', lastName: 'T' });
  });

  it('maps an empty phone string to null (clears the field) instead of failing validation', async () => {
    await expect(validate(UpdateUserDto, { firstName: 'J', phone: '' })).resolves.toMatchObject({ phone: null });
  });

  it('rejects a malformed phone', async () => {
    await expect(validate(UpdateUserDto, { phone: '12345' })).rejects.toThrow(BadRequestException);
  });

  it('rejects a malformed email', async () => {
    await expect(validate(UpdateUserDto, { email: 'nope' })).rejects.toThrow(BadRequestException);
  });

  it('accepts the full profile field set', async () => {
    const body = {
      avatar: 'a.png', dateOfBirth: '1990-01-01', gender: 'FEMALE', address: '1 St', city: 'C',
      state: 'S', pincode: '560001', country: 'IN', emergencyContact: '+919876543210',
      payoutUpiVpa: 'x@upi', timezone: 'Asia/Kolkata',
    };
    await expect(validate(UpdateUserDto, body)).resolves.toMatchObject(body);
  });
});

describe('UpdateTrainerDto', () => {
  it.each(['gymId', 'userId', 'id', 'rating'])('rejects %s', async (field) => {
    await expect(validate(UpdateTrainerDto, { bio: 'x', [field]: 'v' })).rejects.toThrow(BadRequestException);
  });

  it('accepts the settings-page payload (nulls allowed)', async () => {
    const body = { bio: null, experience: 3, hourlyRate: null, specializations: ['yoga'], certifications: [] };
    await expect(validate(UpdateTrainerDto, body)).resolves.toMatchObject(body);
  });

  it('rejects negative experience / hourlyRate', async () => {
    await expect(validate(UpdateTrainerDto, { experience: -1 })).rejects.toThrow(BadRequestException);
    await expect(validate(UpdateTrainerDto, { hourlyRate: -5 })).rejects.toThrow(BadRequestException);
  });
});

describe('UpdateStaffDto', () => {
  it.each(['gymId', 'userId', 'id'])('rejects %s', async (field) => {
    await expect(validate(UpdateStaffDto, { designation: 'x', [field]: 'v' })).rejects.toThrow(BadRequestException);
  });

  it('accepts the members-page staff-edit payload (nulls allowed)', async () => {
    const body = { designation: null, department: 'Front desk', salary: 15000 };
    await expect(validate(UpdateStaffDto, body)).resolves.toMatchObject(body);
    await expect(validate(UpdateStaffDto, { designation: null, department: null, salary: null })).resolves.toBeDefined();
  });
});

describe('UpdateSupplementDto', () => {
  it.each(['gymId', 'id', 'deletedAt'])('rejects %s', async (field) => {
    await expect(validate(UpdateSupplementDto, { name: 'x', [field]: 'v' })).rejects.toThrow(BadRequestException);
  });

  it('accepts the admin toggle payload { isActive }', async () => {
    await expect(validate(UpdateSupplementDto, { isActive: false })).resolves.toEqual({ isActive: false });
  });

  it('accepts a full catalog edit', async () => {
    const body = { name: 'Whey', category: 'Protein', brand: 'B', description: 'd', price: 999, discountPrice: 899, stock: 10, weight: '1kg', images: [], isFeatured: true };
    await expect(validate(UpdateSupplementDto, body)).resolves.toMatchObject(body);
  });

  it('rejects negative price / stock', async () => {
    await expect(validate(UpdateSupplementDto, { price: -1 })).rejects.toThrow(BadRequestException);
    await expect(validate(UpdateSupplementDto, { stock: -1 })).rejects.toThrow(BadRequestException);
  });
});

describe('UpdateMembershipDto', () => {
  it.each(['memberId', 'gymId', 'planId', 'id'])('rejects %s (re-pointing a subscription is not an edit)', async (field) => {
    await expect(validate(UpdateMembershipDto, { status: 'ACTIVE', [field]: 'v' })).rejects.toThrow(BadRequestException);
  });

  it('accepts the members-page change-plan payload', async () => {
    const body = { amount: 2000, startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-10-01T00:00:00.000Z', status: 'ACTIVE' };
    await expect(validate(UpdateMembershipDto, body)).resolves.toMatchObject(body);
  });

  it('rejects an unknown status', async () => {
    await expect(validate(UpdateMembershipDto, { status: 'FREE_FOREVER' })).rejects.toThrow(BadRequestException);
  });
});

// ─── Gym update: the free-ENTERPRISE hole ───────────────────────────────────

describe('UpdateGymProfileDto (gym admin)', () => {
  // PATCH /gyms/:id took `@Body() body: any`, so a GYM_ADMIN could grant
  // themselves any tier for free. These columns now belong to subscriptions.
  it.each([
    ['saasPlan', 'ENTERPRISE'],
    ['saasStatus', 'ACTIVE'],
    ['saasExpiresAt', '2099-01-01T00:00:00.000Z'],
    ['maxMembers', 99999],
    ['status', 'ACTIVE'],
    ['slug', 'hacked'],
    ['razorpayAccountId', 'acc_x'],
    ['id', 'gym-other'],
    ['deletedAt', null],
    ['createdAt', '2020-01-01T00:00:00.000Z'],
  ])('rejects %s', async (field, value) => {
    await expect(validate(UpdateGymProfileDto, { name: 'My Gym', [field]: value })).rejects.toThrow(BadRequestException);
  });

  it('accepts the settings-page payout payload', async () => {
    const body = {
      payoutUpiVpa: 'gym@upi', payoutAccountHolder: 'Ajith', payoutBankAccountNumber: '123456',
      payoutBankIfsc: 'HDFC0001', payoutPhone: '+91 9876543210',
    };
    await expect(validate(UpdateGymProfileDto, body)).resolves.toMatchObject(body);
  });

  it('accepts the reminders toggle and a profile edit', async () => {
    await expect(validate(UpdateGymProfileDto, { renewalRemindersEnabled: false })).resolves.toMatchObject({ renewalRemindersEnabled: false });
    await expect(validate(UpdateGymProfileDto, { name: 'A', city: 'Bangalore', amenities: ['Sauna'], workingDays: ['MON'] })).resolves.toBeDefined();
  });

  it('rejects a malformed email', async () => {
    await expect(validate(UpdateGymProfileDto, { email: 'not-an-email' })).rejects.toThrow(BadRequestException);
  });
});

describe('UpdateGymAdminDto (super admin)', () => {
  it('accepts status, maxMembers and slug', async () => {
    const body = { status: 'ACTIVE', maxMembers: 500, slug: 'fitness-hub' };
    await expect(validate(UpdateGymAdminDto, body)).resolves.toMatchObject(body);
  });

  it.each(['saasPlan', 'saasStatus', 'saasExpiresAt'])('still rejects %s — tiers move through the plan endpoint', async (field) => {
    await expect(validate(UpdateGymAdminDto, { [field]: 'ENTERPRISE' })).rejects.toThrow(BadRequestException);
  });

  it('rejects an uppercase slug', async () => {
    await expect(validate(UpdateGymAdminDto, { slug: 'Fitness Hub' })).rejects.toThrow(BadRequestException);
  });
});

describe('SetGymPlanDto / UpdateGymStatusDto', () => {
  it('accepts a valid tier change', async () => {
    await expect(validate(SetGymPlanDto, { plan: 'PROFESSIONAL', reason: 'paid by UPI' })).resolves.toMatchObject({ plan: 'PROFESSIONAL' });
  });

  it('rejects an unknown tier and unknown extras', async () => {
    await expect(validate(SetGymPlanDto, { plan: 'FREE_FOREVER' })).rejects.toThrow(BadRequestException);
    await expect(validate(SetGymPlanDto, { plan: 'STARTER', gymId: 'other' })).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown gym status', async () => {
    await expect(validate(UpdateGymStatusDto, { status: 'SUPER_ACTIVE' })).rejects.toThrow(BadRequestException);
    await expect(validate(UpdateGymStatusDto, { status: 'ACTIVE' })).resolves.toMatchObject({ status: 'ACTIVE' });
  });
});
