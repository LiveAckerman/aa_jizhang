import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'
import { LoggingInterceptor } from './common/logging.interceptor'
import { AllExceptionsFilter } from './common/all-exceptions.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const logger = new Logger('Bootstrap')

  // 全局请求日志 + 异常日志（NestJS 内置 Logger → stdout → pm2 文件日志）
  app.useGlobalInterceptors(new LoggingInterceptor())
  app.useGlobalFilters(new AllExceptionsFilter())

  // 全局参数校验
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        const details = errors.map((e) => ({
          property: e.property,
          value: e.value,
          constraints: e.constraints,
        }))
        new Logger('ValidationError').warn(JSON.stringify(details))
        const first = errors[0]
        const msg =
          (first && first.constraints && Object.values(first.constraints)[0]) ||
          '参数校验失败'
        return new BadRequestException({
          message: msg,
          errors: details,
        })
      },
    }),
  )

  // 允许跨域（小程序请求）
  app.enableCors()

  // 全局路由前缀
  app.setGlobalPrefix('api')

  const config = app.get(ConfigService)
  const port = config.get<number>('PORT', 9080)

  await app.listen(port)
  logger.log(`🚀 服务已启动: http://localhost:${port}/api`)
}

bootstrap()
