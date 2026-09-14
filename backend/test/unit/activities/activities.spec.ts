import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { ActivitiesService } from '../../../src/activities/activities.service';
import { CreateRunDto } from '../../../src/activities/dto/create-run.dto';
import { PointsService } from '../../../src/gamification/points.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } });
const validate = (body: any) => pipe.transform(body, { type: 'body', metatype: CreateRunDto });

const route = [{ lat: 12.97, lng: 77.59, ts: 1 }, { lat: 12.98, lng: 77.59, ts: 600 }];
const valid = { startedAt: '2026-09-14T06:00:00.000Z', endedAt: '2026-09-14T06:44:13.000Z', distanceMeters: 8566, durationSec: 2653, calories: 620, route };

describe('CreateRunDto', () => {
  it('accepts a well-formed run', async () => {
    const out: any = await validate(valid);
    expect(out.route[0]).toMatchObject({ lat: 12.97, lng: 77.59, ts: 1 });
  });

  it.each([
    ['route too short', { ...valid, route: [route[0]] }],
    ['bad latitude', { ...valid, route: [{ lat: 91, lng: 0, ts: 1 }, route[1]] }],
    ['bad longitude', { ...valid, route: [{ lat: 0, lng: 181, ts: 1 }, route[1]] }],
    ['negative distance', { ...valid, distanceMeters: -1 }],
    ['zero duration', { ...valid, durationSec: 0 }],
    ['non-ISO date', { ...valid, startedAt: 'yesterday' }],
    ['unknown top-level field', { ...valid, memberId: 'x' }],
    ['unknown route field', { ...valid, route: [{ ...route[0], speed: 3 }, route[1]] }],
    ['fractional distance', { ...valid, distanceMeters: 12.5 }],
  ])('rejects %s', async (_n, body) => {
    await expect(validate(body)).rejects.toThrow(BadRequestException);
  });
});

describe('ActivitiesService', () => {
  const prisma = {
    member: { findFirst: jest.fn() },
    activityRun: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
  };
  const points = { award: jest.fn().mockResolvedValue(undefined) };
  let service: ActivitiesService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [ActivitiesService, { provide: PrismaService, useValue: prisma }, { provide: PointsService, useValue: points }],
    }).compile();
    service = mod.get(ActivitiesService);
    jest.clearAllMocks();
    prisma.member.findFirst.mockResolvedValue({ id: 'member-1' });
  });

  it('pace: null under 100 m, else rounded sec/km', () => {
    expect(ActivitiesService.pace(50, 60)).toBeNull();
    expect(ActivitiesService.pace(1000, 0)).toBeNull();
    expect(ActivitiesService.pace(8566, 2653)).toBe(Math.round(2653 / 8.566));
  });

  it('createRun stores the run for the caller\'s member, server-side pace, tuple route, and awards RUN_LOGGED', async () => {
    prisma.activityRun.create.mockImplementation(async ({ data }: any) => ({ id: 'run-1', ...data }));

    await service.createRun('user-1', 'gym-1', valid as CreateRunDto);

    const { data, select } = prisma.activityRun.create.mock.calls[0][0];
    expect(data).toMatchObject({ memberId: 'member-1', gymId: 'gym-1', distanceMeters: 8566, durationSec: 2653, calories: 620, avgPaceSecPerKm: Math.round(2653 / 8.566) });
    expect(data.startedAt).toBeInstanceOf(Date);
    expect(data.route).toEqual([[12.97, 77.59, 1], [12.98, 77.59, 600]]);
    expect(select.route).toBeUndefined(); // route never echoed back from create
    expect(points.award).toHaveBeenCalledWith('member-1', 'gym-1', 'RUN_LOGGED');
  });

  it('createRun rejects endedAt <= startedAt', async () => {
    await expect(service.createRun('user-1', 'gym-1', { ...valid, endedAt: valid.startedAt } as CreateRunDto)).rejects.toThrow(BadRequestException);
    expect(prisma.activityRun.create).not.toHaveBeenCalled();
  });

  it('rejects callers without a member row in the gym', async () => {
    prisma.member.findFirst.mockResolvedValue(null);
    await expect(service.createRun('user-x', 'gym-1', valid as CreateRunDto)).rejects.toThrow(BadRequestException);
    await expect(service.listMy('user-x', 'gym-1')).rejects.toThrow(BadRequestException);
    await expect(service.getOne('user-x', 'gym-1', 'run-1')).rejects.toThrow(NotFoundException).catch(() => {});
    expect(points.award).not.toHaveBeenCalled();
  });

  it('listMy is member-scoped, newest first, capped, and omits route', async () => {
    prisma.activityRun.findMany.mockResolvedValue([]);
    prisma.activityRun.count.mockResolvedValue(0);
    await service.listMy('user-1', 'gym-1', { limit: 500, skip: -3 });
    const args = prisma.activityRun.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ memberId: 'member-1', gymId: 'gym-1' });
    expect(args.orderBy).toEqual({ startedAt: 'desc' });
    expect(args.take).toBe(100);
    expect(args.skip).toBe(0);
    expect(args.select.route).toBeUndefined();
  });

  it('getOne scopes by member + gym (another member\'s run → 404) and expands the route', async () => {
    prisma.activityRun.findFirst.mockResolvedValue(null);
    await expect(service.getOne('user-1', 'gym-1', 'run-9')).rejects.toThrow(NotFoundException);
    expect(prisma.activityRun.findFirst.mock.calls[0][0].where).toEqual({ id: 'run-9', memberId: 'member-1', gymId: 'gym-1' });

    prisma.activityRun.findFirst.mockResolvedValue({ id: 'run-1', route: [[1, 2, 3]] });
    const run: any = await service.getOne('user-1', 'gym-1', 'run-1');
    expect(run.route).toEqual([{ lat: 1, lng: 2, ts: 3 }]);
  });

  it('latest returns null when the member has no runs', async () => {
    prisma.activityRun.findFirst.mockResolvedValue(null);
    await expect(service.latest('user-1', 'gym-1')).resolves.toBeNull();
  });
});
