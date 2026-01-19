import { Injectable, BadRequestException, Inject } from '@nestjs/common'
import { USER_REPOSITORY, UserRepository } from '../../domain/user.repository'

@Injectable()
export class RemovePaymentMethodUseCase {
  constructor(@Inject(USER_REPOSITORY) private userRepository: UserRepository) {}

  async execute(userId: number, methodId: string): Promise<void> {
    const method = await this.userRepository.getPaymentMethod(userId, methodId)
    if (!method) throw new BadRequestException('Payment method not found')

    await this.userRepository.softDeletePaymentMethod(methodId)

    if (method.isDefault) {
      const remaining = await this.userRepository.listPaymentMethods(userId)
      if (remaining.length > 0) {
        remaining[0].setAsDefault()
        await this.userRepository.updatePaymentMethod(remaining[0])
      }
    }
  }
}
