import {
  ForbiddenError,
  NotFoundError,
  paramConverter,
  populator,
} from 'adminjs'
import type {
  ActionContext,
  ActionRequest,
  ActionResponse,
  Action,
  BaseRecord,
  Filter,
  RecordActionResponse,
  ResourceOptions,
} from 'adminjs'
import { Resource as SqlResource } from '@adminjs/sql'
import type { DatabaseMetadata, ResourceMetadata } from '@adminjs/sql'
import type { Knex } from 'knex'
import {
  createRelatedBooksHandler,
  createRelatedTransactionsHandler,
} from './related-records.js'
import { sanitizeActionResponse } from './sanitize.js'
import type { AdminApiClient } from './business-api.js'

const READ_ONLY_ACTIONS: ResourceOptions['actions'] = {
  new: { isAccessible: false, isVisible: false },
  edit: { isAccessible: false, isVisible: false },
  delete: { isAccessible: false, isVisible: false },
  bulkDelete: { isAccessible: false, isVisible: false },
}

const SENSITIVE_FIELDS = ['openid', 'unionid', 'inviteCode'] as const

export { sanitizeActionResponse } from './sanitize.js'

const queryGuard = (allowedQueryFields: readonly string[]) => {
  const before = async (request: ActionRequest): Promise<ActionRequest> => {
    const query = request.query ?? {}
    const filterKeys = new Set<string>()
    const nestedFilters = query.filters
    if (nestedFilters && typeof nestedFilters === 'object') {
      Object.keys(nestedFilters).forEach((key) => filterKeys.add(key))
    }
    for (const key of Object.keys(query)) {
      const match = key.match(/^filters(?:\.|\[)([^.\]]+)/)
      if (match?.[1]) filterKeys.add(match[1])
    }

    const allowed = new Set(allowedQueryFields)
    const requestedFields = [
      ...filterKeys,
      typeof query.sortBy === 'string' ? query.sortBy : '',
      typeof query.searchProperty === 'string' ? query.searchProperty : '',
    ].filter(Boolean)
    if (requestedFields.some((field) => !allowed.has(field))) {
      throw new ForbiddenError('不允许按该字段查询')
    }
    return request
  }
  return before
}

export const createReadActions = (
  allowedQueryFields: readonly string[],
): ResourceOptions['actions'] => {
  const after = async <T extends ActionResponse>(response: T): Promise<T> => {
    sanitizeActionResponse(response, SENSITIVE_FIELDS)
    return response
  }
  const before = queryGuard(allowedQueryFields)

  return {
    ...READ_ONLY_ACTIONS,
    list: { before, after },
    show: { after },
    search: { before, after },
  } as ResourceOptions['actions']
}

const hidden = {
  isVisible: { list: false, filter: false, show: false, edit: false },
} as const

const values = (entries: Array<[string, string]>) =>
  entries.map(([value, label]) => ({ value, label }))

const getTable = (database: DatabaseMetadata, tableName: string) => {
  const table = database.table(tableName)
  if (!table) throw new Error(`数据库缺少必需表 ${tableName}`)
  return table
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value)

class SafeUserResource extends SqlResource {
  constructor(info: ResourceMetadata) {
    super(info)
  }

  private hasInvalidIdFilter(filter: Filter | undefined): boolean {
    const value = filter?.filters?.id?.value
    return typeof value === 'string' && !isUuid(value)
  }

  async count(filter: Filter): Promise<number> {
    if (this.hasInvalidIdFilter(filter)) return 0
    return super.count(filter)
  }

  async find(
    filter: Filter,
    options: {
      limit?: number
      offset?: number
      sort?: { sortBy?: string; direction?: 'asc' | 'desc' }
    },
  ) {
    if (this.hasInvalidIdFilter(filter)) return []
    return super.find(filter, options)
  }

  async findOne(id: string) {
    if (!isUuid(id)) return null
    return super.findOne(id)
  }

  async findMany(ids: (string | number)[]) {
    const validIds = ids.filter((id): id is string => isUuid(id))
    if (!validIds.length) return []
    return super.findMany(validIds)
  }
}

type SplitParams = {
  userId?: unknown
  nickname?: unknown
  [key: string]: unknown
}

/** Adds read-only nickname data to split JSON for the custom AdminJS property. */
class TransactionResource extends SqlResource {
  private readonly dataKnex: Knex

  constructor(info: ResourceMetadata) {
    super(info)
    this.dataKnex = info.knex
  }

  private async withSplitNicknames(records: BaseRecord[]): Promise<BaseRecord[]> {
    const splitRecords = records
      .map((record) => ({ record, value: record.get('splits') }))
      .filter(({ value }) => Array.isArray(value) || typeof value === 'string')
    if (!splitRecords.length) return records

    const userIds = new Set<string>()
    for (const { value } of splitRecords) {
      const parsed = typeof value === 'string' ? this.parseSplits(value) : value
      if (!Array.isArray(parsed)) continue
      for (const split of parsed) {
        if (!split || typeof split !== 'object') continue
        const userId = (split as SplitParams).userId
        if (typeof userId === 'string' && isUuid(userId)) userIds.add(userId)
      }
    }
    if (!userIds.size) return records

    const rows = (await this.dataKnex('users')
      .select(['id', 'nickname'])
      .whereIn('id', [...userIds])) as Array<{ id: string; nickname?: unknown }>
    const nicknames = new Map(
      rows.map((row) => [
        String(row.id),
        typeof row.nickname === 'string' ? row.nickname.trim() : '',
      ]),
    )

    for (const { record, value } of splitRecords) {
      const parsed = typeof value === 'string' ? this.parseSplits(value) : value
      if (!Array.isArray(parsed)) continue
      const enriched = parsed.map((split) => {
        if (!split || typeof split !== 'object') return split
        const item = split as SplitParams
        const userId = typeof item.userId === 'string' ? item.userId : ''
        const nickname = userId ? nicknames.get(userId) : undefined
        return nickname ? { ...item, nickname } : item
      })
      record.set('splits', enriched)
    }
    return records
  }

  private parseSplits(value: string): unknown {
    try {
      return JSON.parse(value)
    } catch {
      return undefined
    }
  }

  async find(filter: Filter, options: Parameters<SqlResource['find']>[1]) {
    return this.withSplitNicknames(await super.find(filter, options))
  }

  async findOne(id: string) {
    const record = await super.findOne(id)
    return record ? (await this.withSplitNicknames([record]))[0] ?? null : null
  }

  async findMany(ids: (string | number)[]) {
    return this.withSplitNicknames(await super.findMany(ids))
  }
}

type PropertyComponents = {
  media: string
  money: string
  user: string
  splits: string
  relatedRecords: string
}

const parseJsonField = (value: unknown, label: string): unknown => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`${label}必须是有效的 JSON`)
  }
}

const asNumber = (value: unknown): unknown => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : value
}

const pick = (
  params: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> =>
  Object.fromEntries(
    fields
      .filter((field) => params[field] !== undefined)
      .map((field) => [field, params[field]]),
  )

const userPayload = (params: Record<string, unknown>) =>
  pick(params, ['nickname', 'avatar'])

const bookPayload = (params: Record<string, unknown>) =>
  pick(params, [
    'name',
    'scene',
    'sceneName',
    'icon',
    'cover',
    'description',
    'archived',
  ])

const transactionPayload = (params: Record<string, unknown>) => {
  const payload = pick(params, [
    'bookId',
    'creatorId',
    'type',
    'amount',
    'category',
    'paymentMethod',
    'note',
    'payerId',
    'splitMethod',
    'participantIds',
    'splits',
    'images',
    'locationName',
    'locationAddress',
    'latitude',
    'longitude',
    'spentAt',
    'currency',
    'originalAmount',
    'exchangeRate',
  ])
  for (const field of ['amount', 'originalAmount', 'latitude', 'longitude', 'exchangeRate']) {
    if (field in payload) payload[field] = asNumber(payload[field])
  }
  if ('splits' in payload) payload.splits = parseJsonField(payload.splits, '分账明细')
  if ('images' in payload) payload.images = parseJsonField(payload.images, '凭证图片')
  if ('participantIds' in payload) {
    payload.participantIds = parseJsonField(payload.participantIds, '参与人')
  }
  return payload
}

const responseWithRecord = async (
  context: ActionContext,
  recordId?: string,
): Promise<RecordActionResponse> => {
  const record = recordId
    ? await context.resource.findOne(recordId, context)
    : context.record
  if (!record) throw new NotFoundError('记录不存在', 'Action#handler')
  const [populated] = await populator([record], context)
  context.record = populated
  const response = {
    record: populated.toJSON(context.currentAdmin),
  }
  sanitizeActionResponse(response, SENSITIVE_FIELDS)
  return response
}

const resourceId = (context: ActionContext): string =>
  context.resource._decorated?.id() || context.resource.id()

type RecordMutationAction = Partial<Action<RecordActionResponse>>

const disabledAction: RecordMutationAction = {
  isAccessible: false,
  isVisible: false,
}

const createEditAction = (
  api: AdminApiClient | null,
  path: string,
  normalize: (params: Record<string, unknown>) => unknown,
): RecordMutationAction => {
  if (!api) return disabledAction
  return {
    isAccessible: true,
    isVisible: true,
    handler: async (
      request: ActionRequest,
      _response: unknown,
      context: ActionContext,
    ): Promise<RecordActionResponse> => {
      if (!context.record) throw new NotFoundError('记录不存在', 'Action#handler')
      if (request.method === 'get') return responseWithRecord(context)
      const id = String(request.params.recordId || context.record.id())
      const params = paramConverter.prepareParams(
        request.payload ?? {},
        context.resource,
      )
      await api.request('PATCH', `admin/${path}/${encodeURIComponent(id)}`, normalize(params))
      const result = await responseWithRecord(context, id)
      return {
        ...result,
        redirectUrl: context.h.resourceUrl({ resourceId: resourceId(context) }),
        notice: { message: '更新成功', type: 'success' },
      }
    },
  }
}

const createNewAction = (
  api: AdminApiClient | null,
  path: string,
  normalize: (params: Record<string, unknown>) => unknown,
): RecordMutationAction => {
  if (!api) return disabledAction
  return {
    actionType: 'resource',
    isAccessible: true,
    isVisible: true,
    handler: async (
      request: ActionRequest,
      _response: unknown,
      context: ActionContext,
    ): Promise<RecordActionResponse> => {
      if (request.method !== 'post') {
        throw new Error('新建操作必须使用 POST')
      }
      const params = paramConverter.prepareParams(
        request.payload ?? {},
        context.resource,
      )
      const created = await api.request<{ id: string }>(
        'POST',
        `admin/${path}`,
        normalize(params),
      )
      const result = await responseWithRecord(context, String(created.id))
      return {
        ...result,
        redirectUrl: context.h.resourceUrl({ resourceId: resourceId(context) }),
        notice: { message: '创建成功', type: 'success' },
      }
    },
  }
}

const createDeleteAction = (
  api: AdminApiClient | null,
  path: string,
): RecordMutationAction => {
  if (!api) return disabledAction
  return {
    isAccessible: true,
    isVisible: true,
    guard: 'confirmDelete',
    handler: async (
      request: ActionRequest,
      _response: unknown,
      context: ActionContext,
    ): Promise<RecordActionResponse> => {
      if (!context.record) throw new NotFoundError('记录不存在', 'Action#handler')
      if (request.method === 'get') return responseWithRecord(context)
      const id = String(request.params.recordId || context.record.id())
      const result = await responseWithRecord(context)
      await api.request('DELETE', `admin/${path}/${encodeURIComponent(id)}`)
      return {
        ...result,
        redirectUrl: context.h.resourceUrl({ resourceId: resourceId(context) }),
        notice: { message: '删除成功', type: 'success' },
      }
    },
  }
}

export const buildResources = (
  database: DatabaseMetadata,
  components: PropertyComponents,
  knex: Knex,
  api: AdminApiClient | null = null,
) => [
  {
    resource: new SafeUserResource(getTable(database, 'users')),
    options: {
      navigation: { name: '业务数据', icon: 'User' },
      id: 'users',
      listProperties: ['nickname', 'avatar', 'isProfileComplete', 'createdAt', 'updatedAt'],
      showProperties: [
        'id',
        'nickname',
        'avatar',
        'isProfileComplete',
        'hasPromptedProfile',
        'hasUsedWechatAvatar',
        'hasUsedWechatNickname',
        'createdAt',
        'updatedAt',
        'relatedBooks',
      ],
      filterProperties: ['id', 'nickname', 'isProfileComplete', 'createdAt'],
      sort: { sortBy: 'createdAt', direction: 'desc' },
      properties: {
        id: { isTitle: false },
        nickname: { isTitle: true },
        openid: hidden,
        unionid: hidden,
        avatar: { components: { list: components.media, show: components.media } },
        isProfileComplete: {},
        createdAt: {},
        updatedAt: {},
        relatedBooks: {
          type: 'mixed',
          isVisible: { list: false, filter: false, show: true, edit: false },
          components: { show: components.relatedRecords },
        },
      },
      actions: {
        ...createReadActions([
          'id',
          'nickname',
          'avatar',
          'isProfileComplete',
          'hasPromptedProfile',
          'hasUsedWechatAvatar',
          'hasUsedWechatNickname',
          'createdAt',
          'updatedAt',
        ]),
        edit: createEditAction(api, 'users', userPayload),
        relatedBooks: {
          actionType: 'record',
          isAccessible: true,
          isVisible: false,
          handler: createRelatedBooksHandler(knex),
        },
      },
    } satisfies ResourceOptions,
  },
  {
    resource: getTable(database, 'books'),
    options: {
      navigation: { name: '业务数据', icon: 'Book' },
      id: 'books',
      listProperties: ['name', 'cover', 'scene', 'ownerId', 'archived', 'createdAt'],
      showProperties: [
        'id',
        'name',
        'scene',
        'sceneName',
        'icon',
        'cover',
        'description',
        'ownerId',
        'archived',
        'createdAt',
        'updatedAt',
        'relatedTransactions',
      ],
      filterProperties: ['id', 'name', 'scene', 'ownerId', 'archived', 'createdAt'],
      sort: { sortBy: 'createdAt', direction: 'desc' },
      properties: {
        name: { isTitle: true },
        scene: {
          availableValues: values([
            ['travel', '旅行'],
            ['dinner', '聚餐'],
            ['rent', '合租'],
            ['activity', '活动'],
            ['party', '聚会'],
            ['club', '社团'],
            ['family', '家庭'],
            ['wedding', '婚礼'],
            ['custom', '自定义'],
          ]),
        },
        inviteCode: hidden,
        cover: { components: { list: components.media, show: components.media } },
        ownerId: {
          reference: 'users',
          components: { list: components.user, show: components.user },
          description: '创建后不可更换；新建账本时填写用户 ID。',
        },
        archived: {},
        createdAt: {},
        updatedAt: {},
        relatedTransactions: {
          type: 'mixed',
          isVisible: { list: false, filter: false, show: true, edit: false },
          components: { show: components.relatedRecords },
        },
      },
      actions: {
        ...createReadActions([
          'id',
          'name',
          'scene',
          'sceneName',
          'icon',
          'cover',
          'description',
          'ownerId',
          'archived',
          'createdAt',
          'updatedAt',
        ]),
        new: createNewAction(api, 'books', (params) =>
          pick(params, [
            'ownerId',
            'name',
            'scene',
            'sceneName',
            'icon',
            'cover',
            'description',
          ]),
        ),
        edit: createEditAction(api, 'books', bookPayload),
        delete: createDeleteAction(api, 'books'),
        relatedTransactions: {
          actionType: 'record',
          isAccessible: true,
          isVisible: false,
          handler: createRelatedTransactionsHandler(knex),
        },
      },
    } satisfies ResourceOptions,
  },
  {
    resource: new TransactionResource(getTable(database, 'transactions')),
    options: {
      navigation: { name: '业务数据', icon: 'DollarSign' },
      id: 'transactions',
      listProperties: [
        'type',
        'amount',
        'currency',
        'category',
        'images',
        'payerId',
        'creatorId',
        'spentAt',
      ],
      showProperties: [
        'id',
        'bookId',
        'type',
        'amount',
        'currency',
        'originalAmount',
        'exchangeRate',
        'category',
        'paymentMethod',
        'note',
        'payerId',
        'creatorId',
        'splitMethod',
        'splits',
        'settledRoundId',
        'personSettledAt',
        'images',
        'locationName',
        'locationAddress',
        'latitude',
        'longitude',
        'spentAt',
        'createdAt',
        'updatedAt',
      ],
      filterProperties: [
        'id',
        'bookId',
        'type',
        'category',
        'paymentMethod',
        'payerId',
        'creatorId',
        'settledRoundId',
        'spentAt',
      ],
      sort: { sortBy: 'spentAt', direction: 'desc' },
      properties: {
        id: { isTitle: true },
        type: {
          availableValues: values([
            ['shared', '共享账'],
            ['private', '私密账'],
          ]),
        },
        splitMethod: {
          availableValues: values([
            ['average', '平均分'],
            ['ratio', '按比例'],
            ['shares', '按份数'],
            ['fixed', '固定金额'],
          ]),
        },
        paymentMethod: {
          availableValues: values([
            ['wechat', '微信'],
            ['alipay', '支付宝'],
            ['bankcard', '银行卡'],
            ['cash', '现金'],
            ['other', '其他'],
          ]),
        },
        category: {
          availableValues: values([
            ['food', '餐饮'],
            ['transport', '交通'],
            ['hotel', '住宿'],
            ['shopping', '购物'],
            ['entertainment', '娱乐'],
            ['ticket', '门票'],
            ['other', '其他'],
          ]),
        },
        amount: {
          components: { list: components.money, show: components.money },
          description: 'CNY 金额，列表与详情按元展示。',
        },
        images: { components: { list: components.media, show: components.media } },
        splits: { components: { show: components.splits } },
        originalAmount: {
          components: { list: components.money, show: components.money },
          description: 'currency 对应的原币金额，列表与详情按元展示。',
        },
        participantIds: {
          type: 'mixed',
          isVisible: { list: false, filter: false, show: false, edit: true },
          description: '平均分摊时填写 JSON 数组，例如 ["用户 UUID"]。',
        },
        bookId: {
          reference: 'books',
          description: '所属账本不可修改；新建账单时填写账本 ID。',
        },
        payerId: {
          reference: 'users',
          components: { list: components.user, show: components.user },
        },
        creatorId: {
          reference: 'users',
          components: { list: components.user, show: components.user },
          description: '记录创建者不可修改；新建账单时填写用户 ID。',
        },
        spentAt: {},
        createdAt: {},
        updatedAt: {},
      },
      actions: {
        ...createReadActions([
          'id',
          'bookId',
          'type',
          'amount',
          'currency',
          'originalAmount',
          'exchangeRate',
          'category',
          'paymentMethod',
          'note',
          'payerId',
          'creatorId',
          'splitMethod',
          'splits',
          'settledRoundId',
          'personSettledAt',
          'images',
          'locationName',
          'locationAddress',
          'latitude',
          'longitude',
          'spentAt',
          'createdAt',
          'updatedAt',
        ]),
        new: createNewAction(api, 'transactions', transactionPayload),
        edit: createEditAction(api, 'transactions', transactionPayload),
        delete: createDeleteAction(api, 'transactions'),
      },
    } satisfies ResourceOptions,
  },
]

export { READ_ONLY_ACTIONS, SENSITIVE_FIELDS }
