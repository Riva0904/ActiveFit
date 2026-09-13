import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SupplementsService } from '../../../src/supplements/supplements.service';
import { PaymentsService } from '../../../src/payments/payments.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const mockSupplement = {
  id: 'sup-001', name: 'Whey Protein', category: 'Protein', brand: 'ON',
  price: 3999, discountPrice: 3499, stock: 50, gymId: 'gym-001', isActive: true, images: [],
};

const mockPrisma: any = {
  supplement: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
  supplementOrder: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), count: jest.fn() },
  payment: { update: jest.fn() },
};
// Interactive transaction: hand the same stub back as `tx`
mockPrisma.$transaction = jest.fn(async (fn: any) => fn(mockPrisma));

const payments = { createRazorpayOrder: jest.fn() };

describe('SupplementsService', () => {
  let service: SupplementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplementsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentsService, useValue: payments },
      ],
    }).compile();
    service = module.get(SupplementsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
  });

  describe('findAll', () => {
    it('returns paginated active supplements for the gym', async () => {
      mockPrisma.supplement.findMany.mockResolvedValue([mockSupplement]);
      mockPrisma.supplement.count.mockResolvedValue(1);
      const result: any = await service.findAll({}, 'gym-001');
      expect(result.data).toHaveLength(1);
      expect(mockPrisma.supplement.findMany.mock.calls[0][0].where).toMatchObject({ isActive: true, gymId: 'gym-001' });
    });

    it('filters by category and search', async () => {
      mockPrisma.supplement.findMany.mockResolvedValue([]);
      mockPrisma.supplement.count.mockResolvedValue(0);
      await service.findAll({ category: 'Protein', search: 'whey' }, 'gym-001');
      const where = mockPrisma.supplement.findMany.mock.calls[0][0].where;
      expect(where.category).toBe('Protein');
      expect(where.name).toEqual({ contains: 'whey', mode: 'insensitive' });
    });
  });

  describe('findOne', () => {
    it('returns the supplement (tenant-scoped)', async () => {
      mockPrisma.supplement.findFirst.mockResolvedValue(mockSupplement);
      await expect(service.findOne('sup-001', 'gym-001')).resolves.toEqual(mockSupplement);
      expect(mockPrisma.supplement.findFirst.mock.calls[0][0].where).toEqual({ id: 'sup-001', gymId: 'gym-001' });
    });

    it('throws NotFoundException for an unknown supplement', async () => {
      mockPrisma.supplement.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStock', () => {
    it('adds to existing stock', async () => {
      mockPrisma.supplement.findFirst.mockResolvedValue(mockSupplement); // stock 50
      mockPrisma.supplement.update.mockResolvedValue({ ...mockSupplement, stock: 70 });
      await service.updateStock('sup-001', 20, 'gym-001');
      expect(mockPrisma.supplement.update).toHaveBeenCalledWith({ where: { id: 'sup-001' }, data: { stock: 70 } });
    });

    it('subtracts with a negative quantity', async () => {
      mockPrisma.supplement.findFirst.mockResolvedValue(mockSupplement);
      mockPrisma.supplement.update.mockResolvedValue({});
      await service.updateStock('sup-001', -10, 'gym-001');
      expect(mockPrisma.supplement.update.mock.calls[0][0].data.stock).toBe(40);
    });

    it('refuses to go below zero', async () => {
      mockPrisma.supplement.findFirst.mockResolvedValue(mockSupplement);
      await expect(service.updateStock('sup-001', -60, 'gym-001')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.supplement.update).not.toHaveBeenCalled();
    });
  });

  describe('createCheckout (step 1 — price cart, open payment)', () => {
    it('rejects an empty cart', async () => {
      await expect(service.createCheckout('user-001', 'gym-001', [])).rejects.toThrow(BadRequestException);
    });

    it('prices server-side using discountPrice and opens a SUPPLEMENT payment carrying the cart', async () => {
      mockPrisma.supplement.findFirst.mockResolvedValue(mockSupplement); // discountPrice 3499
      payments.createRazorpayOrder.mockResolvedValue({ orderId: 'order_1', paymentId: 'pay-1', amount: 6998 });
      mockPrisma.payment.update.mockResolvedValue({});

      const items = [{ supplementId: 'sup-001', quantity: 2 }];
      const res = await service.createCheckout('user-001', 'gym-001', items, true);

      expect(payments.createRazorpayOrder).toHaveBeenCalledWith(6998, 'user-001', 'gym-001', 'SUPPLEMENT', undefined, undefined, undefined, true);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { notes: JSON.stringify(items) } });
      expect(res.paymentId).toBe('pay-1');
      // does NOT create the order or touch stock yet
      expect(mockPrisma.supplementOrder.create).not.toHaveBeenCalled();
      expect(mockPrisma.supplement.updateMany).not.toHaveBeenCalled();
    });

    it('falls back to list price when there is no discount', async () => {
      mockPrisma.supplement.findFirst.mockResolvedValue({ ...mockSupplement, discountPrice: null });
      payments.createRazorpayOrder.mockResolvedValue({ paymentId: 'pay-1' });
      await service.createCheckout('user-001', 'gym-001', [{ supplementId: 'sup-001', quantity: 1 }]);
      expect(payments.createRazorpayOrder.mock.calls[0][0]).toBe(3999);
    });

    it('404s on a product from another gym / inactive', async () => {
      mockPrisma.supplement.findFirst.mockResolvedValue(null);
      await expect(service.createCheckout('user-001', 'gym-001', [{ supplementId: 'sup-x', quantity: 1 }])).rejects.toThrow(NotFoundException);
      expect(mockPrisma.supplement.findFirst.mock.calls[0][0].where).toEqual({ id: 'sup-x', gymId: 'gym-001', isActive: true });
    });

    it('rejects insufficient stock up front', async () => {
      mockPrisma.supplement.findFirst.mockResolvedValue({ ...mockSupplement, stock: 1 });
      await expect(service.createCheckout('user-001', 'gym-001', [{ supplementId: 'sup-001', quantity: 5 }])).rejects.toThrow(BadRequestException);
      expect(payments.createRazorpayOrder).not.toHaveBeenCalled();
    });
  });

  describe('fulfillOrder (step 2 — after payment COMPLETED)', () => {
    const items = [{ supplementId: 'sup-001', quantity: 3 }];

    it('creates the order with line items and atomically decrements stock', async () => {
      mockPrisma.supplement.findFirst.mockResolvedValue(mockSupplement);
      mockPrisma.supplementOrder.create.mockResolvedValue({ id: 'ord-1', items: [] });
      mockPrisma.supplement.updateMany.mockResolvedValue({ count: 1 });

      await service.fulfillOrder('pay-1', 'user-001', 'gym-001', items);

      const { data } = mockPrisma.supplementOrder.create.mock.calls[0][0];
      expect(data).toMatchObject({ userId: 'user-001', gymId: 'gym-001', paymentId: 'pay-1', totalAmount: 3499 * 3 });
      expect(data.items.create[0]).toEqual({ supplementId: 'sup-001', quantity: 3, unitPrice: 3499, totalPrice: 3499 * 3 });
      expect(mockPrisma.supplement.updateMany).toHaveBeenCalledWith({
        where: { id: 'sup-001', stock: { gte: 3 } },
        data: { stock: { decrement: 3 } },
      });
    });

    it('fails the transaction when stock moved underneath us', async () => {
      mockPrisma.supplement.findFirst.mockResolvedValue(mockSupplement);
      mockPrisma.supplementOrder.create.mockResolvedValue({ id: 'ord-1' });
      mockPrisma.supplement.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.fulfillOrder('pay-1', 'user-001', 'gym-001', items)).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty item list', async () => {
      await expect(service.fulfillOrder('pay-1', 'user-001', 'gym-001', [])).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateOrderStatus', () => {
    it.each([
      ['PENDING', 'CONFIRMED'], ['PENDING', 'CANCELLED'], ['CONFIRMED', 'DELIVERED'], ['CONFIRMED', 'CANCELLED'],
    ])('allows %s → %s', async (from, to) => {
      mockPrisma.supplementOrder.findFirst.mockResolvedValue({ id: 'ord-001', status: from, gymId: 'gym-001' });
      mockPrisma.supplementOrder.update.mockResolvedValue({ id: 'ord-001', status: to });
      await service.updateOrderStatus('ord-001', to, 'gym-001');
      expect(mockPrisma.supplementOrder.update).toHaveBeenCalledWith({ where: { id: 'ord-001' }, data: { status: to } });
    });

    it.each([
      ['DELIVERED', 'CANCELLED'], ['CANCELLED', 'CONFIRMED'], ['PENDING', 'DELIVERED'],
    ])('rejects %s → %s', async (from, to) => {
      mockPrisma.supplementOrder.findFirst.mockResolvedValue({ id: 'ord-001', status: from, gymId: 'gym-001' });
      await expect(service.updateOrderStatus('ord-001', to, 'gym-001')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.supplementOrder.update).not.toHaveBeenCalled();
    });

    it('404s on another gym\'s order', async () => {
      mockPrisma.supplementOrder.findFirst.mockResolvedValue(null);
      await expect(service.updateOrderStatus('ord-001', 'CONFIRMED', 'gym-A')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrders', () => {
    it('scopes by gym and/or user', async () => {
      mockPrisma.supplementOrder.findMany.mockResolvedValue([]);
      mockPrisma.supplementOrder.count.mockResolvedValue(0);
      await service.getOrders({}, 'gym-001', 'user-001');
      expect(mockPrisma.supplementOrder.findMany.mock.calls[0][0].where).toEqual({ gymId: 'gym-001', userId: 'user-001' });
    });
  });
});
