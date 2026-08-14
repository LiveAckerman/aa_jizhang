import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

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
        // eslint-disable-next-line no-console
        console.error('[ValidationError]', JSON.stringify(details, null, 2))
        const first = errors[0]
        const msg =
          (first && first.constraints && Object.values(first.constraints)[0]) ||
          '参数校验失败'
        return new (require('@nestjs/common').BadRequestException)({
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
  console.log(`🚀 服务已启动: http://localhost:${port}/api`)
}

bootstrap()
