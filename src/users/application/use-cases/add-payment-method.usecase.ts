import { Injectable, BadRequestException, Inject } from '@nestjs/common'
import { AddPaymentMethodDto } from '../dto/add-payment-method.dto'
import { USER_REPOSITORY, UserRepository } from '../../domain/user.repository'
import { UserPaymentMethod } from '../../domain/payment-method.entity'

@Injectable()
export class AddPaymentMethodUseCase {
  constructor(@Inject(USER_REPOSITORY) private userRepository: UserRepository) {}

  async execute(userId: number, dto: AddPaymentMethodDto): Promise<UserPaymentMethod> {
    if (!dto.provider || !dto.providerTokenId) {
      throw new BadRequestException('provider and providerTokenId are required')
    }

    // Note: token validation with provider adapter is Week 3; here we accept token
    const method = UserPaymentMethod.create(dto as any, userId)

    const existing = await this.userRepository.listPaymentMethods(userId)
    if (existing.length === 0) method.setAsDefault()

    return await this.userRepository.createPaymentMethod(method)
  }
}
