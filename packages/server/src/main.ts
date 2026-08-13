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
