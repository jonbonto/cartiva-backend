import { Injectable, BadRequestException, Inject } from '@nestjs/common'
import { AddPaymentMethodDto } from '../dto/add-payment-method.dto'
import { USER_REPOSITORY, UserRepository } from '../../domain/user.repository'
import { UserPaymentMethod } from '../../domain/payment-method.entity'
import { PAYMENT_TOKEN_VALIDATOR, PaymentTokenValidator } from '../../domain/payment-token.validator'

@Injectable()
export class AddPaymentMethodUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private userRepository: UserRepository,
    @Inject(PAYMENT_TOKEN_VALIDATOR) private tokenValidator: PaymentTokenValidator,
  ) {}

  async execute(userId: number, dto: AddPaymentMethodDto): Promise<UserPaymentMethod> {
    if (!dto.provider || !dto.providerTokenId) {
      throw new BadRequestException('provider and providerTokenId are required')
    }

    const validation = await this.tokenValidator.validate(dto.provider, dto.providerTokenId)
    if (!validation || !validation.valid) {
      throw new BadRequestException('Invalid provider token')
    }

    // Prefer provider-supplied metadata (brand, last4Digits, expiry, cardholderName)
    const providerMeta = validation.metadata || {}
    const createDto: any = {
      provider: dto.provider,
      providerTokenId: dto.providerTokenId,
      type: dto.type || 'card',
      brand: providerMeta.brand || dto.brand,
      last4Digits: providerMeta.last4Digits || dto.last4Digits,
      expiryMonth: providerMeta.expiryMonth || dto.expiryMonth,
      expiryYear: providerMeta.expiryYear || dto.expiryYear,
      cardholderName: providerMeta.cardholderName || dto.cardholderName,
      label: dto.label,
    }

    const method = UserPaymentMethod.create(createDto, userId)

    const existing = await this.userRepository.listPaymentMethods(userId)
    if (existing.length === 0) method.setAsDefault()

    return await this.userRepository.createPaymentMethod(method)
  }
}
