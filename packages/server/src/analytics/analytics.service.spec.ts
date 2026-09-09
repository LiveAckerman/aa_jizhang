import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryFailedError } from 'typeorm'
import { ANALYTICS_RATE_LIMITS, AnalyticsRateLimitService } from './analytics-rate-limit.service'
import { AnalyticsService } from './analytics.service'
import { CreateAppVisitDto } from './dto/create-app-visit.dto'
import { validate } from 'class-validator'

test('重复 eventId 返回未新增，保证客户端重试不会重复计数', async () => {
  const repo = {
    insert: async () => {
      throw new QueryFailedError('INSERT', [], { code: '23505' } as never)
    },
  }
  const service = new AnalyticsService(repo as never, new AnalyticsRateLimitService())
  await assert.doesNotReject(async () => {
    assert.deepEqual(await service.recordVisit('c0a8014e-64c8-4a20-a737-999999999999', 'v_1234567890123456'), { recorded: false })
  })
})

test('上报 DTO 拒绝无效 UUID 和访客标识', async () => {
  const dto = Object.assign(new CreateAppVisitDto(), { eventId: 'not-a-uuid', visitorId: 'bad space' })
  const errors = await validate(dto)
  assert.equal(errors.length, 2)
})

test('同一匿名标识一分钟内限制过量上报', () => {
  const limiter = new AnalyticsRateLimitService()
  for (let index = 0; index < ANALYTICS_RATE_LIMITS.maxPerVisitor; index += 1) {
    limiter.check('v_1234567890123456', 100)
  }
  assert.throws(() => limiter.check('v_1234567890123456', 100), { status: 429 })
})

test('匿名标识窗口数量有界，并在时间窗结束后清理过期项', () => {
  const limiter = new AnalyticsRateLimitService()
  for (let index = 0; index <= ANALYTICS_RATE_LIMITS.maxTrackedVisitors; index += 1) {
    limiter.check(`v_${String(index).padStart(16, '0')}`, 100)
  }
  const windows = (limiter as unknown as { windows: Map<string, unknown> }).windows
  assert.equal(windows.size, ANALYTICS_RATE_LIMITS.maxTrackedVisitors)

  limiter.check('v_after_expiration', 100 + ANALYTICS_RATE_LIMITS.windowMs)
  assert.equal(windows.size, 1)
  assert.equal(windows.has('v_after_expiration'), true)
})

test('轮换 visitorId 仍受进程全局请求总量限制', () => {
  const limiter = new AnalyticsRateLimitService()
  for (let index = 0; index < ANALYTICS_RATE_LIMITS.maxGlobal; index += 1) {
    limiter.check(`v_${String(index).padStart(16, '0')}`, 100)
  }
  assert.throws(
    () => limiter.check('v_global_limit_hit', 100),
    (error: { status?: number }) => error.status === 429,
  )
})
