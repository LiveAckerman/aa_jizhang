import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { timingSafeEqual } from 'node:crypto'

export type AdminApiRequest = {
  headers: Record<string, string | string[] | undefined>
  adminActor?: string
}

const headerValue = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0]?.trim() || ''
  return value?.trim() || ''
}

@Injectable()
export class AdminApiGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminApiRequest>()
    const expected = this.config.get<string>('ADMIN_API_TOKEN')?.trim() || ''
    const provided = headerValue(request.headers['x-admin-api-token'])

    // 未配置令牌时保持关闭，避免后台 API 因配置遗漏而意外裸奔。
    if (!expected || !provided) {
      throw new UnauthorizedException('后台业务 API 未授权')
    }

    const expectedBuffer = Buffer.from(expected)
    const providedBuffer = Buffer.from(provided)
    const sameLength = expectedBuffer.length === providedBuffer.length
    const matches =
      sameLength && timingSafeEqual(expectedBuffer, providedBuffer)
    if (!matches) throw new UnauthorizedException('后台业务 API 未授权')

    const actor = headerValue(request.headers['x-admin-actor'])
    request.adminActor = actor.slice(0, 128) || 'admin'
    return true
  }
}
