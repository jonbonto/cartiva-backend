import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { ProductsService } from '../products/products.service'
import { CreateProductDto } from '../products/dto/create-product.dto'
import { UpdateProductDto } from '../products/dto/update-product.dto'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { JwtAuthGuard } from '../auth/guards/jwt.guard'
import { AdminGuard } from '../auth/guards/admin.guard'
import { GetRequestInfo, RequestInfo } from '../common/decorators/request-info.decorator'

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

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('products')
  async listProducts(@GetRequestInfo() info: RequestInfo) {
    // Admins see all products including inactive
    return this.productsService.findAll(true)
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('products/:id')
  async getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id)
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('image', { storage: storageOptions() }))
  @Post('products')
  async createProduct(
    @Body() body: CreateProductDto,
    @UploadedFile() file: any,
    @GetRequestInfo() info: RequestInfo
  ) {
    if (file) {
      body.imageUrl = `/uploads/products/${file.filename}`
    }
    return this.productsService.create(body, info.userId, info.ipAddress, info.userAgent)
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('image', { storage: storageOptions() }))
  @Put('products/:id')
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProductDto,
    @UploadedFile() file: any,
    @GetRequestInfo() info: RequestInfo
  ) {
    if (file) body.imageUrl = `/uploads/products/${file.filename}`
    return this.productsService.update(id, body, info.userId, info.ipAddress, info.userAgent)
  }

  /**
   * PHASE 2: Soft delete endpoint
   * Marks product as inactive instead of hard delete
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('products/:id/deactivate')
  async deactivateProduct(
    @Param('id', ParseIntPipe) id: number,
    @GetRequestInfo() info: RequestInfo
  ) {
    return this.productsService.deactivate(id, info.userId, info.ipAddress, info.userAgent)
  }
}
