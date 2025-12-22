import { Controller, Post, Body, Res, UseGuards, Get, Param, ParseIntPipe, Delete, Put, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common'
import { Response } from 'express'
import { ProductsService } from '../products/products.service'
import { CreateProductDto } from '../products/dto/create-product.dto'
import { UpdateProductDto } from '../products/dto/update-product.dto'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { AdminGuard } from '../auth/guards/admin.guard'

function storageOptions() {
  return diskStorage({
    destination: join(process.cwd(), 'uploads', 'products'),
    filename: (_req, file, cb) => {
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extname(file.originalname)}`
      cb(null, name)
    }
  })
}

@Controller('api/admin')
export class AdminController {
  constructor(private productsService: ProductsService) {}

  @UseGuards(AdminGuard)
  @Get('products')
  async listProducts() {
    return this.productsService.findAll()
  }

  @UseGuards(AdminGuard)
  @Get('products/:id')
  async getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id)
  }

  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('image', { storage: storageOptions() }))
  @Post('products')
  async createProduct(@Body() body: CreateProductDto, @UploadedFile() file?: any) {
    if (file) {
      body.imageUrl = `/uploads/products/${file.filename}`
    }
    return this.productsService.create(body)
  }

  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('image', { storage: storageOptions() }))
  @Put('products/:id')
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProductDto,
    @UploadedFile() file?: any
  ) {
    if (file) body.imageUrl = `/uploads/products/${file.filename}`
    return this.productsService.update(id, body)
  }

  @UseGuards(AdminGuard)
  @Delete('products/:id')
  async deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id)
  }
}
