import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ForbiddenError } from 'adminjs'
import type { ActionRequest } from 'adminjs'
import {
  createReadActions,
  isUuid,
  READ_ONLY_ACTIONS,
  sanitizeActionResponse,
  SENSITIVE_FIELDS,
} from '../resources.js'

test('user reference IDs are validated before querying PostgreSQL UUID columns', () => {
  assert.equal(isUuid('9d73df0a-f7c6-4c67-b3a5-dbd4b51'), false)
  assert.equal(isUuid('9d73df0a-f7c6-4c67-b3a5-dbd4b51a3c20'), true)
})

test('all default mutation actions are inaccessible on the server', () => {
  for (const action of ['new', 'edit', 'delete', 'bulkDelete'] as const) {
    assert.equal(READ_ONLY_ACTIONS?.[action]?.isAccessible, false)
    assert.equal(READ_ONLY_ACTIONS?.[action]?.isVisible, false)
  }
})

test('sensitive fields are removed from records and populated records', () => {
  const response = {
    records: [
      {
        params: { id: '1', openid: 'secret-openid', nickname: '测试用户' },
        populated: {
          ownerId: {
            params: { id: '1', unionid: 'secret-unionid' },
          },
        },
      },
    ],
    record: { params: { id: 'book-1', inviteCode: '123456' } },
  }
  sanitizeActionResponse(response, SENSITIVE_FIELDS)
  assert.deepEqual(response.records[0]?.params, { id: '1', nickname: '测试用户' })
  assert.deepEqual(response.records[0]?.populated.ownerId?.params, { id: '1' })
  assert.deepEqual(response.record.params, { id: 'book-1' })
})

test('list API rejects filters and sorting by non-whitelisted fields', async () => {
  const actions = createReadActions(['id', 'nickname'])
  const before = actions?.list?.before
  assert.equal(typeof before, 'function')
  const runBefore = Array.isArray(before) ? before[0] : before
  const request = {
    method: 'get',
    params: { resourceId: 'users', action: 'list' },
    query: { 'filters.openid': 'probe' },
  } as ActionRequest
  await assert.rejects(
    async () => {
      await runBefore!(request, {} as never)
    },
    (error) => error instanceof ForbiddenError,
  )
})
