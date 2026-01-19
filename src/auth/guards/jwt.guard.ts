import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private logger = new Logger(JwtAuthGuard.name)

  handleRequest(err: any, user: any, info: any, context: any, status: any) {
    if (err) {
      this.logger.warn(`[JwtAuthGuard] JWT validation error:`, { 
        message: err.message,
        name: err.name 
      })
      throw err
    }

    if (!user) {
      this.logger.warn(`[JwtAuthGuard] No user extracted from JWT`, { info })
      throw new UnauthorizedException('No user extracted from JWT token')
    }

    this.logger.debug(`[JwtAuthGuard] JWT validated successfully`, {
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    return user
  }
}
