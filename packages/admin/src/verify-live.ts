import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createApp, createAdminRuntime } from './app.js'
import { loadConfig } from './config.js'

const password = process.env.ADMIN_E2E_PASSWORD
if (!password) throw new Error('缺少 ADMIN_E2E_PASSWORD（只用于本次验证）')

const baseConfig = loadConfig()
if (baseConfig.databaseName !== 'aa_jizhang_test') {
  throw new Error('该验证只允许连接 aa_jizhang_test')
}
const sessionDir = await mkdtemp(join(tmpdir(), 'departure-admin-live-'))
const config = { ...baseConfig, sessionDir }
const runtime = await createAdminRuntime(config)
const app = await createApp(runtime.admin, config)
const server = app.listen(0, '127.0.0.1')
await new Promise<void>((resolve, reject) => {
  server.once('listening', resolve)
  server.once('error', reject)
})

try {
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://127.0.0.1:${port}${config.rootPath}`
  const unauthenticated = await fetch(
    `${baseUrl}/api/resources/users/actions/list`,
    { redirect: 'manual' },
  )

  const loginForm = new FormData()
  loginForm.set('email', config.adminEmail)
  loginForm.set('password', password)
  const login = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    body: loginForm,
    redirect: 'manual',
  })
  const cookie = (login.headers.get('set-cookie') ?? '').split(';', 1)[0]
  if (login.status !== 302 || !cookie) throw new Error('测试管理员登录失败')

  const call = async (
    path: string,
    init: RequestInit = {},
  ): Promise<{ response: Response; json: Record<string, any>; text: string }> => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      redirect: 'manual',
      headers: { cookie, ...init.headers },
    })
    const text = await response.text()
    return { response, json: JSON.parse(text), text }
  }

  const usersBefore = await call('/api/resources/users/actions/list')
  const userRecords = usersBefore.json.records as Array<{ id: string }>
  if (!userRecords.length) throw new Error('aa_jizhang_test 至少需要一条用户 fixture')
  if (/\"(?:openid|unionid|inviteCode)\"\s*:/.test(usersBefore.text)) {
    throw new Error('用户 API 响应包含敏感字段')
  }

  const userId = userRecords[0].id
  const writes = {
    new: await call('/api/resources/users/actions/new'),
    edit: await call(`/api/resources/users/records/${encodeURIComponent(userId)}/edit`, {
      method: 'POST',
    }),
    delete: await call(`/api/resources/users/records/${encodeURIComponent(userId)}/delete`, {
      method: 'POST',
    }),
    bulkDelete: await call(
      `/api/resources/users/bulk/bulkDelete?recordIds=${encodeURIComponent(userId)}`,
      { method: 'POST' },
    ),
  }
  for (const [name, result] of Object.entries(writes)) {
    if (result.json.notice?.type !== 'error') {
      throw new Error(`${name} 写动作没有被权限层拒绝`)
    }
  }

  const rejectedFilter = await call(
    '/api/resources/users/actions/list?filters.openid=probe',
  )
  if (rejectedFilter.json.notice?.type !== 'error') {
    throw new Error('敏感字段过滤没有被拒绝')
  }

  const transactions = await call('/api/resources/transactions/actions/list')
  const transactionRecords = transactions.json.records as Array<{ id: string }>
  if (!transactionRecords.length) {
    throw new Error('aa_jizhang_test 至少需要一条账单 fixture')
  }
  const detail = await call(
    `/api/resources/transactions/records/${encodeURIComponent(transactionRecords[0].id)}/show`,
  )
  const detailParams = detail.json.record?.params ?? {}
  const splitEntries = Object.entries(detailParams).filter(([key]) =>
    key.startsWith('splits'),
  )
  if (!splitEntries.length || splitEntries.some(([, value]) => value === '[object Object]')) {
    throw new Error('账单 splits JSONB 没有以可读字段展示')
  }

  const dashboard = await call('/api/dashboard')
  const expectedToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  if (
    dashboard.json.timezone !== 'Asia/Shanghai' ||
    dashboard.json.metrics?.registrations?.series?.length !== 30 ||
    dashboard.json.metrics?.registrations?.series?.at(-1)?.date !== expectedToday
  ) {
    throw new Error('统计 API 的时区或 30 天序列不正确')
  }

  const usersAfter = await call('/api/resources/users/actions/list')
  if (usersAfter.json.meta?.total !== usersBefore.json.meta?.total) {
    throw new Error('只读验证前后用户数量发生变化')
  }

  console.log(
    JSON.stringify(
      {
        database: config.databaseName,
        unauthenticatedListStatus: unauthenticated.status,
        loginStatus: login.status,
        userListStatus: usersBefore.response.status,
        sensitiveFieldsAbsent: true,
        writesRejected: Object.keys(writes),
        sensitiveFilterRejected: true,
        transactionDetailStatus: detail.response.status,
        readableSplitFields: splitEntries.length,
        dashboardStatus: dashboard.response.status,
        dashboardDays: dashboard.json.metrics.registrations.series.length,
      },
      null,
      2,
    ),
  )
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await runtime.closeDatabase()
  await rm(sessionDir, { recursive: true, force: true })
}
