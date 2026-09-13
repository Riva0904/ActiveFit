import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from '../../../src/attendance/attendance.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const activeUser = { id: 'user-001', firstName: 'John', lastName: 'Doe', role: 'MEMBER', isActive: true };
const mockMember = { id: 'member-001', userId: 'user-001', gymId: 'gym-001', memberCode: 'FH-0001', qrToken: 'qr-token-1', user: activeUser };
const mockMembership = { id: 'sub-001', status: 'ACTIVE' };
const mockAttendance = { id: 'att-001', userId: 'user-001', memberId: 'member-001', gymId: 'gym-001', checkInTime: new Date(), checkOutTime: null, method: 'MANUAL' };

const model = () => ({ findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() });
const mockPrisma: any = {
  member: model(), memberSubscription: model(), attendance: model(), trainer: model(), staff: model(), user: model(),
};
mockPrisma.$transaction = jest.fn(async (fn: any) => fn(mockPrisma));

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttendanceService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(AttendanceService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  describe('checkIn', () => {
    it('checks a member with an active membership in (default method MANUAL)', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(mockMembership);
      mockPrisma.attendance.create.mockResolvedValue(mockAttendance);

      const result = await service.checkIn('user-001', 'gym-001');

      expect(result).toEqual(mockAttendance);
      expect(mockPrisma.attendance.create.mock.calls[0][0].data).toEqual({ userId: 'user-001', memberId: 'member-001', gymId: 'gym-001', method: 'MANUAL' });
    });

    it('records the QR_CODE method when passed', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(mockMembership);
      mockPrisma.attendance.create.mockResolvedValue(mockAttendance);
      await service.checkIn('user-001', 'gym-001', 'QR_CODE');
      expect(mockPrisma.attendance.create.mock.calls[0][0].data.method).toBe('QR_CODE');
    });

    it('rejects a user with no member profile in the gym', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await expect(service.checkIn('user-001', 'gym-001')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.attendance.create).not.toHaveBeenCalled();
    });

    it('rejects when already checked in today', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.attendance.findFirst.mockResolvedValue(mockAttendance);
      await expect(service.checkIn('user-001', 'gym-001')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.attendance.create).not.toHaveBeenCalled();
    });

    it('rejects when there is no active membership', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(null);
      await expect(service.checkIn('user-001', 'gym-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkOut', () => {
    it('stamps checkOutTime on the member\'s own open record', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.attendance.findFirst.mockResolvedValue(mockAttendance);
      mockPrisma.attendance.update.mockResolvedValue({ ...mockAttendance, checkOutTime: new Date() });

      const result: any = await service.checkOut('att-001', 'user-001');

      expect(result.checkOutTime).toBeInstanceOf(Date);
      expect(mockPrisma.attendance.findFirst.mock.calls[0][0].where).toEqual({ id: 'att-001', checkOutTime: null, memberId: 'member-001' });
      expect(mockPrisma.attendance.update).toHaveBeenCalledWith({ where: { id: 'att-001' }, data: { checkOutTime: expect.any(Date) } });
    });

    it('throws NotFoundException when there is no open check-in', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      await expect(service.checkOut('att-001', 'user-001')).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkInByQr (admin kiosk scan)', () => {
    it('resolves the member by qrToken or memberCode within the gym', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(mockMembership);
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.attendance.create.mockResolvedValue(mockAttendance);

      const res: any = await service.checkInByQr('qr-token-1', 'gym-001');

      expect(res.action).toBe('CHECKIN');
      expect(mockPrisma.member.findFirst.mock.calls[0][0].where).toEqual({ gymId: 'gym-001', OR: [{ qrToken: 'qr-token-1' }, { memberCode: 'qr-token-1' }] });
      expect(mockPrisma.attendance.create.mock.calls[0][0].data.method).toBe('QR_CODE');
    });

    it('toggles to CHECKOUT when the member already has an open session', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(mockMembership);
      mockPrisma.attendance.findFirst.mockResolvedValue(mockAttendance);
      mockPrisma.attendance.update.mockResolvedValue({ ...mockAttendance, checkOutTime: new Date() });

      const res: any = await service.checkInByQr('FH-0001', 'gym-001');

      expect(res.action).toBe('CHECKOUT');
      expect(mockPrisma.attendance.update.mock.calls[0][0].where).toEqual({ id: 'att-001' });
      expect(mockPrisma.attendance.create).not.toHaveBeenCalled();
    });

    it('404s on an unknown code (or a code from another gym)', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await expect(service.checkInByQr('nope', 'gym-001')).rejects.toThrow(NotFoundException);
    });

    it('rejects a deactivated member', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ ...mockMember, user: { ...activeUser, isActive: false } });
      await expect(service.checkInByQr('qr-token-1', 'gym-001')).rejects.toThrow(BadRequestException);
    });

    it('rejects when membership is not active', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(null);
      await expect(service.checkInByQr('qr-token-1', 'gym-001')).rejects.toThrow(BadRequestException);
    });
  });

  describe('adminManualCheckIn (member / trainer / staff by code)', () => {
    it('checks in a member by memberCode', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(mockMember);
      mockPrisma.memberSubscription.findFirst.mockResolvedValue(mockMembership);
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.attendance.create.mockResolvedValue({});
      const res = await service.adminManualCheckIn('FH-0001', 'gym-001');
      expect(res).toEqual({ action: 'CHECKIN', userName: 'John Doe', userRole: 'MEMBER', code: 'FH-0001' });
    });

    it('falls through to a trainer by employeeId', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      mockPrisma.trainer.findFirst.mockResolvedValue({ userId: 'u-t', employeeId: 'EMP-7', user: { firstName: 'Tina', lastName: 'T', role: 'TRAINER', isActive: true } });
      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.attendance.create.mockResolvedValue({});
      const res = await service.adminManualCheckIn('EMP-7', 'gym-001');
      expect(res).toEqual({ action: 'CHECKIN', userName: 'Tina T', userRole: 'TRAINER', code: 'EMP-7' });
      expect(mockPrisma.attendance.create.mock.calls[0][0].data).toEqual({ userId: 'u-t', gymId: 'gym-001', method: 'MANUAL' });
    });

    it('checks staff out when they already have an open session', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      mockPrisma.trainer.findFirst.mockResolvedValue(null);
      mockPrisma.staff.findFirst.mockResolvedValue({ userId: 'u-s', employeeId: 'EMP-9', user: { firstName: 'Sam', lastName: 'S', role: 'STAFF', isActive: true } });
      mockPrisma.attendance.findFirst.mockResolvedValue({ id: 'att-9' });
      mockPrisma.attendance.update.mockResolvedValue({});
      const res = await service.adminManualCheckIn('EMP-9', 'gym-001');
      expect(res.action).toBe('CHECKOUT');
      expect(mockPrisma.attendance.update).toHaveBeenCalledWith({ where: { id: 'att-9' }, data: { checkOutTime: expect.any(Date) } });
    });

    it('404s when nothing matches in this gym', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      mockPrisma.trainer.findFirst.mockResolvedValue(null);
      mockPrisma.staff.findFirst.mockResolvedValue(null);
      await expect(service.adminManualCheckIn('ghost', 'gym-001')).rejects.toThrow(NotFoundException);
    });
  });
});
