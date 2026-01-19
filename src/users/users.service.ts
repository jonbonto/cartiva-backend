import { Injectable, Inject, BadRequestException, Optional } from '@nestjs/common'
import * as jwt from 'jsonwebtoken'
import * as bcrypt from 'bcrypt'
import { EmailService } from '../email/email.service'
import { CreateAddressDto } from './application/dto/create-address.dto'
import { UpdateAddressDto } from './application/dto/update-address.dto'
import { AddPaymentMethodDto } from './application/dto/add-payment-method.dto'
import { CreateShippingAddressUseCase } from './application/use-cases/create-shipping-address.usecase'
import { UpdateShippingAddressUseCase } from './application/use-cases/update-shipping-address.usecase'
import { DeleteShippingAddressUseCase } from './application/use-cases/delete-shipping-address.usecase'
import { SetDefaultAddressUseCase } from './application/use-cases/set-default-address.usecase'
import { AddPaymentMethodUseCase } from './application/use-cases/add-payment-method.usecase'
import { RemovePaymentMethodUseCase } from './application/use-cases/remove-payment-method.usecase'
import { SetDefaultPaymentMethodUseCase } from './application/use-cases/set-default-payment-method.usecase'
import { USER_REPOSITORY, UserRepository } from './domain/user.repository'

@Injectable()
export class UsersService {
  constructor(
    private readonly createAddressUseCase: CreateShippingAddressUseCase,
    private readonly updateAddressUseCase: UpdateShippingAddressUseCase,
    private readonly deleteAddressUseCase: DeleteShippingAddressUseCase,
    private readonly setDefaultAddressUseCase: SetDefaultAddressUseCase,
    private readonly addPaymentMethodUseCase: AddPaymentMethodUseCase,
    private readonly removePaymentMethodUseCase: RemovePaymentMethodUseCase,
    private readonly setDefaultPaymentMethodUseCase: SetDefaultPaymentMethodUseCase,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Optional() private readonly emailService?: EmailService,
  ) {}

  createAddress(userId: number, dto: CreateAddressDto) {
    return this.createAddressUseCase.execute(userId, dto)
  }

  listAddresses(userId: number) {
    return this.userRepository.listShippingAddresses(userId)
  }

  getAddress(userId: number, addressId: string) {
    return this.userRepository.getShippingAddress(userId, addressId)
  }

  updateAddress(userId: number, addressId: string, dto: UpdateAddressDto) {
    return this.updateAddressUseCase.execute(userId, addressId, dto)
  }

  deleteAddress(userId: number, addressId: string) {
    return this.deleteAddressUseCase.execute(userId, addressId)
  }

  setDefaultAddress(userId: number, addressId: string) {
    return this.setDefaultAddressUseCase.execute(userId, addressId)
  }

  addPaymentMethod(userId: number, dto: AddPaymentMethodDto) {
    return this.addPaymentMethodUseCase.execute(userId, dto)
  }

  listPaymentMethods(userId: number) {
    return this.userRepository.listPaymentMethods(userId)
  }

  getPaymentMethod(userId: number, methodId: string) {
    return this.userRepository.getPaymentMethod(userId, methodId)
  }

  removePaymentMethod(userId: number, methodId: string) {
    return this.removePaymentMethodUseCase.execute(userId, methodId)
  }

  setDefaultPaymentMethod(userId: number, methodId: string) {
    return this.setDefaultPaymentMethodUseCase.execute(userId, methodId)
  }

  // --- Profile ---
  async getProfile(userId: number) {
    return await this.userRepository.getUserById(userId)
  }

  async updateProfile(userId: number, data: { name?: string; email?: string }) {
    return await this.userRepository.updateUser(userId, data)
  }

  async requestEmailChange(userId: number, newEmail: string) {
    if (!newEmail || typeof newEmail !== 'string') {
      throw new BadRequestException('email is required')
    }

    // Create a signed token containing the userId and newEmail
    const secret = process.env.EMAIL_CHANGE_TOKEN_SECRET || process.env.JWT_SECRET || 'change-me'
    const token = jwt.sign({ sub: userId, newEmail }, secret, { expiresIn: '1h' })

    const backendConfirmUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/users/me/email/confirm?token=${token}`
    const frontendConfirmUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${token}`

    // Send verification email
    if (this.emailService) {
      await this.emailService.sendVerificationEmail(newEmail, backendConfirmUrl, frontendConfirmUrl)
    } else {
      // In test/dev without EmailService injected, log the URL
      // eslint-disable-next-line no-console
      console.log(`[EMAIL VERIFICATION] ${newEmail} - ${backendConfirmUrl}`)
    }

    return { ok: true }
  }

  async confirmEmailChange(userId: number | null, token: string) {
    const secret = process.env.EMAIL_CHANGE_TOKEN_SECRET || process.env.JWT_SECRET || 'change-me'
    try {
      const payload = jwt.verify(token, secret) as any
      const tokenUserId = payload.sub
      const newEmail = payload.newEmail
      if (!tokenUserId || !newEmail) throw new Error('invalid token')

      // If caller supplied a userId (authenticated flow), enforce it matches token
      if (userId && Number(userId) !== Number(tokenUserId)) {
        throw new BadRequestException('Token does not match authenticated user')
      }

      // Update user's email
      const updated = await this.userRepository.updateUser(Number(tokenUserId), { email: newEmail })
      return updated
    } catch (err) {
      throw new BadRequestException('Invalid or expired token')
    }
  }

  // --- Password ---
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('currentPassword and newPassword are required')
    }

    const user = await this.userRepository.getUserWithPassword(userId)
    if (!user) throw new BadRequestException('User not found')

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) throw new BadRequestException('Invalid current password')

    const hashed = await bcrypt.hash(newPassword, 10)
    await this.userRepository.updatePassword(userId, hashed)

    return { ok: true }
  }
}
