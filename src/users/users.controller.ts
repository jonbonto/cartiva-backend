import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateAddressDto } from './application/dto/create-address.dto'
import { UpdateAddressDto } from './application/dto/update-address.dto'
import { AddPaymentMethodDto } from './application/dto/add-payment-method.dto'
import { JwtAuthGuard } from '../auth/guards/jwt.guard'
import { AddressOwnerGuard } from './guards/address-owner.guard'
import { PaymentMethodOwnerGuard } from './guards/payment-method-owner.guard'

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --- Shipping addresses ---
  @UseGuards(JwtAuthGuard)
  @Post('me/addresses')
  async createAddress(@Req() req: any, @Body() dto: CreateAddressDto) {
    return await this.usersService.createAddress(Number(req.user.id), dto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/addresses')
  async listAddresses(@Req() req: any) {
    return await this.usersService.listAddresses(Number(req.user.id))
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/addresses/:addressId')
  async getAddress(@Req() req: any, @Param('addressId') addressId: string) {
    return await this.usersService.getAddress(Number(req.user.id), addressId)
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/addresses/:addressId')
  async updateAddress(
    @Req() req: any,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return await this.usersService.updateAddress(Number(req.user.id), addressId, dto)
  }

  @UseGuards(JwtAuthGuard, AddressOwnerGuard)
  @Delete('me/addresses/:addressId')
  async deleteAddress(@Req() req: any, @Param('addressId') addressId: string) {
    return await this.usersService.deleteAddress(Number(req.user.id), addressId)
  }

  @UseGuards(JwtAuthGuard, AddressOwnerGuard)
  @Post('me/addresses/:addressId/default')
  async setDefaultAddress(@Req() req: any, @Param('addressId') addressId: string) {
    return await this.usersService.setDefaultAddress(Number(req.user.id), addressId)
  }

  // --- Payment methods ---
  @UseGuards(JwtAuthGuard)
  @Post('me/payment-methods')
  async addPaymentMethod(@Req() req: any, @Body() dto: AddPaymentMethodDto) {
    return await this.usersService.addPaymentMethod(Number(req.user.id), dto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/payment-methods')
  async listPaymentMethods(@Req() req: any) {
    return await this.usersService.listPaymentMethods(Number(req.user.id))
  }
  @UseGuards(JwtAuthGuard, PaymentMethodOwnerGuard)
  @Delete('me/payment-methods/:methodId')
  async removePaymentMethod(@Req() req: any, @Param('methodId') methodId: string) {
    return await this.usersService.removePaymentMethod(Number(req.user.id), methodId)
  }

  @UseGuards(JwtAuthGuard, PaymentMethodOwnerGuard)
  @Post('me/payment-methods/:methodId/default')
  async setDefaultPaymentMethod(@Req() req: any, @Param('methodId') methodId: string) {
    return await this.usersService.setDefaultPaymentMethod(Number(req.user.id), methodId)
  }
}
