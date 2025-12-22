import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Request } from 'express'
import { AdminService } from './admin.service'

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private adminService: AdminService) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>()
    const token = req.cookies['admin_session']
    if (!token) throw new UnauthorizedException()
    const valid = this.adminService.validate(token)
    if (!valid) throw new UnauthorizedException()
    return true
  }
}
