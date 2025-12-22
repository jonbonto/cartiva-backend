import { Controller, Get, Req, Res, Post, Body, Put, Param, Delete, ParseIntPipe } from '@nestjs/common'
import { CartService } from './cart.service'
import { AddItemDto } from './dto/add-item.dto'
import { UpdateItemDto } from './dto/update-item.dto'
import { v4 as uuidv4 } from 'uuid'
import { Request, Response } from 'express'

@Controller('api/cart')
export class CartController {
  constructor(private cartService: CartService) {}

  private ensureSession(req: Request, res: Response) {
    let sessionId = req.cookies['session_id']
    if (!sessionId) {
      sessionId = uuidv4()
      res.cookie('session_id', sessionId, { httpOnly: true, sameSite: 'lax' })
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
    const item = await this.cartService.addItem(sessionId, body.productId, body.qty)
    return res.json(item)
  }

  @Put('items/:id')
  async updateItem(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateItemDto, @Res() res: Response) {
    const item = await this.cartService.updateItem(id, body.qty)
    return res.json(item)
  }

  @Delete('items/:id')
  async removeItem(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    await this.cartService.removeItem(id)
    return res.status(204).send()
  }
}
