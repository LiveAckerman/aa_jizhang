import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { JwtPayload } from './jwt-auth.guard'

/**
 * 从请求中取出当前登录用户（由 JwtAuthGuard 注入）
 * 用法：handler(@CurrentUser() user: JwtPayload)
 * 或取单字段：@CurrentUser('sub') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const user = request.user as JwtPayload
    return data ? user?.[data] : user
  },
)
