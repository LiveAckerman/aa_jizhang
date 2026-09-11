import type { ActionContext, ActionRequest, RecordActionResponse } from 'adminjs'
import type { Knex } from 'knex'
import { sanitizeActionResponse } from './sanitize.js'

export const RELATED_RECORDS_PER_PAGE = 10
const MAX_PAGE = 10_000
const SENSITIVE_FIELDS = ['openid', 'unionid', 'inviteCode'] as const

export type RelatedBook = {
  id: string
  name: string
  scene: string
  archived: boolean
  createdAt: string
  relation: 'owner' | 'member'
  role: string | null
}

export type RelatedTransaction = {
  id: string
  type: string
  amount: number
  category: string
  note: string
  spentAt: string
}

export type RelatedRecordsResponse = RecordActionResponse & {
  related: {
    records: RelatedBook[] | RelatedTransaction[]
    page: number
    perPage: number
    total: number
  }
}

const pageFrom = (request: ActionRequest): number => {
  const value = request.query?.page
  const page = typeof value === 'string' ? Number(value) : Number(value)
  if (!Number.isInteger(page) || page < 1) return 1
  return Math.min(page, MAX_PAGE)
}

const responseWithRecord = (
  context: ActionContext,
  related: RelatedRecordsResponse['related'],
): RelatedRecordsResponse => {
  if (!context.record) throw new Error('关联记录所属的详情不存在')
  const response = { record: context.record.toJSON(context.currentAdmin), related }
  return sanitizeActionResponse(response, SENSITIVE_FIELDS) as RelatedRecordsResponse
}

export const createRelatedBooksHandler = (knex: Knex) =>
  async (
    request: ActionRequest,
    _response: unknown,
    context: ActionContext,
  ): Promise<RelatedRecordsResponse> => {
    if (!context.record) throw new Error('关联记录所属的用户不存在')
    const userId = context.record.id()
    const countResult = await knex.raw(
      `
        SELECT count(DISTINCT b.id) AS total
        FROM books AS b
        LEFT JOIN book_members AS bm
          ON bm."bookId" = b.id::text AND bm."userId" = ?
        WHERE b."ownerId" = ? OR bm."userId" = ?
      `,
      [userId, userId, userId],
    )
    const total = Number((countResult.rows[0] as { total?: string | number } | undefined)?.total ?? 0)
    const page = Math.min(pageFrom(request), Math.max(1, Math.ceil(total / RELATED_RECORDS_PER_PAGE)))
    const offset = (page - 1) * RELATED_RECORDS_PER_PAGE
    const result = await knex.raw(
      `
        WITH related_books AS (
          SELECT DISTINCT ON (b.id)
            b.id,
            b.name,
            b.scene,
            b.archived,
            b."createdAt" AS "createdAt",
            CASE WHEN b."ownerId" = ? THEN 'owner' ELSE 'member' END AS relation,
            bm.role
          FROM books AS b
          LEFT JOIN book_members AS bm
            ON bm."bookId" = b.id::text AND bm."userId" = ?
          WHERE b."ownerId" = ? OR bm."userId" = ?
          ORDER BY
            b.id,
            CASE WHEN b."ownerId" = ? THEN 0 ELSE 1 END,
            b."createdAt" DESC
        )
        SELECT * FROM related_books
        ORDER BY "createdAt" DESC, id DESC
        LIMIT ? OFFSET ?
      `,
      [userId, userId, userId, userId, userId, RELATED_RECORDS_PER_PAGE, offset],
    )
    const rows = result.rows as RelatedBook[]
    return responseWithRecord(context, {
      records: rows,
      page,
      perPage: RELATED_RECORDS_PER_PAGE,
      total,
    })
  }

export const createRelatedTransactionsHandler = (knex: Knex) =>
  async (
    request: ActionRequest,
    _response: unknown,
    context: ActionContext,
  ): Promise<RelatedRecordsResponse> => {
    if (!context.record) throw new Error('关联记录所属的账本不存在')
    const bookId = context.record.id()
    const countResult = await knex.raw(
      'SELECT count(*) AS total FROM transactions WHERE "bookId" = ?',
      [bookId],
    )
    const total = Number((countResult.rows[0] as { total?: string | number } | undefined)?.total ?? 0)
    const page = Math.min(pageFrom(request), Math.max(1, Math.ceil(total / RELATED_RECORDS_PER_PAGE)))
    const offset = (page - 1) * RELATED_RECORDS_PER_PAGE
    const result = await knex.raw(
      `
        SELECT
          id,
          type,
          amount,
          category,
          note,
          "spentAt" AS "spentAt"
        FROM transactions
        WHERE "bookId" = ?
        ORDER BY "spentAt" DESC, id DESC
        LIMIT ? OFFSET ?
      `,
      [bookId, RELATED_RECORDS_PER_PAGE, offset],
    )
    const rows = result.rows as RelatedTransaction[]
    return responseWithRecord(context, {
      records: rows,
      page,
      perPage: RELATED_RECORDS_PER_PAGE,
      total,
    })
  }
