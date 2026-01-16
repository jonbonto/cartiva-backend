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
import { TaxRulesAdminService } from './services/tax-rules-admin.service'
import { GetRequestInfo, RequestInfo } from '../../common/decorators/request-info.decorator'

export interface CreateTaxRuleDto {
  country: string
  state?: string
  city?: string
  taxRate: number
}

export interface UpdateTaxRuleDto {
  country?: string
  state?: string
  city?: string
  taxRate?: number
}

@Controller('api/admin/tax-rules')
@UseGuards(JwtAuthGuard, AdminGuard)
export class TaxRulesController {
  constructor(private taxRulesAdminService: TaxRulesAdminService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllTaxRules(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20))
    const skip = (pageNum - 1) * limitNum

    return this.taxRulesAdminService.listTaxRules(undefined, { by: 'country', order: 'asc' }, { limit: limitNum, offset: skip })
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTaxRule(
    @Body() dto: CreateTaxRuleDto,
    @GetRequestInfo() info: RequestInfo,
  ) {
    return this.taxRulesAdminService.createTaxRule(dto)
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateTaxRule(
    @Param('id') id: string,
    @Body() dto: UpdateTaxRuleDto,
    @GetRequestInfo() info: RequestInfo,
  ) {
    return this.taxRulesAdminService.updateTaxRule(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTaxRule(
    @Param('id') id: string,
    @GetRequestInfo() info: RequestInfo,
  ) {
    return this.taxRulesAdminService.deleteTaxRule(id)
  }
}
