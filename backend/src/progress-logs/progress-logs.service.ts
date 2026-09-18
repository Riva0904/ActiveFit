import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../gamification/points.service';
import { resolveReadableMember } from '../common/utils/trainer-access';
import { CreateProgressLogDto } from './dto/create-progress-log.dto';

@Injectable()
export class ProgressLogsService {
  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
  ) {}

  async findByUser(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (!member) return [];

    return this.prisma.progressLog.findMany({
      where: { memberId: member.id },
      orderBy: { logDate: 'desc' },
    });
  }

  /**
   * One member's logs, read by their trainer or a gym admin.
   *
   * `resolveReadableMember` is the gate: a trainer only gets through for a
   * member actually assigned to them, so this does not become a way to read the
   * whole gym's body measurements.
   */
  async findForMember(caller: { id: string; role: string }, memberIdOrUserId: string, gymId: string) {
    const memberId = await resolveReadableMember(this.prisma, caller, memberIdOrUserId, gymId);
    return this.prisma.progressLog.findMany({
      where: { memberId },
      orderBy: { logDate: 'desc' },
    });
  }

  async create(userId: string, gymId: string, data: CreateProgressLogDto) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId } });
    if (!member) throw new BadRequestException('Member profile not found');

    const { weight, height, logDate, ...rest } = data;
    let bmi: number | undefined;
    if (weight && height) {
      const heightM = height / 100;
      bmi = parseFloat((weight / (heightM * heightM)).toFixed(1));
    }

    const log = await this.prisma.progressLog.create({
      data: {
        ...rest,
        weight,
        height,
        bmi,
        ...(logDate ? { logDate: new Date(logDate) } : {}),
        memberId: member.id,
        gymId,
      },
    });

    // PROGRESS_LOG has been in POINTS_CONFIG since the start but was never awarded.
    await this.pointsService.award(member.id, gymId, 'PROGRESS_LOG');

    return log;
  }
}
