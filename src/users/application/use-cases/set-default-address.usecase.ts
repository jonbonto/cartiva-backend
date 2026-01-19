import { Injectable, BadRequestException, Inject } from '@nestjs/common'
import { USER_REPOSITORY, UserRepository } from '../../domain/user.repository'

@Injectable()
export class SetDefaultAddressUseCase {
  constructor(@Inject(USER_REPOSITORY) private userRepository: UserRepository) {}

  async execute(userId: number, addressId: string): Promise<void> {
    const address = await this.userRepository.getShippingAddress(userId, addressId)
    if (!address) throw new BadRequestException('Address not found')

    const currentDefault = await this.userRepository.getDefaultShippingAddress(userId)
    if (currentDefault && currentDefault.id !== addressId) {
      currentDefault.unsetAsDefault()
      await this.userRepository.updateShippingAddress(currentDefault)
    }

    address.setAsDefault()
    await this.userRepository.updateShippingAddress(address)
  }
}
