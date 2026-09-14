import { Test } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ProgressLogsService } from '../../../src/progress-logs/progress-logs.service';
import { CreateProgressLogDto } from '../../../src/progress-logs/dto/create-progress-log.dto';
import { PointsService } from '../../../src/gamification/points.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// Same options as main.ts
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } });
const validate = (body: any) => pipe.transform(body, { type: 'body', metatype: CreateProgressLogDto });

describe('CreateProgressLogDto', () => {
  it('accepts the weight-only fast path from the mobile ruler', async () => {
    await expect(validate({ weight: 72.5 })).resolves.toMatchObject({ weight: 72.5 });
  });

  it('accepts the full measurement set with Prisma column names', async () => {
    const body = { weight: 72.5, height: 175, bodyFat: 18, chest: 98, waist: 82, hips: 96, notes: 'ok', logDate: '2026-09-14T00:00:00.000Z' };
    await expect(validate(body)).resolves.toMatchObject(body);
  });

  it('rejects the legacy `bodyFatPercentage` field with a 400 (it used to 500 inside Prisma)', async () => {
    await expect(validate({ weight: 70, bodyFatPercentage: 18 })).rejects.toThrow(BadRequestException);
  });

  it.each([['memberId', 'x'], ['gymId', 'x'], ['id', 'x']])('rejects ownership field %s', async (k, v) => {
    await expect(validate({ weight: 70, [k]: v })).rejects.toThrow(BadRequestException);
  });

  it('rejects out-of-range numbers', async () => {
    await expect(validate({ weight: 5 })).rejects.toThrow(BadRequestException);
    await expect(validate({ bodyFat: 99 })).rejects.toThrow(BadRequestException);
  });
});

describe('ProgressLogsService', () => {
  const prisma = { member: { findFirst: jest.fn() }, progressLog: { create: jest.fn(), findMany: jest.fn() } };
  const points = { award: jest.fn().mockResolvedValue(undefined) };
  let service: ProgressLogsService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [ProgressLogsService, { provide: PrismaService, useValue: prisma }, { provide: PointsService, useValue: points }],
    }).compile();
    service = mod.get(ProgressLogsService);
    jest.clearAllMocks();
  });

  it('creates the log for the caller\'s member row and awards PROGRESS_LOG points', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
    prisma.progressLog.create.mockImplementation(async ({ data }: any) => ({ id: 'log-1', ...data }));

    const log: any = await service.create('user-1', 'gym-1', { weight: 72.5, notes: 'n' });

    expect(prisma.member.findFirst).toHaveBeenCalledWith({ where: { userId: 'user-1', gymId: 'gym-1' } });
    expect(prisma.progressLog.create.mock.calls[0][0].data).toMatchObject({ weight: 72.5, notes: 'n', memberId: 'member-1', gymId: 'gym-1' });
    expect(log.bmi).toBeUndefined();
    expect(points.award).toHaveBeenCalledWith('member-1', 'gym-1', 'PROGRESS_LOG');
  });

  it('computes BMI when both weight and height are given', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
    prisma.progressLog.create.mockImplementation(async ({ data }: any) => data);
    await service.create('user-1', 'gym-1', { weight: 72, height: 180 });
    expect(prisma.progressLog.create.mock.calls[0][0].data.bmi).toBe(22.2);
  });

  it('parses logDate into a Date', async () => {
    prisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
    prisma.progressLog.create.mockImplementation(async ({ data }: any) => data);
    await service.create('user-1', 'gym-1', { weight: 72, logDate: '2026-09-14T00:00:00.000Z' });
    expect(prisma.progressLog.create.mock.calls[0][0].data.logDate).toBeInstanceOf(Date);
  });

  it('rejects users with no member profile in the gym (was a silent null before)', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(service.create('user-x', 'gym-1', { weight: 70 })).rejects.toThrow(BadRequestException);
    expect(prisma.progressLog.create).not.toHaveBeenCalled();
    expect(points.award).not.toHaveBeenCalled();
  });

  it('findByUser returns [] without a member row, else logs newest first', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(service.findByUser('u', 'g')).resolves.toEqual([]);
    prisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
    prisma.progressLog.findMany.mockResolvedValue([{ id: 'a' }]);
    await expect(service.findByUser('u', 'g')).resolves.toHaveLength(1);
    expect(prisma.progressLog.findMany).toHaveBeenCalledWith({ where: { memberId: 'member-1' }, orderBy: { logDate: 'desc' } });
  });
});
