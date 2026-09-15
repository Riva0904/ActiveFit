import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../gamification/points.service';
import { CreateRunDto } from './dto/create-run.dto';

const RUN_SELECT = {
  id: true, memberId: true, gymId: true, startedAt: true, endedAt: true,
  distanceMeters: true, durationSec: true, calories: true, avgPaceSecPerKm: true, createdAt: true,
} as const;

@Injectable()
export class ActivitiesService {
  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
  ) {}

  private async memberOf(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId }, select: { id: true } });
    if (!member) throw new BadRequestException('Member profile not found');
    return member;
  }

  /** Seconds per km, null when the run is too short to be meaningful. */
  static pace(distanceMeters: number, durationSec: number): number | null {
    if (distanceMeters < 100 || durationSec <= 0) return null;
    return Math.round(durationSec / (distanceMeters / 1000));
  }

  async createRun(userId: string, gymId: string, dto: CreateRunDto) {
    const member = await this.memberOf(userId, gymId);
    const startedAt = new Date(dto.startedAt);
    const endedAt = new Date(dto.endedAt);
    if (endedAt <= startedAt) throw new BadRequestException('endedAt must be after startedAt');

    const run = await this.prisma.activityRun.create({
      data: {
        memberId: member.id,
        gymId,
        startedAt,
        endedAt,
        distanceMeters: dto.distanceMeters,
        durationSec: dto.durationSec,
        calories: dto.calories ?? null,
        avgPaceSecPerKm: ActivitiesService.pace(dto.distanceMeters, dto.durationSec),
        // Compact tuple form; validated as objects by the DTO.
        route: dto.route.map((p) => [p.lat, p.lng, p.ts]),
      },
      select: RUN_SELECT,
    });

    // Non-fatal: PointsService.award swallows its own errors.
    await this.pointsService.award(member.id, gymId, 'RUN_LOGGED');

    return run;
  }

  /** The caller's runs, newest first, without the route payload. */
  async listMy(userId: string, gymId: string, opts: { limit?: number; skip?: number } = {}) {
    const member = await this.memberOf(userId, gymId);
    const take = Math.min(Math.max(Number(opts.limit) || 20, 1), 100);
    const skip = Math.max(Number(opts.skip) || 0, 0);
    const where = { memberId: member.id, gymId };
    const [data, total] = await Promise.all([
      this.prisma.activityRun.findMany({ where, orderBy: { startedAt: 'desc' }, take, skip, select: RUN_SELECT }),
      this.prisma.activityRun.count({ where }),
    ]);
    return { data, total };
  }

  /** One run with its route — member-scoped, so another member's id is a 404. */
  async getOne(userId: string, gymId: string, id: string) {
    const member = await this.memberOf(userId, gymId);
    const run = await this.prisma.activityRun.findFirst({ where: { id, memberId: member.id, gymId } });
    if (!run) throw new NotFoundException('Run not found');
    const route = (run.route as unknown as [number, number, number][]).map(([lat, lng, ts]) => ({ lat, lng, ts }));
    return { ...run, route };
  }

  /** Most recent run including its route (Home summary card). */
  async latest(userId: string, gymId: string) {
    const member = await this.memberOf(userId, gymId);
    // createdAt breaks ties so two runs sharing a startedAt resolve deterministically.
    const run = await this.prisma.activityRun.findFirst({
      where: { memberId: member.id, gymId },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (!run) return null;
    const route = (run.route as unknown as [number, number, number][]).map(([lat, lng, ts]) => ({ lat, lng, ts }));
    return { ...run, route };
  }
}
