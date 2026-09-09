import assert from 'node:assert/strict'
import { test } from 'node:test'
import bcrypt from 'bcryptjs'
import { authenticateAdmin } from '../auth.js'

test('authentication accepts only the configured email and bcrypt password', async () => {
  const config = {
    adminEmail: 'admin@example.test',
    adminPasswordHash: await bcrypt.hash('correct horse battery staple', 4),
  }

  assert.equal(
    await authenticateAdmin('admin@example.test', 'wrong password', config),
    null,
  )
  assert.equal(
    await authenticateAdmin('other@example.test', 'correct horse battery staple', config),
    null,
  )
  assert.deepEqual(
    await authenticateAdmin(
      'ADMIN@example.test',
      'correct horse battery staple',
      config,
    ),
    { email: 'admin@example.test', title: '系统管理员' },
  )
})
