import { Body, Controller, Post } from '@nestjs/common'
import { ValidateDiscountUseCase } from './application/validate-discount.usecase'
import { ValidateDiscountDto, ValidateDiscountResponseDto } from './dto/validate-discount.dto'

@Controller('api/discount-rules')
export class DiscountRulePublicController {
  constructor(private readonly validateUseCase: ValidateDiscountUseCase) {}

  @Post('validate')
  async validate(@Body() dto: ValidateDiscountDto): Promise<ValidateDiscountResponseDto> {
    return this.validateUseCase.execute(dto)
  }
}
