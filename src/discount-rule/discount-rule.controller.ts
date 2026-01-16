import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CreateDiscountRuleUseCase } from './application/create-discount-rule.usecase';
import { GetDiscountRuleQuery } from './application/get-discount-rule.query';
import { CreateDiscountRuleDto } from './dto/create-discount-rule.dto';
import { DiscountRule } from './domain/discount-rule.entity';
import { ListDiscountRulesQuery } from './application/list-discount-rules.query';
import { UpdateDiscountRuleUseCase } from './application/update-discount-rule.usecase';
import { DeleteDiscountRuleUseCase } from './application/delete-discount-rule.usecase';
import { UpdateDiscountRuleDto } from './dto/update-discount-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminAuthGuard } from '../admin/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('api/admin/discount-rules')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DiscountRuleController {
  constructor(
    private readonly createUseCase: CreateDiscountRuleUseCase,
    private readonly getQuery: GetDiscountRuleQuery,
    private readonly listQuery: ListDiscountRulesQuery,
    private readonly updateUseCase: UpdateDiscountRuleUseCase,
    private readonly deleteUseCase: DeleteDiscountRuleUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDiscountRuleDto): Promise<DiscountRule> {
    return this.createUseCase.execute(dto);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<DiscountRule | null> {
    return this.getQuery.execute(id);
  }

  @Get('')
  async list(): Promise<DiscountRule[]> {
    return this.listQuery.execute(false);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateDiscountRuleDto): Promise<DiscountRule> {
    return this.updateUseCase.execute(id, dto as any);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.deleteUseCase.execute(id);
  }
}
