import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { scopedWhere } from '../common/utils/gym-scope';
import { UpdateSupplementDto } from './dto/update-supplement.dto';

@Injectable()
export class SupplementsService {
  constructor(private prisma: PrismaService, private paymentsService: PaymentsService) {}

  /**
   * A member's own Member row id, or null when the caller is not a member.
   * Private-supplement visibility is keyed by member id, while the caller only
   * carries a user id.
   */
  private async memberIdFor(user?: { id?: string; role?: string }, gymId?: string): Promise<string | null> {
    if (!user?.id || user.role !== 'MEMBER' || !gymId) return null;
    const member = await this.prisma.member.findFirst({ where: { userId: user.id, gymId }, select: { id: true } });
    return member?.id ?? null;
  }

  /**
   * What this caller may see. Staff, trainers and admins see the whole
   * catalogue; a member sees the public catalogue plus whatever was recommended
   * to them specifically.
   *
   * A member with no Member row (shouldn't happen, but a bad account would) sees
   * only public items — never everything.
   */
  private visibilityWhere(user?: { role?: string }, memberId?: string | null) {
    if (user?.role !== 'MEMBER') return {};
    return memberId
      ? { OR: [{ isPrivate: false }, { assignments: { some: { memberId } } }] }
      : { isPrivate: false };
  }

  async findAll(query: any, gymId?: string, user?: { id?: string; role?: string }) {
    const { page = 1, limit = 12, search, category } = query;
    const skip = (page - 1) * limit;
    const memberId = await this.memberIdFor(user, gymId);

    const where: any = { isActive: true, ...this.visibilityWhere(user, memberId) };
    if (gymId) where.gymId = gymId;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (category) where.category = category;

    const [supplements, total] = await Promise.all([
      this.prisma.supplement.findMany({ where, skip, take: +limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.supplement.count({ where }),
    ]);

    return { data: supplements, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  /** Just the items recommended to this member — the Store's "for you" shelf. */
  async findRecommended(userId: string, gymId: string) {
    const member = await this.prisma.member.findFirst({ where: { userId, gymId }, select: { id: true } });
    if (!member) return [];
    const picks = await this.prisma.supplementAssignment.findMany({
      where: { memberId: member.id, gymId, supplement: { isActive: true } },
      include: { supplement: true },
      orderBy: { assignedAt: 'desc' },
    });
    return picks.map((p) => ({ ...p.supplement, recommendationNote: p.notes, assignedAt: p.assignedAt }));
  }

  /**
   * `gymId` = caller's tenant scope (undefined for SUPER_ADMIN); cross-tenant ids 404.
   * A private item is 404 for a member it was not assigned to — without this,
   * hiding it from the list would still leave it reachable by id.
   */
  async findOne(id: string, gymId?: string, user?: { id?: string; role?: string }) {
    const memberId = await this.memberIdFor(user, gymId);
    const s = await this.prisma.supplement.findFirst({
      where: { id, ...scopedWhere(gymId), ...this.visibilityWhere(user, memberId) },
    });
    if (!s) throw new NotFoundException('Supplement not found');
    return s;
  }

  // ─── Per-member visibility ────────────────────────────────────────────────

  async assignToMember(supplementId: string, memberIdOrUserId: string, gymId: string, notes?: string) {
    const supplement = await this.prisma.supplement.findFirst({ where: { id: supplementId, gymId } });
    if (!supplement) throw new NotFoundException('Supplement not found');

    const member =
      (await this.prisma.member.findFirst({ where: { id: memberIdOrUserId, gymId } })) ??
      (await this.prisma.member.findFirst({ where: { userId: memberIdOrUserId, gymId } }));
    if (!member) throw new NotFoundException('Member not found in this gym');

    return this.prisma.supplementAssignment.upsert({
      where: { supplementId_memberId: { supplementId, memberId: member.id } },
      create: { supplementId, memberId: member.id, gymId, notes },
      update: { notes },
    });
  }

  async unassignFromMember(supplementId: string, memberIdOrUserId: string, gymId: string) {
    const member =
      (await this.prisma.member.findFirst({ where: { id: memberIdOrUserId, gymId } })) ??
      (await this.prisma.member.findFirst({ where: { userId: memberIdOrUserId, gymId } }));
    if (!member) throw new NotFoundException('Member not found in this gym');

    const { count } = await this.prisma.supplementAssignment.deleteMany({
      where: { supplementId, memberId: member.id, gymId },
    });
    if (count === 0) throw new NotFoundException('That supplement is not assigned to this member');
    return { unassigned: true };
  }

  /** Who a supplement is currently recommended to. */
  async listAssignees(supplementId: string, gymId: string) {
    await this.findOne(supplementId, gymId);
    const rows = await this.prisma.supplementAssignment.findMany({
      where: { supplementId, gymId },
      include: {
        member: {
          select: {
            id: true,
            memberCode: true,
            user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
    return rows.map((r) => ({
      memberId: r.member.id,
      memberCode: r.member.memberCode,
      notes: r.notes,
      assignedAt: r.assignedAt,
      ...r.member.user,
    }));
  }

  async create(data: any) {
    return this.prisma.supplement.create({ data });
  }

  async update(id: string, data: UpdateSupplementDto, gymId?: string) {
    await this.findOne(id, gymId);
    return this.prisma.supplement.update({ where: { id }, data });
  }

  async updateStock(id: string, quantity: number, gymId?: string) {
    const s = await this.findOne(id, gymId);
    const newStock = s.stock + quantity;
    if (newStock < 0) throw new BadRequestException('Stock cannot go below zero');
    return this.prisma.supplement.update({ where: { id }, data: { stock: newStock } });
  }

  // Step 1 of checkout: price the cart server-side (never trust client totals), check stock
  // is at least available now (best-effort — re-checked atomically again at fulfillment time
  // since stock can move between checkout and payment completion), then open a Razorpay order.
  // The cart itself rides along in Payment.notes as JSON — fulfillOrder() reads it back once
  // payment is confirmed and only then creates the actual SupplementOrder + decrements stock.
  async createCheckout(userId: string, gymId: string, items: Array<{ supplementId: string; quantity: number }>, useUpi = false) {
    if (!items || items.length === 0) throw new BadRequestException('Cart is empty');

    // Checkout has to apply the same visibility rule as the catalogue: hiding a
    // private item from the list is not a control if it can still be bought by id.
    const member = await this.prisma.member.findFirst({ where: { userId, gymId }, select: { id: true } });
    const visibility = member
      ? { OR: [{ isPrivate: false }, { assignments: { some: { memberId: member.id } } }] }
      : { isPrivate: false };

    let totalAmount = 0;
    for (const item of items) {
      const supplement = await this.prisma.supplement.findFirst({
        where: { id: item.supplementId, gymId, isActive: true, ...visibility },
      });
      if (!supplement) throw new NotFoundException(`Supplement not found: ${item.supplementId}`);
      if (supplement.stock < item.quantity) throw new BadRequestException(`Insufficient stock for ${supplement.name}`);
      const price = supplement.discountPrice ?? supplement.price;
      totalAmount += price * item.quantity;
    }

    const orderResult = await this.paymentsService.createRazorpayOrder(totalAmount, userId, gymId, 'SUPPLEMENT', undefined, undefined, undefined, useUpi);
    await (this.prisma.payment as any).update({
      where: { id: orderResult.paymentId },
      data: { notes: JSON.stringify(items) },
    });
    return orderResult;
  }

  // Called by PaymentEventsHandler once a SUPPLEMENT payment is verified COMPLETED.
  // Builds the real order + decrements stock atomically, then links it back to the payment.
  async fulfillOrder(paymentId: string, userId: string, gymId: string, items: Array<{ supplementId: string; quantity: number }>) {
    if (!items || items.length === 0) throw new BadRequestException('Order must contain at least one item');

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const orderItems: any[] = [];

      for (const item of items) {
        // Verify supplement belongs to this gym
        const supplement = await tx.supplement.findFirst({
          where: { id: item.supplementId, gymId, isActive: true },
        });
        if (!supplement) throw new NotFoundException(`Supplement not found: ${item.supplementId}`);
        if (supplement.stock < item.quantity) throw new BadRequestException(`Insufficient stock for ${supplement.name}`);

        const price = supplement.discountPrice ?? supplement.price;
        totalAmount += price * item.quantity;
        orderItems.push({ supplementId: item.supplementId, quantity: item.quantity, unitPrice: price, totalPrice: price * item.quantity });
      }

      const order = await tx.supplementOrder.create({
        data: {
          userId,
          gymId,
          paymentId,
          orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          totalAmount,
          items: { create: orderItems },
        },
        include: { items: { include: { supplement: true } } },
      });

      // Atomically decrement stock — fails if stock dropped below required quantity concurrently
      for (const item of items) {
        const updated = await tx.supplement.updateMany({
          where: { id: item.supplementId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) throw new BadRequestException('Insufficient stock (concurrent order conflict)');
      }

      return order;
    });
  }

  /**
   * `mine` means "only this user's orders". It is passed explicitly rather than
   * inferred from `userId` being set, so a caller who resolves to no user can
   * never fall through to the gym-wide list.
   */
  async getOrders(query: any, gymId?: string, userId?: string, mine = false) {
    const { page = 1, limit = 10 } = query;
    const where: any = {};
    if (gymId) where.gymId = gymId;
    if (mine) {
      if (!userId) return { data: [], total: 0, page: +page, limit: +limit, totalPages: 0 };
      where.userId = userId;
    } else if (userId) {
      where.userId = userId;
    }

    const [orders, total] = await Promise.all([
      this.prisma.supplementOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { supplement: { select: { name: true, images: true } } } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.supplementOrder.count({ where }),
    ]);

    return { data: orders, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async remove(id: string, gymId?: string) {
    await this.findOne(id, gymId);
    await this.prisma.supplement.update({ where: { id }, data: { isActive: false } });
    return { message: 'Supplement removed successfully' };
  }

  async updateOrderStatus(orderId: string, status: any, gymId?: string) {
    const VALID_TRANSITIONS: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    };
    const order = await this.prisma.supplementOrder.findFirst({ where: { id: orderId, ...scopedWhere(gymId) } });
    if (!order) throw new NotFoundException('Order not found');
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot transition order from ${order.status} to ${status}`);
    }
    return this.prisma.supplementOrder.update({ where: { id: orderId }, data: { status } });
  }
}
