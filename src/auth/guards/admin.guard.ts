import { Injectable, ForbiddenException } from '@nestjs/common'
import { JwtGuard } from './jwt.guard'

@Injectable()
export class AdminGuard extends JwtGuard {
  handleRequest(err: any, user: any, info: any, context: any) {
    const jwtUser = super.handleRequest(err, user, info, context)
    if (jwtUser?.role !== 'admin') {
      throw new ForbiddenException('Admin access required')
    }
    return jwtUser
  }
}
