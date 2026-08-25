import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

/**
 * 全局 HTTP 请求日志拦截器
 *
 * 每个请求打一行：METHOD URL STATUS +耗时ms - userId
 * 用 NestJS 内置 Logger（context=HTTP），输出到 stdout，由 pm2 收集到文件日志。
 * 不写数据库、不引第三方日志框架（方案1）。
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // 仅处理 HTTP 请求（跳过 WebSocket / RPC 等）
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const req = context.switchToHttp().getRequest()
    const res = context.switchToHttp().getResponse()
    const { method, originalUrl } = req
    const start = Date.now()

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start
          const uid = req.user?.userId || req.user?.sub || '-'
          this.logger.log(`${method} ${originalUrl} ${res.statusCode} +${ms}ms - ${uid}`)
        },
        // 错误交给全局异常过滤器统一记录，这里不重复打日志
      }),
    )
  }
}
