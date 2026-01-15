import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryReservationService {
  // Default TTL for reservations: 30 minutes
  private readonly DEFAULT_RESERVATION_TTL_MS = 30 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an inventory reservation for a product.
   * Called when a payment intent is created.
   * 
   * @param productId Product being reserved
   * @param quantity Quantity to reserve
   * @param orderId Associated order ID
   * @param orderItemId Associated order item ID
   * @returns Created reservation record
   */
  async createReservation(
    productId: number,
    quantity: number,
    orderId?: string,
    orderItemId?: string,
  ) {
    // Validate that product exists and has sufficient stock
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException(`Product ${productId} not found`);
    }

    // Check available stock (total stock minus existing reservations)
    const reservedQuantity = await this.getReservedQuantity(productId);
    const availableStock = product.stock - reservedQuantity;

    if (availableStock < quantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${productId}. Available: ${availableStock}, Requested: ${quantity}`,
      );
    }

    // Calculate expiry time
    const expiresAt = new Date(Date.now() + this.DEFAULT_RESERVATION_TTL_MS);

    // Create reservation
    const reservation = await this.prisma.inventoryReservation.create({
      data: {
        productId,
        quantity,
        orderId,
        orderItemId,
        status: 'RESERVED',
        expiresAt,
      },
    });

    return reservation;
  }

  /**
   * Confirm a reservation (mark as CONFIRMED after successful payment).
   * This converts the reservation to a confirmed state but doesn't deduct stock yet.
   */
  async confirmReservation(reservationId: string) {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new BadRequestException(`Reservation ${reservationId} not found`);
    }

    if (reservation.status !== 'RESERVED') {
      throw new BadRequestException(
        `Cannot confirm reservation with status ${reservation.status}`,
      );
    }

    return this.prisma.inventoryReservation.update({
      where: { id: reservationId },
      data: {
        status: 'CONFIRMED',
      },
    });
  }

  /**
   * Release a reservation (restore stock if payment failed or expired).
   * 
   * @param reservationId ID of reservation to release
   * @param reason Reason for release (PAYMENT_FAILED, EXPIRED, MANUAL)
   */
  async releaseReservation(
    reservationId: string,
    reason: 'PAYMENT_FAILED' | 'EXPIRED' | 'MANUAL' = 'MANUAL',
  ) {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new BadRequestException(`Reservation ${reservationId} not found`);
    }

    if (reservation.status === 'RELEASED' || reservation.status === 'EXPIRED') {
      // Already released/expired, idempotent
      return reservation;
    }

    return this.prisma.inventoryReservation.update({
      where: { id: reservationId },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        releaseReason: reason,
      },
    });
  }

  /**
   * Deduct reserved inventory after successful payment.
   * Updates Product stock and marks reservation as CONFIRMED.
   * 
   * @param reservationId ID of reservation to deduct
   */
  async deductReservedStock(reservationId: string) {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new BadRequestException(`Reservation ${reservationId} not found`);
    }

    if (reservation.status === 'RELEASED' || reservation.status === 'EXPIRED') {
      throw new BadRequestException(
        `Cannot deduct from ${reservation.status.toLowerCase()} reservation`,
      );
    }

    // Deduct from product stock
    const product = await this.prisma.product.findUnique({
      where: { id: reservation.productId },
    });

    if (!product) {
      throw new BadRequestException(`Product ${reservation.productId} not found`);
    }

    const newStock = product.stock - reservation.quantity;

    if (newStock < 0) {
      throw new BadRequestException(
        `Insufficient stock to deduct. Current: ${product.stock}, Deducting: ${reservation.quantity}`,
      );
    }

    // Update product stock and mark reservation as confirmed
    await this.prisma.product.update({
      where: { id: reservation.productId },
      data: { stock: newStock },
    });

    return this.prisma.inventoryReservation.update({
      where: { id: reservationId },
      data: {
        status: 'CONFIRMED',
      },
    });
  }

  /**
   * Get total reserved quantity for a product
   */
  async getReservedQuantity(productId: number): Promise<number> {
    const result = await this.prisma.inventoryReservation.aggregate({
      where: {
        productId,
        status: {
          in: ['RESERVED', 'CONFIRMED'],
        },
      },
      _sum: {
        quantity: true,
      },
    });

    return result._sum.quantity || 0;
  }

  /**
   * Get available stock for a product (total - reserved)
   */
  async getAvailableStock(productId: number): Promise<number> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return 0;
    }

    const reserved = await this.getReservedQuantity(productId);
    return Math.max(0, product.stock - reserved);
  }

  /**
   * Release all expired reservations (called periodically by a cron job)
   */
  async releaseExpiredReservations() {
    const now = new Date();

    const expiredReservations = await this.prisma.inventoryReservation.findMany({
      where: {
        status: { in: ['RESERVED', 'CONFIRMED'] },
        expiresAt: { lt: now },
      },
    });

    for (const reservation of expiredReservations) {
      await this.releaseReservation(reservation.id, 'EXPIRED');
    }

    return expiredReservations.length;
  }

  /**
   * Get reservations for an order
   */
  async getOrderReservations(orderId: string) {
    return this.prisma.inventoryReservation.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: Get all reservations (with filtering)
   */
  async getAllReservations(filters?: {
    productId?: number;
    status?: string;
    orderId?: string;
  }) {
    return this.prisma.inventoryReservation.findMany({
      where: {
        ...(filters?.productId && { productId: filters.productId }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.orderId && { orderId: filters.orderId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin: Manually release a reservation
   */
  async adminReleaseReservation(reservationId: string) {
    return this.releaseReservation(reservationId, 'MANUAL');
  }
}
