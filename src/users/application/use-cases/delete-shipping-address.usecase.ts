import { Injectable, BadRequestException, Inject } from '@nestjs/common'
import { USER_REPOSITORY, UserRepository } from '../../domain/user.repository'

@Injectable()
export class DeleteShippingAddressUseCase {
  constructor(@Inject(USER_REPOSITORY) private userRepository: UserRepository) {}

  async execute(userId: number, addressId: string): Promise<void> {
    const address = await this.userRepository.getShippingAddress(userId, addressId)
    if (!address) throw new BadRequestException('Address not found')

    const inUse = await this.userRepository.isAddressInUse(addressId)
    if (inUse) throw new BadRequestException('Cannot delete address in active order')

    await this.userRepository.softDeleteShippingAddress(addressId)

    if (address.isDefault) {
      const remaining = await this.userRepository.listShippingAddresses(userId)
      if (remaining.length > 0) {
        remaining[0].setAsDefault()
        await this.userRepository.updateShippingAddress(remaining[0])
      }
    }
  }
}
