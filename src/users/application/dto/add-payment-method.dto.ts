import { IsString, IsOptional } from 'class-validator'

export class AddPaymentMethodDto {
  @IsString()
  provider: string

  @IsString()
  providerTokenId: string

  @IsOptional()
  @IsString()
  label?: string
}
