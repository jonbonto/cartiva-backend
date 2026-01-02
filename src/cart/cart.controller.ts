import { Controller, Get, Req, Res, Post, Body, Put, Param, Delete, ParseIntPipe, BadRequestException } from '@nestjs/common'
import { CartService } from './cart.service'
import { AddItemDto } from './dto/add-item.dto'
import { UpdateItemDto } from './dto/update-item.dto'
import { v4 as uuidv4 } from 'uuid'
import { Request, Response } from 'express'

@Controller('api/cart')
export class CartController {
  constructor(private cartService: CartService) {}

  private ensureSession(req: Request, res: Response): string {
    let sessionId = req.cookies['session_id']
    if (!sessionId) {
      sessionId = uuidv4()
      res.cookie('session_id', sessionId, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 })
    }
    return sessionId
  }

  @Get()
  async getCart(@Req() req: Request, @Res() res: Response) {
    const sessionId = this.ensureSession(req, res)
    const cart = await this.cartService.getCartBySession(sessionId)
    return res.json(cart)
  }

  @Post('items')
  async addItem(@Req() req: Request, @Res() res: Response, @Body() body: AddItemDto) {
    const sessionId = this.ensureSession(req, res)
    if (!body.productId || !body.quantity || body.quantity < 1) {
      throw new BadRequestException('Invalid productId or quantity')
    }
    const cart = await this.cartService.addItem(sessionId, body.productId, body.quantity)
    return res.json(cart)
  }

  @Put('items/:id')
  async updateItem(
    @Param('id', ParseIntPipe) itemId: number,
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: UpdateItemDto
  ) {
    const sessionId = this.ensureSession(req, res)
    // Get cart to find cartId
    const cart = await this.cartService.getCartBySession(sessionId)
    if (!body.quantity || body.quantity < 0) {
      throw new BadRequestException('Invalid quantity')
    }
    const updatedCart = await this.cartService.updateItem(cart.id, itemId, body.quantity)
    return res.json(updatedCart)
  }

  @Delete('items/:id')
  async removeItem(
    @Param('id', ParseIntPipe) itemId: number,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const sessionId = this.ensureSession(req, res)
    const cart = await this.cartService.getCartBySession(sessionId)
    const updatedCart = await this.cartService.removeItem(cart.id, itemId)
    return res.json(updatedCart)
  }
}
