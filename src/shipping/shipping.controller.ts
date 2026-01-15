import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ShippingService } from '../services/shipping/shipping.service';

@Controller('api/shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('methods')
  async getMethods(
    @Query('country') country: string,
    @Query('weightGrams') weightGrams?: string,
  ) {
    if (!country) {
      throw new BadRequestException('country query parameter is required');
    }

    const wg = weightGrams !== undefined && weightGrams !== '' ? parseInt(weightGrams, 10) : undefined;

    const methods = await this.shippingService.getAvailableShippingMethods(country, wg);

    // Normalize output to include estimated cost and delivery window
    const normalized = await Promise.all(
      methods.map(async (m) => {
        const detail = await this.shippingService.getShippingMethodDetail(m.id, wg ?? 0);
        if (detail) return detail;
        return {
          id: m.id,
          name: m.name,
          description: m.description,
          baseCostCents: m.baseCostCents,
          estimatedCostCents: m.baseCostCents,
          minDeliveryDays: m.minDeliveryDays,
          maxDeliveryDays: m.maxDeliveryDays,
        };
      }),
    );

    return { data: normalized };
  }
}
