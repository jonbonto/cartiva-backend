import { IsOptional, IsString, IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class UpdateProductDto {
	@IsOptional()
	@IsString()
	name?: string

	@IsOptional()
	@IsString()
	description?: string

	/**
	 * Price in CENTS (e.g., 1999 = $19.99)
	 * Stored as integer to prevent floating-point errors
	 */
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	priceInCents?: number

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	stock?: number

	@IsOptional()
	@IsString()
	imageUrl?: string

	@IsOptional()
	isActive?: boolean
}
