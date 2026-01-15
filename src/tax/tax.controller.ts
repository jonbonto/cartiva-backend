import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { TaxService } from '../services/tax/tax.service';

@Controller('api/tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get('calculation')
  async calculate(
    @Query('country') country?: string,
    @Query('state') state?: string,
    @Query('city') city?: string,
    @Query('amount') amount?: string,
  ) {
    if (!amount) {
      throw new BadRequestException('amount query parameter is required');
    }

    // Accept amount as decimal (e.g., 12.34) and convert to cents
    const parsed = parseFloat(amount as string);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException('amount must be a valid number');
    }
    const subtotalCents = Math.round(parsed * 100);

    const taxCents = await this.taxService.calculateTax({ country, state, city }, subtotalCents);

    return { taxCents };
  }
}
