import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'

/** JWT 载荷 */
export interface JwtPayload {
  sub: string // 用户 id
  openid: string
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = this.extractToken(request)

    if (!token) {
      throw new UnauthorizedException('未登录')
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      })
      // 将用户信息挂到 request 上，供 @CurrentUser 使用
      request.user = payload
      return true
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录')
    }
  }

  private extractToken(request: any): string | undefined {
    const auth = request.headers?.authorization
    if (!auth) return undefined
    const [type, token] = auth.split(' ')
    return type === 'Bearer' ? token : undefined
  }
}
