import { IsString, IsOptional, Length, MinLength } from 'class-validator'

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string

  @IsOptional()
  @IsString()
  streetLine1?: string

  @IsOptional()
  @IsString()
  streetLine2?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  stateProvince?: string

  @IsOptional()
  @IsString()
  postalCode?: string

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string

  @IsOptional()
  @IsString()
  phoneNumber?: string
}
