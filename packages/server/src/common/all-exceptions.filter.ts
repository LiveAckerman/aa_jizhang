import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'

/**
 * 全局异常过滤器
 *
 * - 统一日志：4xx 用 warn，5xx 用 error（含堆栈），context=Exception
 * - 统一响应体：保持项目既有 { message, error, statusCode } 结构
 * - 用 NestJS 内置 Logger 输出到 stdout，由 pm2 收集（方案1，不入库）
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception')

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const req = ctx.getRequest()
    const res = ctx.getResponse()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    // 提取业务响应体（保留既有结构）与日志消息
    let body: Record<string, unknown>
    let logMsg: string
    if (exception instanceof HttpException) {
      const resp = exception.getResponse()
      body =
        typeof resp === 'string'
          ? { message: resp, error: exception.name, statusCode: status }
          : (resp as Record<string, unknown>)
      logMsg =
        typeof resp === 'string'
          ? resp
          : ((resp as { message?: unknown }).message as string) || exception.message
    } else {
      body = {
        message: '服务器内部错误',
        error: 'Internal Server Error',
        statusCode: status,
      }
      logMsg = exception instanceof Error ? exception.message : String(exception)
    }

    const uid = req.user?.userId || req.user?.sub || '-'
    const line = `${req.method} ${req.originalUrl} ${status} - ${uid} - ${logMsg}`

    if (status >= 500) {
      // 5xx 记完整堆栈，便于定位
      const stack = exception instanceof Error ? exception.stack : undefined
      this.logger.error(line, stack)
    } else {
      // 4xx 属预期内的客户端错误，warn 即可
      this.logger.warn(line)
    }

    res.status(status).json(body)
  }
}
