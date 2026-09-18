import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { AttendanceExportService } from './attendance-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { resolveGymScope } from '../common/utils/gym-scope';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly exportService: AttendanceExportService,
  ) {}

  // ─── Admin-only endpoints ─────────────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    const gymId = [Role.GYM_ADMIN, Role.STAFF].includes(user.role) ? user.gymId : query.gymId;
    return this.attendanceService.findAll(query, gymId);
  }

  @Get('stats/today')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get today attendance stats' })
  // `?gymId=` is read for a SUPER_ADMIN drilling into a gym and ignored for
  // everyone else — see resolveGymScope. Same for every handler below.
  getTodayStats(@CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.attendanceService.getTodayStats(resolveGymScope(user, gymId));
  }

  @Get('stats/weekly')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get weekly attendance report' })
  getWeeklyReport(@CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.attendanceService.getWeeklyReport(resolveGymScope(user, gymId));
  }

  @Post('qr-check-in')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Admin kiosk: scan member QR or enter member ID' })
  qrCheckIn(@Body('qrCode') qrCode: string, @CurrentUser() user: any) {
    return this.attendanceService.checkInByQr(qrCode, user.gymId);
  }

  @Post('admin-manual-check-in')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Admin: check-in/out any member, trainer, or staff by their ID code' })
  adminManualCheckIn(@Body('code') code: string, @CurrentUser() user: any) {
    return this.attendanceService.adminManualCheckIn(code, user.gymId);
  }

  @Post('check-in')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF, Role.MEMBER)
  @ApiOperation({ summary: 'Admin/Staff: manual check-in for self. Member: explicit check-in (smart QR flow)' })
  checkIn(@CurrentUser() user: any) {
    return user.role === Role.MEMBER
      ? this.attendanceService.memberCheckIn(user.id, user.gymId)
      : this.attendanceService.checkIn(user.id, user.gymId);
  }

  @Patch(':id/check-out')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Admin: manual check-out' })
  checkOut(@Param('id') id: string, @CurrentUser() user: any) {
    return this.attendanceService.checkOut(id, user.id);
  }

  // ─── Member / Trainer / Staff endpoints ───────────────────────────────────

  @Post('self-check-in')
  @ApiOperation({ summary: 'Member/Trainer/Staff: self check-in via gym QR scan' })
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF)
  selfCheckIn(@CurrentUser() user: any) {
    return this.attendanceService.selfCheckIn(user.id, user.gymId);
  }

  @Get('my-status')
  @ApiOperation({ summary: 'Check if currently checked in today' })
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  getMyStatus(@CurrentUser() user: any) {
    return this.attendanceService.getMyStatus(user.id, user.gymId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get own attendance history' })
  @Roles(Role.MEMBER, Role.TRAINER, Role.STAFF, Role.GYM_ADMIN)
  getMyAttendance(@CurrentUser() user: any, @Query() query: any) {
    return this.attendanceService.getMyAttendance(user.id, user.gymId, query);
  }

  // ─── Smart QR flow: explicit member check-in/check-out (not a toggle) ────

  @Post('check-out')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  @ApiOperation({ summary: 'Member: explicit check-out (smart QR flow)' })
  memberCheckOut(@CurrentUser() user: any) {
    return this.attendanceService.memberCheckOut(user.id, user.gymId);
  }

  @Get('status')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  @ApiOperation({ summary: 'Member: current check-in status (smart QR flow)' })
  getStatus(@CurrentUser() user: any) {
    return this.attendanceService.getStatus(user.id, user.gymId);
  }

  @Get('history')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  @ApiOperation({ summary: 'Member: formatted attendance history (smart QR flow)' })
  getHistory(@CurrentUser() user: any, @Query() query: any) {
    return this.attendanceService.getHistory(user.id, user.gymId, query);
  }

  /**
   * One member's attendance for their trainer or a gym admin. The gym-wide
   * attendance routes stay closed to trainers; the service allows a trainer
   * through only for a member assigned to them.
   */
  @Get('member/:memberId')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Trainer/admin: one member's attendance summary" })
  getMemberAttendance(
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.attendanceService.getMemberAttendance(
      user,
      memberId,
      resolveGymScope(user),
      month ? +month : undefined,
      year ? +year : undefined,
    );
  }

  // ─── Staff/Admin: explicit manual check-in/check-out (not a toggle) ──────

  @Post('manual-check-in')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Staff/Admin: explicit manual check-in by ID code' })
  manualCheckIn(@Body('code') code: string, @CurrentUser() user: any) {
    return this.attendanceService.manualCheckIn(code, user.gymId, user.id);
  }

  @Post('manual-check-out')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Staff/Admin: explicit manual check-out by ID code' })
  manualCheckOut(@Body('code') code: string, @CurrentUser() user: any) {
    return this.attendanceService.manualCheckOut(code, user.gymId);
  }

  // ─── Occupancy & analytics ─────────────────────────────────────────────────

  @Get('occupancy')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Live gym occupancy (currently-in count vs capacity)' })
  getOccupancy(@CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.attendanceService.getOccupancy(resolveGymScope(user, gymId));
  }

  @Get('analytics')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Attendance analytics: avg duration, daily/monthly trend, peak hours, peak day, most active members' })
  getAnalytics(@CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.attendanceService.getAnalytics(resolveGymScope(user, gymId));
  }

  // ─── Attendance Intelligence V2 ─────────────────────────────────────────────

  @Get('streak')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  @ApiOperation({ summary: 'Member: current + best consecutive-day attendance streak' })
  getStreak(@CurrentUser() user: any) {
    return this.attendanceService.getStreak(user.id, user.gymId);
  }

  @Get('inactive-members')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Members absent 5+/7+/14+/30+ days, with severity (LOW/MEDIUM/HIGH/CRITICAL)' })
  getInactiveMembers(@CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.attendanceService.getInactiveMembers(resolveGymScope(user, gymId));
  }

  @Get('calendar')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  @ApiOperation({ summary: 'Member: GitHub-style present-dates calendar for a given month + attendance rate' })
  getCalendar(@Query('month') month: string, @Query('year') year: string, @CurrentUser() user: any) {
    const m = +month, y = +year;
    if (!m || !y || m < 1 || m > 12) throw new BadRequestException('Valid month (1-12) and year are required');
    return this.attendanceService.getCalendar(user.id, user.gymId, m, y);
  }

  @Get('occupancy-trend')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  @ApiOperation({ summary: "Today's occupancy snapshots (captured every 30 minutes) for a trend chart" })
  getOccupancyTrend(@CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.attendanceService.getOccupancyTrend(resolveGymScope(user, gymId));
  }

  @Get('leaderboard')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.STAFF, Role.MEMBER)
  @ApiOperation({ summary: 'Top 10 members by visit count this calendar month' })
  getLeaderboard(@CurrentUser() user: any, @Query('gymId') gymId?: string) {
    return this.attendanceService.getLeaderboard(resolveGymScope(user, gymId));
  }

  @Get('my-insights')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  @ApiOperation({ summary: 'Member: personal fitness activity insights' })
  getMyInsights(@CurrentUser() user: any) {
    return this.attendanceService.getMyInsights(user.id, user.gymId);
  }

  // ─── Exports (Admin only) ──────────────────────────────────────────────────

  @Get('export/csv')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export attendance records as CSV (filters: startDate, endDate, memberId, trainerId, planId)' })
  async exportCsv(@Query() query: any, @CurrentUser() user: any, @Res() res: Response) {
    const records = await this.attendanceService.getExportRecords(user.gymId, query);
    const csv = this.exportService.toCsv(records);
    res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="attendance.csv"' });
    res.send(csv);
  }

  @Get('export/excel')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export attendance records as Excel (.xlsx)' })
  async exportExcel(@Query() query: any, @CurrentUser() user: any, @Res() res: Response) {
    const records = await this.attendanceService.getExportRecords(user.gymId, query);
    const buffer = await this.exportService.toExcel(records);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="attendance.xlsx"',
    });
    res.send(buffer);
  }

  @Get('export/pdf')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export attendance records as PDF' })
  async exportPdf(@Query() query: any, @CurrentUser() user: any, @Res() res: Response) {
    const records = await this.attendanceService.getExportRecords(user.gymId, query);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="attendance.pdf"' });
    this.exportService.toPdf(records, res);
  }
}
