import { Injectable, Logger } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private logger = new Logger(JwtStrategy.name)

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req.cookies?.jwt
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    })
  }

  validate(payload: any) {
    this.logger.debug(`[JwtStrategy] Validating payload`, {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      allKeys: Object.keys(payload),
    })

    const user = { id: payload.sub, email: payload.email, role: payload.role }

    if (!user.role) {
      this.logger.warn(`[JwtStrategy] WARNING: Role is missing from JWT payload!`, {
        payload: JSON.stringify(payload),
        user: JSON.stringify(user),
      })
    }

    return user
  }
}
