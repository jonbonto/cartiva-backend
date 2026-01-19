import { Injectable, Inject } from '@nestjs/common'
import { CreateAddressDto } from './application/dto/create-address.dto'
import { UpdateAddressDto } from './application/dto/update-address.dto'
import { AddPaymentMethodDto } from './application/dto/add-payment-method.dto'
import { CreateShippingAddressUseCase } from './application/use-cases/create-shipping-address.usecase'
import { UpdateShippingAddressUseCase } from './application/use-cases/update-shipping-address.usecase'
import { DeleteShippingAddressUseCase } from './application/use-cases/delete-shipping-address.usecase'
import { SetDefaultAddressUseCase } from './application/use-cases/set-default-address.usecase'
import { AddPaymentMethodUseCase } from './application/use-cases/add-payment-method.usecase'
import { RemovePaymentMethodUseCase } from './application/use-cases/remove-payment-method.usecase'
import { SetDefaultPaymentMethodUseCase } from './application/use-cases/set-default-payment-method.usecase'
import { USER_REPOSITORY, UserRepository } from './domain/user.repository'

@Injectable()
export class UsersService {
  constructor(
    private readonly createAddressUseCase: CreateShippingAddressUseCase,
    private readonly updateAddressUseCase: UpdateShippingAddressUseCase,
    private readonly deleteAddressUseCase: DeleteShippingAddressUseCase,
    private readonly setDefaultAddressUseCase: SetDefaultAddressUseCase,
    private readonly addPaymentMethodUseCase: AddPaymentMethodUseCase,
    private readonly removePaymentMethodUseCase: RemovePaymentMethodUseCase,
    private readonly setDefaultPaymentMethodUseCase: SetDefaultPaymentMethodUseCase,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  createAddress(userId: number, dto: CreateAddressDto) {
    return this.createAddressUseCase.execute(userId, dto)
  }

  listAddresses(userId: number) {
    return this.userRepository.listShippingAddresses(userId)
  }

  getAddress(userId: number, addressId: string) {
    return this.userRepository.getShippingAddress(userId, addressId)
  }

  updateAddress(userId: number, addressId: string, dto: UpdateAddressDto) {
    return this.updateAddressUseCase.execute(userId, addressId, dto)
  }

  deleteAddress(userId: number, addressId: string) {
    return this.deleteAddressUseCase.execute(userId, addressId)
  }

  setDefaultAddress(userId: number, addressId: string) {
    return this.setDefaultAddressUseCase.execute(userId, addressId)
  }

  addPaymentMethod(userId: number, dto: AddPaymentMethodDto) {
    return this.addPaymentMethodUseCase.execute(userId, dto)
  }

  listPaymentMethods(userId: number) {
    return this.userRepository.listPaymentMethods(userId)
  }

  removePaymentMethod(userId: number, methodId: string) {
    return this.removePaymentMethodUseCase.execute(userId, methodId)
  }

  setDefaultPaymentMethod(userId: number, methodId: string) {
    return this.setDefaultPaymentMethodUseCase.execute(userId, methodId)
  }
}
