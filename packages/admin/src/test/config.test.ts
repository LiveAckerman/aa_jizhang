import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadConfig } from '../config.js'

const baseEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'development',
  DB_HOST: '127.0.0.1',
  DB_PORT: '5432',
  DB_USERNAME: 'reader',
  DB_PASSWORD: 'test-only',
  DB_DATABASE: 'must_be_ignored',
  ADMIN_EMAIL: 'admin@example.test',
  ADMIN_PASSWORD_HASH: '$2b$12$01234567890123456789012345678901234567890123456789012',
  ADMIN_SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
})

test('non-production always uses aa_jizhang_test', () => {
  const config = loadConfig(baseEnv())
  assert.equal(config.databaseName, 'aa_jizhang_test')
  assert.equal(new URL(config.databaseUrl).pathname, '/aa_jizhang_test')
})

test('production requires explicit database opt-in', () => {
  const env = { ...baseEnv(), NODE_ENV: 'production' }
  assert.throws(() => loadConfig(env), /ADMIN_ALLOW_PRODUCTION_DB=true/)
})

test('plaintext admin passwords are rejected', () => {
  const env = { ...baseEnv(), ADMIN_PASSWORD_HASH: 'password123456' }
  assert.throws(() => loadConfig(env), /bcrypt/)
})

test('short session secrets are rejected', () => {
  const env = { ...baseEnv(), ADMIN_SESSION_SECRET: 'short' }
  assert.throws(() => loadConfig(env), /至少需要 32 个字符/)
})
