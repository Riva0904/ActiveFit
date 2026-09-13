import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { PaymentsService } from '../../../src/payments/payments.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ReferralsService } from '../../../src/referrals/referrals.service';
import { PromoCodesService } from '../../../src/promo-codes/promo-codes.service';
import { AuditService } from '../../../src/common/services/audit.service';
import { PAYMENT_COMPLETED } from '../../../src/payments/events/payment.events';

const razorpayOrdersCreate = jest.fn().mockResolvedValue({ id: 'order_test123', amount: 299900, currency: 'INR' });
jest.mock('razorpay', () => jest.fn().mockImplementation(() => ({ orders: { create: razorpayOrdersCreate } })));

const KEY_SECRET = 'test_secret';
const sign = (orderId: string, paymentId: string) =>
  crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

const mockMember = { id: 'member-001', userId: 'user-001', gymId: 'gym-001', referralCredit: 0 };
const mockPayment = {
  id: 'pay-001', amount: 2999, type: 'MEMBERSHIP', status: 'PENDING', method: 'RAZORPAY',
  razorpayOrderId: 'order_test123', memberId: 'member-001', gymId: 'gym-001', promoCodeId: null,
};

const model = () => ({ findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() });
const mockPrisma = { payment: model(), member: model(), membershipPlan: model(), gym: model() };

const mockConfig = {
  get: jest.fn((key: string, fallback?: any) => ({ RAZORPAY_KEY_ID: 'rzp_test_key', RAZORPAY_KEY_SECRET: KEY_SECRET } as any)[key] ?? fallback),
};
const promoCodes = { validate: jest.fn() };
const referrals = { redeemCredit: jest.fn() };
const audit = { log: jest.fn() };
const events = { emit: jest.fn() };

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: ReferralsService, useValue: referrals },
        { provide: PromoCodesService, useValue: promoCodes },
        { provide: AuditService, useValue: audit },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(PaymentsService);
    jest.clearAllMocks();
    mockPrisma.member.findFirst.mockResolvedValue(mockMember);
  });

  describe('findAll', () => {
    it('returns paginated payments filtered by gym', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([mockPayment]);
      mockPrisma.payment.count.mockResolvedValue(1);
      const result: any = await service.findAll({}, 'gym-001');
      expect(result.data).toHaveLength(1);
      expect(mockPrisma.payment.findMany.mock.calls[0][0].where).toEqual({ gymId: 'gym-001' });
    });

    it('filters by status and type', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.payment.count.mockResolvedValue(0);
      await service.findAll({ status: 'COMPLETED', type: 'MEMBERSHIP' }, 'gym-001');
      expect(mockPrisma.payment.findMany.mock.calls[0][0].where).toMatchObject({ status: 'COMPLETED', type: 'MEMBERSHIP' });
    });

    it('narrows to the caller\'s member row for "my payments"', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.payment.count.mockResolvedValue(0);
      await service.findAll({}, 'gym-001', 'user-001');
      expect(mockPrisma.payment.findMany.mock.calls[0][0].where.memberId).toBe('member-001');
    });
  });

  describe('createRazorpayOrder', () => {
    it('rejects a user with no member profile', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);
      await expect(service.createRazorpayOrder(100, 'user-x', 'gym-001', 'MEMBERSHIP')).rejects.toThrow(BadRequestException);
    });

    it('MEMBERSHIP: re-prices from the plan, ignoring the client amount', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue({ id: 'plan-001', price: 3000, discount: 500 });
      mockPrisma.payment.create.mockResolvedValue(mockPayment);

      const res: any = await service.createRazorpayOrder(1, 'user-001', 'gym-001', 'MEMBERSHIP', undefined, undefined, 'plan-001');

      expect(razorpayOrdersCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 250000, currency: 'INR' }));
      expect(res).toMatchObject({ orderId: 'order_test123', amount: 2500, originalAmount: 2500, discountAmount: 0, paymentId: 'pay-001' });
      expect(mockPrisma.payment.create.mock.calls[0][0].data).toMatchObject({ amount: 2500, status: 'PENDING', method: 'RAZORPAY', memberId: 'member-001', gymId: 'gym-001', membershipPlanId: 'plan-001' });
    });

    it('MEMBERSHIP: rejects an unknown / inactive plan', async () => {
      mockPrisma.membershipPlan.findFirst.mockResolvedValue(null);
      await expect(service.createRazorpayOrder(1, 'user-001', 'gym-001', 'MEMBERSHIP', undefined, undefined, 'plan-x')).rejects.toThrow(BadRequestException);
    });

    it('non-membership types (internal callers) must pass a positive amount', async () => {
      await expect(service.createRazorpayOrder(0, 'user-001', 'gym-001', 'SUPPLEMENT')).rejects.toThrow(BadRequestException);
      mockPrisma.payment.create.mockResolvedValue(mockPayment);
      await service.createRazorpayOrder(1500, 'user-001', 'gym-001', 'SUPPLEMENT');
      expect(mockPrisma.payment.create.mock.calls[0][0].data).toMatchObject({ amount: 1500, type: 'SUPPLEMENT', membershipPlanId: null });
    });

    it('applies a valid promo code and records it on the payment', async () => {
      promoCodes.validate.mockResolvedValue({ valid: true, discountAmount: 200, promoCodeId: 'promo-1' });
      mockPrisma.payment.create.mockResolvedValue(mockPayment);
      const res: any = await service.createRazorpayOrder(1000, 'user-001', 'gym-001', 'SUPPLEMENT', 'SAVE20');
      expect(promoCodes.validate).toHaveBeenCalledWith('SAVE20', 'gym-001', 1000);
      expect(res).toMatchObject({ amount: 800, originalAmount: 1000, discountAmount: 200 });
      expect(mockPrisma.payment.create.mock.calls[0][0].data.promoCodeId).toBe('promo-1');
    });

    it('applies referral credit capped by the member balance and redeems it', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ ...mockMember, referralCredit: 150 });
      mockPrisma.payment.create.mockResolvedValue(mockPayment);
      const res: any = await service.createRazorpayOrder(1000, 'user-001', 'gym-001', 'SUPPLEMENT', undefined, 500);
      expect(referrals.redeemCredit).toHaveBeenCalledWith('member-001', 150);
      expect(res.amount).toBe(850);
    });

    it('never lets the payable amount drop below ₹1', async () => {
      promoCodes.validate.mockResolvedValue({ valid: true, discountAmount: 5000, promoCodeId: 'p' });
      mockPrisma.payment.create.mockResolvedValue(mockPayment);
      const res: any = await service.createRazorpayOrder(100, 'user-001', 'gym-001', 'SUPPLEMENT', 'FREE');
      expect(res.amount).toBe(1);
    });

    it('manual UPI: no gateway call, returns the gym VPA, requires the gym to have one', async () => {
      mockPrisma.gym.findUnique.mockResolvedValue({ payoutUpiVpa: 'gym@upi', name: 'FitnessHub' });
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-upi' });
      const res: any = await service.createRazorpayOrder(500, 'user-001', 'gym-001', 'SUPPLEMENT', undefined, undefined, undefined, true);
      expect(razorpayOrdersCreate).not.toHaveBeenCalled();
      expect(res).toMatchObject({ paymentId: 'pay-upi', vpa: 'gym@upi', payeeName: 'FitnessHub', amount: 500 });
      expect(mockPrisma.payment.create.mock.calls[0][0].data.method).toBe('UPI');

      mockPrisma.gym.findUnique.mockResolvedValue({ payoutUpiVpa: null });
      await expect(service.createRazorpayOrder(500, 'user-001', 'gym-001', 'SUPPLEMENT', undefined, undefined, undefined, true)).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyPayment', () => {
    it('throws NotFoundException for an unknown payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.verifyPayment('bad-id', 'pay_xxx', 'sig')).rejects.toThrow(NotFoundException);
    });

    it('hides a payment that belongs to another member (404, not 403)', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.member.findFirst.mockResolvedValue({ ...mockMember, id: 'member-OTHER' });
      await expect(service.verifyPayment('pay-001', 'pay_xxx', 'sig', 'intruder')).rejects.toThrow(NotFoundException);
    });

    it('marks FAILED and throws on a bad signature', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'FAILED' });
      await expect(service.verifyPayment('pay-001', 'pay_xxx', 'invalid')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'FAILED' } }));
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('completes atomically on a valid signature and emits PAYMENT_COMPLETED once', async () => {
      const completed = { ...mockPayment, status: 'COMPLETED' };
      mockPrisma.payment.findUnique.mockResolvedValueOnce(mockPayment).mockResolvedValueOnce(completed);
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });

      const res: any = await service.verifyPayment('pay-001', 'pay_abc', sign('order_test123', 'pay_abc'), 'user-001');

      expect(res.status).toBe('COMPLETED');
      expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-001', status: 'PENDING' },
        data: expect.objectContaining({ status: 'COMPLETED', razorpayPaymentId: 'pay_abc' }),
      });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAYMENT_VERIFIED', entityId: 'pay-001' }));
      expect(events.emit).toHaveBeenCalledTimes(1);
      expect(events.emit.mock.calls[0][0]).toBe(PAYMENT_COMPLETED);
    });

    it('is idempotent: an already COMPLETED payment returns as-is without re-emitting', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({ ...mockPayment, status: 'COMPLETED' });
      const res: any = await service.verifyPayment('pay-001', 'pay_abc', 'whatever');
      expect(res.status).toBe('COMPLETED');
      expect(mockPrisma.payment.updateMany).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('a concurrent verifier that lost the race does not emit a second event', async () => {
      mockPrisma.payment.findUnique.mockResolvedValueOnce(mockPayment).mockResolvedValueOnce({ ...mockPayment, status: 'COMPLETED' });
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 });
      await service.verifyPayment('pay-001', 'pay_abc', sign('order_test123', 'pay_abc'));
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  describe('manual UPI flow', () => {
    const upiPayment = { ...mockPayment, method: 'UPI', razorpayOrderId: null };

    it('markMemberPaid flags the member\'s own pending UPI payment for admin review', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(upiPayment);
      mockPrisma.payment.update.mockResolvedValue({});
      await service.markMemberPaid('pay-001', 'user-001');
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-001' }, data: { memberConfirmedAt: expect.any(Date) } });
    });

    it('markMemberPaid refuses a non-UPI payment and another member\'s payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      await expect(service.markMemberPaid('pay-001', 'user-001')).rejects.toThrow(BadRequestException);
      mockPrisma.payment.findUnique.mockResolvedValue(upiPayment);
      mockPrisma.member.findFirst.mockResolvedValue({ ...mockMember, id: 'member-OTHER' });
      await expect(service.markMemberPaid('pay-001', 'intruder')).rejects.toThrow(NotFoundException);
    });

    it('confirmManualPayment completes only within the admin\'s gym and emits the event', async () => {
      mockPrisma.payment.findUnique.mockResolvedValueOnce(upiPayment).mockResolvedValueOnce({ ...upiPayment, status: 'COMPLETED' });
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      await service.confirmManualPayment('pay-001', 'gym-001');
      expect(events.emit).toHaveBeenCalledWith(PAYMENT_COMPLETED, expect.anything());

      mockPrisma.payment.findUnique.mockResolvedValue(upiPayment);
      await expect(service.confirmManualPayment('pay-001', 'gym-OTHER')).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordCashPayment', () => {
    it('creates a COMPLETED CASH payment stamped paidAt', async () => {
      mockPrisma.payment.create.mockResolvedValue({});
      await service.recordCashPayment({ amount: 2000, type: 'MEMBERSHIP', memberId: 'member-001', gymId: 'gym-001' });
      expect(mockPrisma.payment.create.mock.calls[0][0].data).toMatchObject({ method: 'CASH', status: 'COMPLETED', paidAt: expect.any(Date), amount: 2000 });
    });
  });

  describe('getRevenueStats', () => {
    it('returns monthly, yearly and pending revenue', async () => {
      mockPrisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 50000 } })
        .mockResolvedValueOnce({ _sum: { amount: 350000 } })
        .mockResolvedValueOnce({ _sum: { amount: 15000 }, _count: 7 });
      const result = await service.getRevenueStats('gym-001');
      expect(result).toEqual({ monthlyRevenue: 50000, yearlyRevenue: 350000, pendingAmount: 15000, pendingCount: 7 });
    });

    it('returns 0 for null aggregation results', async () => {
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 });
      const result = await service.getRevenueStats('gym-001');
      expect(result.monthlyRevenue).toBe(0);
      expect(result.pendingAmount).toBe(0);
    });
  });
});
