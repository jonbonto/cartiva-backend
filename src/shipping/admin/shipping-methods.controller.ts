import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard'
import { AdminGuard } from '../../auth/guards/admin.guard'
import { FeatureFlag } from '../../feature-flags/feature-flags.service'
import { ShippingMethodsAdminService } from './services/shipping-methods-admin.service'
import { GetRequestInfo, RequestInfo } from '../../common/decorators/request-info.decorator'

export interface CreateShippingMethodDto {
  name: string
  description?: string
  baseCostCents: number
  perKgCostCents?: number
  minWeightGrams?: number
  maxWeightGrams?: number
  minDeliveryDays: number
  maxDeliveryDays: number
  supportedCountries: string[]
  active?: boolean
}

export interface UpdateShippingMethodDto {
  name?: string
  description?: string
  baseCostCents?: number
  perKgCostCents?: number
  minWeightGrams?: number
  maxWeightGrams?: number
  minDeliveryDays?: number
  maxDeliveryDays?: number
  supportedCountries?: string[]
  active?: boolean
}

@Controller('api/admin/shipping-methods')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ShippingMethodsController {
  constructor(private shippingMethodsAdminService: ShippingMethodsAdminService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllShippingMethods(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20))
    const skip = (pageNum - 1) * limitNum

    return this.shippingMethodsAdminService.listShippingMethods(undefined, { by: 'name', order: 'asc' }, { limit: limitNum, offset: skip })
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createShippingMethod(
    @Body() dto: CreateShippingMethodDto,
    @GetRequestInfo() info: RequestInfo,
  ) {
    return this.shippingMethodsAdminService.createShippingMethod(dto)
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateShippingMethod(
    @Param('id') id: string,
    @Body() dto: UpdateShippingMethodDto,
    @GetRequestInfo() info: RequestInfo,
  ) {
    return this.shippingMethodsAdminService.updateShippingMethod(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteShippingMethod(
    @Param('id') id: string,
    @GetRequestInfo() info: RequestInfo,
  ) {
    return this.shippingMethodsAdminService.deleteShippingMethod(id)
  }
}
