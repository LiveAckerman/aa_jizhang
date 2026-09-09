import { ForbiddenError } from 'adminjs'
import type { ActionRequest, ActionResponse, ResourceOptions } from 'adminjs'
import type { DatabaseMetadata } from '@adminjs/sql'

const READ_ONLY_ACTIONS: ResourceOptions['actions'] = {
  new: { isAccessible: false, isVisible: false },
  edit: { isAccessible: false, isVisible: false },
  delete: { isAccessible: false, isVisible: false },
  bulkDelete: { isAccessible: false, isVisible: false },
}

const SENSITIVE_FIELDS = ['openid', 'unionid', 'inviteCode'] as const

type SerializedRecord = {
  params?: Record<string, unknown>
  populated?: Record<string, SerializedRecord | null>
}

const stripRecordFields = (
  record: SerializedRecord | undefined,
  fields: readonly string[],
): void => {
  if (!record) return
  for (const field of fields) delete record.params?.[field]
  for (const populated of Object.values(record.populated ?? {})) {
    if (populated) stripRecordFields(populated, fields)
  }
}

export const sanitizeActionResponse = (
  response: ActionResponse,
  fields: readonly string[],
): ActionResponse => {
  stripRecordFields(response.record as SerializedRecord | undefined, fields)
  for (const record of response.records ?? []) {
    stripRecordFields(record as SerializedRecord, fields)
  }
  return response
}

export const createReadActions = (
  allowedQueryFields: readonly string[],
): ResourceOptions['actions'] => {
  const after = async <T extends ActionResponse>(response: T): Promise<T> => {
    sanitizeActionResponse(response, SENSITIVE_FIELDS)
    return response
  }

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

export const buildResources = (database: DatabaseMetadata) => [
  {
    resource: getTable(database, 'users'),
    options: {
      navigation: { name: '业务数据', icon: 'User' },
      id: 'users',
      listProperties: [
        'id',
        'nickname',
        'avatar',
        'isProfileComplete',
        'createdAt',
        'updatedAt',
      ],
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
      ],
      filterProperties: ['id', 'nickname', 'isProfileComplete', 'createdAt'],
      sort: { sortBy: 'createdAt', direction: 'desc' },
      properties: {
        id: { isTitle: false },
        nickname: { isTitle: true },
        openid: hidden,
        unionid: hidden,
        isProfileComplete: {},
        createdAt: {},
        updatedAt: {},
      },
      actions: createReadActions([
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
    } satisfies ResourceOptions,
  },
  {
    resource: getTable(database, 'books'),
    options: {
      navigation: { name: '业务数据', icon: 'Book' },
      id: 'books',
      listProperties: ['id', 'name', 'scene', 'ownerId', 'archived', 'createdAt'],
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
      ],
      filterProperties: ['id', 'name', 'scene', 'ownerId', 'archived', 'createdAt'],
      sort: { sortBy: 'createdAt', direction: 'desc' },
      properties: {
        name: { isTitle: true },
        scene: { availableValues: values([
          ['travel', '旅行'], ['dinner', '聚餐'], ['rent', '合租'],
          ['activity', '活动'], ['party', '聚会'], ['club', '社团'],
          ['family', '家庭'], ['wedding', '婚礼'], ['custom', '自定义'],
        ]) },
        inviteCode: hidden,
        ownerId: {},
        archived: {},
        createdAt: {},
        updatedAt: {},
      },
      actions: createReadActions([
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
    } satisfies ResourceOptions,
  },
  {
    resource: getTable(database, 'transactions'),
    options: {
      navigation: { name: '业务数据', icon: 'DollarSign' },
      id: 'transactions',
      listProperties: [
        'id',
        'bookId',
        'type',
        'amount',
        'currency',
        'category',
        'payerId',
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
        type: { availableValues: values([['shared', '共享账'], ['private', '私密账']]) },
        splitMethod: { availableValues: values([
          ['average', '平均分'], ['ratio', '按比例'], ['shares', '按份数'], ['fixed', '固定金额'],
        ]) },
        paymentMethod: { availableValues: values([
          ['wechat', '微信'], ['alipay', '支付宝'], ['bankcard', '银行卡'],
          ['cash', '现金'], ['other', '其他'],
        ]) },
        category: { availableValues: values([
          ['food', '餐饮'], ['transport', '交通'], ['hotel', '住宿'],
          ['shopping', '购物'], ['entertainment', '娱乐'], ['ticket', '门票'],
          ['other', '其他'],
        ]) },
        amount: { description: 'CNY 金额，单位：分' },
        originalAmount: { description: 'currency 对应的原币金额，单位：分' },
        bookId: {},
        payerId: {},
        creatorId: {},
        spentAt: {},
        createdAt: {},
        updatedAt: {},
      },
      actions: createReadActions([
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
    } satisfies ResourceOptions,
  },
]

export { READ_ONLY_ACTIONS, SENSITIVE_FIELDS }
