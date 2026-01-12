import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common'
import { Response } from 'express'
import { AuthService } from './auth.service'
import { SignupDto } from './dto/signup.dto'
import { LoginDto } from './dto/login.dto'
import { JwtAuthGuard } from './guards/jwt.guard'

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res() res: Response) {
    const { user, token } = await this.authService.signup(dto)
    res.cookie('jwt', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 })
    return res.json({ user, token })
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const { user, token } = await this.authService.login(dto)
    res.cookie('jwt', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 })
    return res.json({ user, token })
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    return this.authService.me(req.user.id)
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('jwt')
    return res.json({ ok: true })
  }
}
