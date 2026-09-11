import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Knex } from 'knex'
import { loadStatistics } from '../statistics.js'

const days = Array.from({ length: 30 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 7, 11 + index))
  return {
    day: date.toISOString().slice(0, 10),
    registrations: 0,
    books: 0,
    transactions: 0,
  }
})

test('uses one as-of instant and preserves Shanghai date strings', async () => {
  const asOf = new Date('2026-09-08T16:00:00.000Z')
  const bindings: unknown[][] = []
  const knex = {
    raw: async (sql: string, values: unknown[] = []) => {
      bindings.push(values)
      if (sql.includes('to_regclass')) {
        return { rows: [{ events_exists: false, status_exists: false }] }
      }
      return { rows: days }
    },
  } as unknown as Knex

  const result = await loadStatistics(knex, asOf)
  assert.equal(result.generatedAt, asOf.toISOString())
  assert.equal(result.periods[0]?.to, '2026-09-09')
  assert.equal(result.metrics.books.series.at(-1)?.date, '2026-09-09')
  assert.equal(result.metrics.books.series.length, 30)
  assert.deepEqual(bindings[0], [asOf, asOf])
  assert.equal(result.metrics.visits.totals.days30.value, null)
  assert.equal(result.metrics.visits.totals.days30.coverage, 'not_collected')
})

test('future visit collection start remains unavailable instead of zero', async () => {
  const asOf = new Date('2026-09-09T02:00:00.000Z')
  const callable = (() => ({
    select: () => ({
      where: () => ({
        first: async () => ({ started_at: new Date('2026-09-10T00:00:00.000Z') }),
      }),
    }),
  })) as unknown as Knex
  callable.raw = (async (sql: string) => {
    if (sql.includes('to_regclass')) {
      return { rows: [{ events_exists: true, status_exists: true }] }
    }
    if (sql.includes('app_visit_events')) {
      return {
        rows: days.map(({ day }) => ({ day, visits: null, coverage: 'not_collected' })),
      }
    }
    return { rows: days }
  }) as Knex['raw']

  const result = await loadStatistics(callable, asOf)
  assert.equal(result.metrics.visits.totals.today.value, null)
  assert.equal(result.metrics.visits.totals.today.coverage, 'not_collected')
  assert.ok(result.metrics.visits.series.every((point) => point.value === null))
})
