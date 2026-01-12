import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common'

@Injectable()
export class AdminGuard implements CanActivate {
  private logger = new Logger(AdminGuard.name)

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    // Log for debugging
    this.logger.debug(`[AdminGuard] Checking admin access`, {
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      hasUser: !!user,
      userRole: user?.role,
    })

    if (!user) {
      this.logger.warn(`[AdminGuard] No user found in request`)
      throw new ForbiddenException('Not authenticated')
    }

    if (user.role !== 'admin') {
      this.logger.warn(`[AdminGuard] User is not admin`, { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      })
      throw new ForbiddenException('Admin access required')
    }

    this.logger.debug(`[AdminGuard] Admin access granted`, { 
      userId: user.id, 
      email: user.email 
    })
    return true
  }
}
