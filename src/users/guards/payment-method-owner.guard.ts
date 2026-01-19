import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject, BadRequestException } from '@nestjs/common'
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository'

@Injectable()
export class PaymentMethodOwnerGuard implements CanActivate {
  constructor(@Inject(USER_REPOSITORY) private userRepository: UserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    const methodId: string | undefined =
      request.params?.methodId || request.params?.id || request.params?.paymentMethodId

    if (!methodId) {
      throw new BadRequestException('Payment method id parameter is required')
    }

    const rawUser = request.user || {}
    const userId = Number(rawUser.id ?? rawUser.userId ?? rawUser.sub)

    if (!userId || Number.isNaN(userId)) {
      throw new ForbiddenException('User not authenticated')
    }

    const method = await this.userRepository.getPaymentMethod(userId, methodId)
    if (!method) {
      throw new ForbiddenException('Payment method not found')
    }

    if (method.userId !== userId) {
      throw new ForbiddenException('You do not own this payment method')
    }

    return true
  }
}
