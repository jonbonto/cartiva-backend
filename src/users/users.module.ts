import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { USER_REPOSITORY } from './domain/user.repository'
import { UserRepositoryPrisma } from './infrastructure/user.repository.prisma'
import { CreateShippingAddressUseCase } from './application/use-cases/create-shipping-address.usecase'
import { UpdateShippingAddressUseCase } from './application/use-cases/update-shipping-address.usecase'
import { DeleteShippingAddressUseCase } from './application/use-cases/delete-shipping-address.usecase'
import { SetDefaultAddressUseCase } from './application/use-cases/set-default-address.usecase'
import { AddPaymentMethodUseCase } from './application/use-cases/add-payment-method.usecase'
import { RemovePaymentMethodUseCase } from './application/use-cases/remove-payment-method.usecase'
import { SetDefaultPaymentMethodUseCase } from './application/use-cases/set-default-payment-method.usecase'
import { PAYMENT_TOKEN_VALIDATOR } from './domain/payment-token.validator'
import { StripeTokenValidator } from './adapters/stripe-token.validator'
import { AddressOwnerGuard } from './guards/address-owner.guard'
import { PaymentMethodOwnerGuard } from './guards/payment-method-owner.guard'
import { EmailModule } from '../email/email.module'

@Module({
  imports: [EmailModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    // Use-cases
    CreateShippingAddressUseCase,
    UpdateShippingAddressUseCase,
    DeleteShippingAddressUseCase,
    SetDefaultAddressUseCase,
    AddPaymentMethodUseCase,
    RemovePaymentMethodUseCase,
    SetDefaultPaymentMethodUseCase,
    // Repository binding
    { provide: USER_REPOSITORY, useClass: UserRepositoryPrisma },
    // Token validator adapter
    { provide: PAYMENT_TOKEN_VALIDATOR, useClass: StripeTokenValidator },
    AddressOwnerGuard,
    PaymentMethodOwnerGuard,
  ],
  exports: [UsersService],
})
export class UsersModule {}
