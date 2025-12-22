import { IsInt, Min } from 'class-validator'

export class UpdateItemDto {
  @IsInt()
  @Min(0)
  qty: number
}
