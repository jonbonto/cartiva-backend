import { Injectable, BadRequestException, Inject } from '@nestjs/common'
import { USER_REPOSITORY, UserRepository } from '../../domain/user.repository'

@Injectable()
export class SetDefaultPaymentMethodUseCase {
  constructor(@Inject(USER_REPOSITORY) private userRepository: UserRepository) {}

  async execute(userId: number, methodId: string): Promise<void> {
    const method = await this.userRepository.getPaymentMethod(userId, methodId)
    if (!method) throw new BadRequestException('Payment method not found')

    const current = await this.userRepository.getDefaultPaymentMethod(userId)
    if (current && current.id !== methodId) {
      current.unsetAsDefault()
      await this.userRepository.updatePaymentMethod(current)
    }

    method.setAsDefault()
    await this.userRepository.updatePaymentMethod(method)
  }
}
