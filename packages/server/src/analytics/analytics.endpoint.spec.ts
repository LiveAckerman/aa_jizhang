import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DataSource } from 'typeorm'
import { AppModule } from '../app.module'

test('POST /api/analytics/app-visits 在测试库记录一次访问事件', async () => {
  const eventId = randomUUID()
  const visitorId = `v_http_fixture_${eventId.replace(/-/g, '').slice(0, 20)}`
  const app = await NestFactory.create(AppModule, { logger: false })
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  const dataSource = app.get(DataSource)
  const [{ database }] = await dataSource.query('SELECT current_database() AS database')
  assert.equal(database, 'aa_jizhang_test', 'HTTP 集成测试只能写入隔离测试库')

  try {
    await app.listen(0, '127.0.0.1')
    const response = await fetch(`${await app.getUrl()}/api/analytics/app-visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, visitorId }),
    })
    const body = await response.json() as { code: number; data: { recorded: boolean } }

    assert.equal(response.status, 201)
    assert.deepEqual(body, { code: 0, message: 'ok', data: { recorded: true } })
    const rows = await dataSource.query(
      'SELECT id, visitor_id, user_id FROM app_visit_events WHERE id = $1',
      [eventId],
    )
    assert.deepEqual(rows, [{ id: eventId, visitor_id: visitorId, user_id: null }])
  } finally {
    // 仅删除本测试生成的精确 eventId，保留既有访问数据和 started_at 元数据。
    await dataSource.query('DELETE FROM app_visit_events WHERE id = $1', [eventId])
    await app.close()
  }
})
