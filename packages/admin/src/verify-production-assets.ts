import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createApp, createAdminRuntime } from './app.js'
import { loadConfig } from './config.js'

const originalNodeEnv = process.env.NODE_ENV
const originalSkipBundle = process.env.ADMIN_JS_SKIP_BUNDLE
const baseConfig = loadConfig()
if (baseConfig.databaseName !== 'aa_jizhang_test') {
  throw new Error('该验证只允许连接 aa_jizhang_test')
}

const sessionDir = await mkdtemp(join(tmpdir(), 'departure-admin-production-'))
const config = { ...baseConfig, sessionDir }
const runtime = await createAdminRuntime(config)
let server: ReturnType<Awaited<ReturnType<typeof createApp>>['listen']> | undefined

try {
  process.env.NODE_ENV = 'production'
  delete process.env.ADMIN_JS_SKIP_BUNDLE
  await runtime.admin.initialize()
  process.env.ADMIN_JS_SKIP_BUNDLE = 'true'

  // 本地 HTTP 验证不启用 Secure cookie；bundle 初始化仍走 production 分支。
  const app = await createApp(runtime.admin, { ...config, isProduction: false })
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server?.once('listening', resolve)
    server?.once('error', reject)
  })
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://127.0.0.1:${port}${config.rootPath}`
  const login = await fetch(`${baseUrl}/login`)
  const appBundle = await fetch(`${baseUrl}/frontend/assets/app.bundle.js`)
  const componentsBundle = await fetch(
    `${baseUrl}/frontend/assets/components.bundle.js`,
  )
  const appBundleText = await appBundle.text()
  const componentsBundleText = await componentsBundle.text()
  if (
    login.status !== 200 ||
    appBundle.status !== 200 ||
    componentsBundle.status !== 200 ||
    appBundleText.length < 1000 ||
    componentsBundleText.length < 10
  ) {
    throw new Error('production AdminJS 前端资源验证失败')
  }

  console.log(
    JSON.stringify(
      {
        database: config.databaseName,
        loginStatus: login.status,
        appBundleStatus: appBundle.status,
        componentsBundleStatus: componentsBundle.status,
      },
      null,
      2,
    ),
  )
} finally {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()))
  }
  await runtime.closeDatabase()
  await rm(sessionDir, { recursive: true, force: true })
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
  if (originalSkipBundle === undefined) delete process.env.ADMIN_JS_SKIP_BUNDLE
  else process.env.ADMIN_JS_SKIP_BUNDLE = originalSkipBundle
}
