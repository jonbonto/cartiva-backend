import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator'

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsNotEmpty()
  price: string | number

  @IsOptional()
  @IsNumber()
  stock?: number

  @IsOptional()
  @IsString()
  imageUrl?: string

  @IsOptional()
  isActive?: boolean
}
