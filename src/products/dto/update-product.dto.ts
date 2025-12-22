import { IsOptional, IsString, IsNumber } from 'class-validator'

export class UpdateProductDto {
	@IsOptional()
	@IsString()
	name?: string

	@IsOptional()
	@IsString()
	description?: string

	@IsOptional()
	price?: string | number

	@IsOptional()
	@IsNumber()
	stock?: number

	@IsOptional()
	@IsString()
	imageUrl?: string

	@IsOptional()
	isActive?: boolean
}
