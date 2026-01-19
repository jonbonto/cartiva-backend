import { IsString, MinLength, IsOptional, Length } from 'class-validator'

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  label?: string

  @IsString()
  @MinLength(2)
  fullName: string

  @IsString()
  @MinLength(2)
  streetLine1: string

  @IsOptional()
  @IsString()
  streetLine2?: string

  @IsString()
  @MinLength(1)
  city: string

  @IsString()
  @MinLength(1)
  stateProvince: string

  @IsString()
  @MinLength(1)
  postalCode: string

  @IsString()
  @Length(2, 2)
  country: string

  @IsOptional()
  @IsString()
  phoneNumber?: string
}
