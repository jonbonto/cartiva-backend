import { IsString, IsOptional, IsInt } from 'class-validator'

export class AddPaymentMethodDto {
  @IsString()
  provider: string

  @IsString()
  providerTokenId: string

  @IsOptional()
  @IsString()
  type?: string

  @IsOptional()
  @IsString()
  brand?: string

  @IsOptional()
  @IsString()
  last4Digits?: string

  @IsOptional()
  @IsInt()
  expiryMonth?: number

  @IsOptional()
  @IsInt()
  expiryYear?: number

  @IsOptional()
  @IsString()
  cardholderName?: string

  @IsOptional()
  @IsString()
  label?: string
}
