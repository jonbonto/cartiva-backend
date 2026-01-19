import { Injectable, BadRequestException, Inject } from '@nestjs/common'
import { CreateAddressDto } from '../dto/create-address.dto'
import { ShippingAddress } from '../../domain/shipping-address.entity'
import { USER_REPOSITORY, UserRepository } from '../../domain/user.repository'

@Injectable()
export class CreateShippingAddressUseCase {
  constructor(@Inject(USER_REPOSITORY) private userRepository: UserRepository) {}

  async execute(userId: number, dto: CreateAddressDto): Promise<ShippingAddress> {
    if (!dto.country) throw new BadRequestException('country is required')

    const address = ShippingAddress.create(dto as any, userId)

    const existing = await this.userRepository.listShippingAddresses(userId)
    if (existing.length === 0) {
      address.setAsDefault()
    }

    return await this.userRepository.createShippingAddress(address)
  }
}
