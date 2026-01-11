import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export interface RequestInfo {
  userId: number
  ipAddress: string
  userAgent: string
}

export const GetRequestInfo = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestInfo => {
    const request = ctx.switchToHttp().getRequest()
    return {
      userId: request.user?.id,
      ipAddress: request.ip || request.connection.remoteAddress || '',
      userAgent: request.get('user-agent') || '',
    }
  }
)
