import { Injectable, BadRequestException, Inject } from '@nestjs/common'
import { UpdateAddressDto } from '../dto/update-address.dto'
import { USER_REPOSITORY, UserRepository } from '../../domain/user.repository'

@Injectable()
export class UpdateShippingAddressUseCase {
  constructor(@Inject(USER_REPOSITORY) private userRepository: UserRepository) {}

  async execute(userId: number, addressId: string, dto: UpdateAddressDto) {
    const address = await this.userRepository.getShippingAddress(userId, addressId)
    if (!address) throw new BadRequestException('Address not found')

    address.update(dto as any)
    return await this.userRepository.updateShippingAddress(address)
  }
}
