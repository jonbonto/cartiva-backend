import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateAddressDto } from './application/dto/create-address.dto'
import { UpdateAddressDto } from './application/dto/update-address.dto'
import { AddPaymentMethodDto } from './application/dto/add-payment-method.dto'

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --- Shipping addresses ---
  @Post(':userId/addresses')
  async createAddress(@Param('userId') userId: string, @Body() dto: CreateAddressDto) {
    return await this.usersService.createAddress(Number(userId), dto)
  }

  @Get(':userId/addresses')
  async listAddresses(@Param('userId') userId: string) {
    return await this.usersService.listAddresses(Number(userId))
  }

  @Get(':userId/addresses/:addressId')
  async getAddress(@Param('userId') userId: string, @Param('addressId') addressId: string) {
    return await this.usersService.getAddress(Number(userId), addressId)
  }

  @Patch(':userId/addresses/:addressId')
  async updateAddress(
    @Param('userId') userId: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return await this.usersService.updateAddress(Number(userId), addressId, dto)
  }

  @Delete(':userId/addresses/:addressId')
  async deleteAddress(@Param('userId') userId: string, @Param('addressId') addressId: string) {
    return await this.usersService.deleteAddress(Number(userId), addressId)
  }

  @Post(':userId/addresses/:addressId/default')
  async setDefaultAddress(@Param('userId') userId: string, @Param('addressId') addressId: string) {
    return await this.usersService.setDefaultAddress(Number(userId), addressId)
  }

  // --- Payment methods ---
  @Post(':userId/payment-methods')
  async addPaymentMethod(@Param('userId') userId: string, @Body() dto: AddPaymentMethodDto) {
    return await this.usersService.addPaymentMethod(Number(userId), dto)
  }

  @Get(':userId/payment-methods')
  async listPaymentMethods(@Param('userId') userId: string) {
    return await this.usersService.listPaymentMethods(Number(userId))
  }

  @Delete(':userId/payment-methods/:methodId')
  async removePaymentMethod(@Param('userId') userId: string, @Param('methodId') methodId: string) {
    return await this.usersService.removePaymentMethod(Number(userId), methodId)
  }

  @Post(':userId/payment-methods/:methodId/default')
  async setDefaultPaymentMethod(@Param('userId') userId: string, @Param('methodId') methodId: string) {
    return await this.usersService.setDefaultPaymentMethod(Number(userId), methodId)
  }
}
