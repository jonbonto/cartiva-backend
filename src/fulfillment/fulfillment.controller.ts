import {
  Controller,
  Patch,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { FulfillmentService, UpdateFulfillmentDto } from './fulfillment.service';

/**
 * Fulfillment Controller — Admin endpoints for order fulfillment
 * 
 * Endpoints:
 * - PATCH /api/admin/orders/:id/fulfillment - Update fulfillment status/tracking
 * - GET /api/admin/orders/:id/fulfillment/timeline - Get fulfillment history
 * 
 * Access Control:
 * - All endpoints require JWT authentication + admin role
 * 
 * Usage Examples:
 * ```
 * // Mark order as processing
 * PATCH /api/admin/orders/order_123/fulfillment
 * { "fulfillmentStatus": "processing" }
 * 
 * // Mark order as shipped
 * PATCH /api/admin/orders/order_123/fulfillment
 * {
 *   "fulfillmentStatus": "shipped",
 *   "trackingNumber": "1Z999AA10123456784",
 *   "shippingProvider": "UPS"
 * }
 * 
 * // Mark as delivered
 * PATCH /api/admin/orders/order_123/fulfillment
 * { "fulfillmentStatus": "delivered" }
 * ```
 */

@Controller('api/admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  /**
   * PATCH /admin/orders/:id/fulfillment
   * Update order fulfillment status and shipping details
   */
  @Patch(':id/fulfillment')
  @HttpCode(HttpStatus.OK)
  async updateFulfillment(
    @Param('id') orderId: string,
    @Body() dto: UpdateFulfillmentDto,
    @Req() req: any,
  ) {
    const adminId = req.user?.id;

    const updatedOrder = await this.fulfillmentService.updateFulfillment(
      orderId,
      dto,
      adminId,
    );

    return {
      success: true,
      message: 'Fulfillment updated successfully',
      data: updatedOrder,
    };
  }

  /**
   * GET /admin/orders/:id/fulfillment/timeline
   * Get fulfillment timeline for an order
   */
  @Get(':id/fulfillment/timeline')
  async getFulfillmentTimeline(@Param('id') orderId: string) {
    const timeline = await this.fulfillmentService.getFulfillmentTimeline(orderId);

    return {
      success: true,
      data: timeline,
    };
  }
}
