import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject, BadRequestException } from '@nestjs/common'
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository'

@Injectable()
export class AddressOwnerGuard implements CanActivate {
  constructor(@Inject(USER_REPOSITORY) private userRepository: UserRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    // Support different param names used in routes
    const addressId: string | undefined =
      request.params?.addressId || request.params?.id || request.params?.address_id

    if (!addressId) {
      throw new BadRequestException('Address id parameter is required')
    }

    // Support multiple shapes for authenticated user produced by strategies
    const rawUser = request.user || {}
    const userId = Number(rawUser.id ?? rawUser.userId ?? rawUser.sub)

    if (!userId || Number.isNaN(userId)) {
      throw new ForbiddenException('User not authenticated')
    }

    const address = await this.userRepository.getShippingAddress(userId, addressId)
    if (!address) {
      throw new ForbiddenException('Address not found')
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('You do not own this address')
    }

    return true
  }
}
