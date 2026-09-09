export const zhCNTranslations = {
  actions: {
    list: '列表',
    show: '详情',
    new: '新建',
    edit: '编辑',
    delete: '删除',
    bulkDelete: '批量删除',
    search: '搜索',
  },
  buttons: {
    login: '登录',
    logout: '退出登录',
    filter: '筛选',
    filterActive: '筛选（{{count}}）',
    resetFilter: '重置筛选',
    applyChanges: '应用筛选',
  },
  labels: {
    dashboard: '数据概览',
    navigation: '导航',
    filters: '筛选条件',
    users: '用户',
    books: '账本',
    transactions: '账单',
    业务数据: '业务数据',
  },
  components: {
    LanguageSelector: { availableLanguages: { 'zh-CN': '简体中文' } },
    Login: {
      welcomeHeader: '后台管理',
      welcomeMessage: '查看用户、账本、账单与增长数据。',
      properties: { email: '管理员邮箱', password: '密码' },
      loginButton: '登录',
    },
  },
  messages: {
    noRecords: '暂无数据',
    noRecordsInResource: '暂无数据',
    invalidCredentials: '邮箱或密码不正确',
    errorFetchingRecords: '数据加载失败，请稍后重试',
    errorFetchingRecord: '详情加载失败，请稍后重试',
  },
  resources: {
    users: {
      properties: {
        id: '用户 ID', nickname: '昵称', avatar: '头像',
        isProfileComplete: '资料已完善', hasPromptedProfile: '已提示完善资料',
        hasUsedWechatAvatar: '使用过微信头像', hasUsedWechatNickname: '使用过微信昵称',
        createdAt: '注册时间', updatedAt: '更新时间',
      },
    },
    books: {
      properties: {
        id: '账本 ID', name: '账本名称', scene: '场景', sceneName: '自定义场景',
        icon: '图标', cover: '封面', description: '描述', ownerId: '创建者 ID',
        archived: '已归档', createdAt: '创建时间', updatedAt: '更新时间',
      },
    },
    transactions: {
      properties: {
        id: '账单 ID', bookId: '账本 ID', type: '账单类型', amount: '人民币金额（分）',
        currency: '原始币种', originalAmount: '原币金额（分）', exchangeRate: '兑人民币汇率',
        category: '分类', paymentMethod: '支付方式', note: '备注', payerId: '付款人 ID',
        creatorId: '创建者 ID', splitMethod: '分账方式', splits: '分账明细',
        settledRoundId: '结算轮次 ID', personSettledAt: '按人结清时间', images: '凭证图片',
        locationName: '地点名称', locationAddress: '详细地址', latitude: '纬度', longitude: '经度',
        spentAt: '消费时间', createdAt: '记录时间', updatedAt: '更新时间',
      },
    },
  },
} as const
