import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { JwtPayload } from '../auth/jwt-auth.guard'

/** 有有效 JWT 时附带用户；缺失或过期 JWT 仍作为匿名访问采集。 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const auth = request.headers?.authorization
    const [type, token] = typeof auth === 'string' ? auth.split(' ') : []
    if (type !== 'Bearer' || !token) return true

    try {
      request.user = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      })
    } catch {
      // 采集不影响小程序正常使用；无效 token 不会关联任何用户。
    }
    return true
  }
}
