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
    // priceInCents is already an integer — no conversion needed
    return this.prisma.product.create({ data: dto })
  }

  update(id: number, dto: UpdateProductDto) {
    return this.prisma.product.update({ where: { id }, data: dto })
  }

  remove(id: number) {
    return this.prisma.product.delete({ where: { id } })
  }
}
