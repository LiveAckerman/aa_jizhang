import { createApp, createAdminRuntime } from './app.js'
import { loadConfig } from './config.js'

const start = async (): Promise<void> => {
  const config = loadConfig()
  const runtime = await createAdminRuntime(config)
  const { admin } = runtime
  if (config.isProduction) {
    await admin.initialize()
    // @adminjs/express 会再次触发 initialize；前端 bundle 已在上一步准备完成。
    process.env.ADMIN_JS_SKIP_BUNDLE = 'true'
  } else {
    await admin.watch()
  }
  const app = await createApp(admin, config)
  const server = app.listen(config.port, config.host, () => {
    console.log(
      `只读 AdminJS 已启动：http://${config.host}:${config.port}${config.rootPath}（数据库：${config.databaseName}）`,
    )
  })

  const shutdown = (): void => {
    server.close(() => {
      runtime.closeDatabase().finally(() => process.exit(0))
    })
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : ''
  const safeConfigError = /^(缺少必需环境变量|ADMIN_|production 后台)/.test(
    message,
  )
  console.error(
    safeConfigError
      ? `AdminJS 配置错误：${message}`
      : 'AdminJS 启动失败，请检查数据库连通性和必需表。',
  )
  process.exitCode = 1
})
