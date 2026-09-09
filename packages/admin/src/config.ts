import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const repositoryEnvPath = fileURLToPath(new URL('../../../.env', import.meta.url))
dotenv.config({ path: repositoryEnvPath, quiet: true })

export interface AdminConfig {
  nodeEnv: string
  isProduction: boolean
  host: string
  port: number
  rootPath: string
  databaseName: string
  databaseUrl: string
  adminEmail: string
  adminPasswordHash: string
  sessionSecret: string
  sessionDir: string
  trustProxy: number
}

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim()
  if (!value) throw new Error(`缺少必需环境变量 ${name}`)
  return value
}

const parsePort = (value: string | undefined, fallback: number, name: string): number => {
  const parsed = value ? Number(value) : fallback
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${name} 必须是 1 到 65535 之间的整数`)
  }
  return parsed
}

const buildDatabaseUrl = (
  env: NodeJS.ProcessEnv,
  databaseName: string,
): string => {
  const url = new URL('postgresql://localhost')
  url.hostname = required(env, 'DB_HOST')
  url.port = String(parsePort(env.DB_PORT, 5432, 'DB_PORT'))
  url.username = required(env, 'DB_USERNAME')
  url.password = required(env, 'DB_PASSWORD')
  url.pathname = `/${databaseName}`
  url.searchParams.set('connect_timeout', '30')
  url.searchParams.set('statement_timeout', '30000')
  if (env.DB_SSL === 'true') url.searchParams.set('sslmode', 'require')
  return url.toString()
}

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AdminConfig => {
  const nodeEnv = env.NODE_ENV?.trim() || 'development'
  const isProduction = nodeEnv === 'production'

  if (isProduction && env.ADMIN_ALLOW_PRODUCTION_DB !== 'true') {
    throw new Error(
      'production 后台需要显式设置 ADMIN_ALLOW_PRODUCTION_DB=true',
    )
  }

  const databaseName = isProduction
    ? env.DB_DATABASE?.trim() || 'aa_jizhang'
    : 'aa_jizhang_test'
  const adminEmail = required(env, 'ADMIN_EMAIL').toLowerCase()
  const adminPasswordHash = required(env, 'ADMIN_PASSWORD_HASH')
  const sessionSecret = required(env, 'ADMIN_SESSION_SECRET')

  if (!adminEmail.includes('@')) throw new Error('ADMIN_EMAIL 格式无效')
  if (!/^\$2[aby]\$\d{2}\$/.test(adminPasswordHash)) {
    throw new Error('ADMIN_PASSWORD_HASH 必须是 bcrypt 哈希，不能填写明文密码')
  }
  if (sessionSecret.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET 至少需要 32 个字符')
  }

  const trustProxy = env.ADMIN_TRUST_PROXY
    ? Number(env.ADMIN_TRUST_PROXY)
    : 0
  if (!Number.isInteger(trustProxy) || trustProxy < 0) {
    throw new Error('ADMIN_TRUST_PROXY 必须是非负整数')
  }

  return {
    nodeEnv,
    isProduction,
    host: env.ADMIN_HOST?.trim() || '127.0.0.1',
    port: parsePort(env.ADMIN_PORT, 9081, 'ADMIN_PORT'),
    rootPath: '/admin',
    databaseName,
    databaseUrl: buildDatabaseUrl(env, databaseName),
    adminEmail,
    adminPasswordHash,
    sessionSecret,
    sessionDir:
      env.ADMIN_SESSION_DIR?.trim() ||
      fileURLToPath(new URL('../.sessions', import.meta.url)),
    trustProxy,
  }
}
