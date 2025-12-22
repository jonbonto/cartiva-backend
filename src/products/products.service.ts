import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({ where: { isActive: true } })
  }

  findOne(id: number) {
    return this.prisma.product.findUnique({ where: { id } })
  }

  create(dto: CreateProductDto) {
    // price should be provided as string or number; Prisma expects Decimal as string
    const data: any = { ...dto, price: dto.price?.toString() }
    return this.prisma.product.create({ data })
  }

  update(id: number, dto: UpdateProductDto) {
    const data: any = { ...dto }
    if (dto.price !== undefined) data.price = dto.price.toString()
    return this.prisma.product.update({ where: { id }, data })
  }

  remove(id: number) {
    return this.prisma.product.delete({ where: { id } })
  }
}
