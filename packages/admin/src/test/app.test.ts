import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import AdminJS, { ComponentLoader } from 'adminjs'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { createApp } from '../app.js'
import type { AdminConfig } from '../config.js'

let sessionDir = ''
let app: Awaited<ReturnType<typeof createApp>>
let config: AdminConfig

before(async () => {
  sessionDir = await mkdtemp(join(tmpdir(), 'departure-admin-test-'))
  config = {
    nodeEnv: 'test',
    isProduction: false,
    host: '127.0.0.1',
    port: 9081,
    rootPath: '/admin',
    databaseName: 'aa_jizhang_test',
    databaseUrl: 'postgresql://unused:unused@127.0.0.1/aa_jizhang_test',
    adminEmail: 'admin@example.test',
    adminPasswordHash: await bcrypt.hash('correct horse battery staple', 4),
    sessionSecret: 'test-session-secret-with-at-least-32-characters',
    sessionDir,
    trustProxy: 0,
    adminApiUrl: 'http://127.0.0.1:9080/api',
    adminApiToken: '',
  }
  const admin = new AdminJS({ rootPath: '/admin', resources: [], componentLoader: new ComponentLoader() })
  app = await createApp(admin, config)
})

after(async () => {
  await rm(sessionDir, { recursive: true, force: true })
})

test('health check is public and admin pages require a session', async () => {
  await request(app).get('/healthz').expect(200, { ok: true })
  const response = await request(app).get('/admin').expect(302)
  assert.equal(response.headers.location, '/admin/login')
  await request(app).get('/admin/login').expect(200).expect(/AdminJS/)
})

test('valid credentials create a session and invalid credentials do not', async () => {
  await request(app)
    .post('/admin/login')
    .field('email', 'admin@example.test')
    .field('password', 'wrong password')
    .expect(200)

  const agent = request.agent(app)
  await agent
    .post('/admin/login')
    .field('email', 'admin@example.test')
    .field('password', 'correct horse battery staple')
    .expect(302)
    .expect('Location', '/admin')
  await agent.get('/admin').expect(200)
})

test('login endpoint rate-limits repeated failures', async () => {
  const isolatedSessionDir = await mkdtemp(join(tmpdir(), 'departure-admin-rate-test-'))
  const isolatedAdmin = new AdminJS({
    rootPath: '/admin',
    resources: [],
    componentLoader: new ComponentLoader(),
  })
  const isolatedApp = await createApp(isolatedAdmin, {
    ...config,
    sessionDir: isolatedSessionDir,
  })
  let lastStatus = 0
  try {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(isolatedApp)
        .post('/admin/login')
        .field('email', 'admin@example.test')
        .field('password', 'still wrong')
      lastStatus = response.status
    }
  } finally {
    await rm(isolatedSessionDir, { recursive: true, force: true })
  }
  assert.equal(lastStatus, 429)
})
