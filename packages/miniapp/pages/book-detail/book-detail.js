const app = getApp()
const api = require('../../utils/api')
const { CATEGORY_MAP, shareImageForScene } = require('../../constants/ledger')
const { handleBookAction } = require('../../utils/book-actions')

Page({
  data: {
    id: '',
    book: null,
    coverUrl: '',
    members: [],
    isOwner: false,
    myUserId: '',
    summary: {
      sharedTotal: 0,
      myShared: 0,
      myPrivate: 0,
      myTotal: 0,
      pendingPay: 0,
      pendingReceive: 0,
    },
    summaryText: {
      sharedTotal: '0.00',
      myShared: '0.00',
      myPrivate: '0.00',
      myTotal: '0.00',
      pendingPay: '0.00',
      pendingReceive: '0.00',
    },
    allTxs: [], // 原始账单列表（未过滤）
    groups: [], // 未结算账单按日期分组
    settledList: [], // 已结算账单（全量，交给 card-stack 组件展示）
    txFilter: 'all', // 账单筛选：all / shared(公账) / private(私账)
    txCounts: { all: 0, shared: 0, private: 0 }, // 各 tab 的账单笔数（角标）
    settling: false,          // 全部结算提交中
    showRoundDrawer: false,   // 进行中轮次弹窗
    activeRounds: [],         // 进行中轮次列表（弹窗用）
    activeRoundCount: 0,      // 进行中轮次数量（结算记录入口角标）
    activeRoundIds: [],       // 进行中轮次 id 集合（区分结算中/已结算）
    loading: true,
  },

  onLoad(query) {
    this.setData({ id: query.id, myUserId: (app.globalData.user || {}).id || '' })
    // 开启右上角转发菜单
    if (wx.showShareMenu) {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
    }
  },

  onShow() {
    if (this.data.id) this.loadAll()
  },

  onPullDownRefresh() {
    this.loadAll().finally(() => wx.stopPullDownRefresh())
  },

  async loadAll() {
    // 守卫：id 未就位（首次 onLoad 前被误调 / 页面栈异常带空参进入）直接跳过，
    // 避免向后端发 bookId=undefined，导致弹「你不是该账本成员」的假 403
    if (!this.data.id) return
    // 首次进入没数据 时展示骨架；已经有数据（从子页返回）静默刷新
    if (!this.data.book) {
      this.setData({ loading: true })
    }
    try {
      const [book, txs, summary, activeRounds] = await Promise.all([
        api.bookDetail(this.data.id),
        api.listTransactions(this.data.id),
        api.transactionSummary(this.data.id),
        api.activeRounds(this.data.id).catch(() => []),
      ])
      const myUserId = this.data.myUserId
      const isOwner = book.ownerId === myUserId
      wx.setNavigationBarTitle({ title: book.name })
      this.setData({
        book,
        coverUrl: book.coverUrl,
        members: book.members || [],
        isOwner,
        summary,
        summaryText: {
          sharedTotal: (summary.sharedTotal / 100).toFixed(2),
          myShared: (summary.myShared / 100).toFixed(2),
          myPrivate: (summary.myPrivate / 100).toFixed(2),
          myTotal: (summary.myTotal / 100).toFixed(2),
          pendingPay: ((summary.pendingPay || 0) / 100).toFixed(2),
          pendingReceive: ((summary.pendingReceive || 0) / 100).toFixed(2),
        },
        // 通用 book-card 归一化数据（detail 头图用）
        headerCard: {
          id: book.id,
          name: book.name,
          coverUrl: book.coverUrl,
          ownerId: book.ownerId,
          archived: book.archived,
          inviteCode: book.inviteCode,
          members: (book.members || []).map((m) => ({ avatar: m.avatar, userId: m.userId })),
          bookTotalText: (summary.sharedTotal / 100).toFixed(2),
          myTotalText: (summary.myTotal / 100).toFixed(2),
          mySharedText: (summary.myShared / 100).toFixed(2),
          myPrivateText: (summary.myPrivate / 100).toFixed(2),
          hasPrivate: (summary.myPrivate || 0) > 0,
          dateText: '',
        },
        allTxs: txs || [],
        activeRoundCount: (activeRounds || []).length,
        // 进行中轮次 id 集合：账单归属这些轮次即"结算中"，否则（轮次已完成）为"已结算"
        activeRoundIds: (activeRounds || []).map((r) => r.id),
      })
      this.applyTxFilter()
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 切换账单筛选 tab：全部 / 公账 / 私账
  onPickTxFilter(e) {
    const val = e.currentTarget.dataset.val
    if (val === this.data.txFilter) return
    this.setData({ txFilter: val })
    this.applyTxFilter()
  },

  // 按当前 txFilter 过滤账单，重算分组与各 tab 角标
  applyTxFilter() {
    const filter = this.data.txFilter
    const all = this.data.allTxs || []
    const list = all.filter((t) => {
      if (filter === 'shared') return t.type !== 'private'
      if (filter === 'private') return t.type === 'private'
      return true
    })

    // 各 tab 笔数（角标，含已结算，反映账本全貌）
    const sharedCount = all.filter((t) => t.type !== 'private').length
    const privateCount = all.filter((t) => t.type === 'private').length

    // 三态拆分：
    //   已结算：整笔按人结清(personSettledAt) 或 所属轮次已完成 → 折叠成堆叠+抽屉
    //   结算中：归属某个「进行中」轮次(settledRoundId 在 activeRoundIds 内) → 留在列表、标记、不可再选/改
    //   未结算：其余 → 正常展示，可参与结算
    const activeSet = new Set(this.data.activeRoundIds || [])
    const isSettling = (t) => !!t.settledRoundId && activeSet.has(t.settledRoundId)
    const isSettled = (t) =>
      !!t.personSettledAt || (!!t.settledRoundId && !activeSet.has(t.settledRoundId))

    // 未结算 + 结算中 都留在主列表；已结算折叠
    const inList = list.filter((t) => !isSettled(t))
    const settled = list.filter(isSettled)

    const memberMap = {}
    ;(this.data.members || []).forEach((m) => (memberMap[m.userId] = m.nickname))
    const myUserId = this.data.myUserId
    const settledList = settled.map((t) => this.decorateTx(t, memberMap, myUserId))

    this.setData({
      groups: this.groupByDate(inList),
      settledList,
      txCounts: {
        all: all.length,
        shared: sharedCount,
        private: privateCount,
      },
    })
  },


  // 给单条账单附加展示字段（供列表 / 堆叠 / 抽屉复用）
  decorateTx(t, memberMap, myUserId) {
    const cat = CATEGORY_MAP[t.category] || CATEGORY_MAP.other
    const isMyPayment = t.type !== 'private' && t.payerId === myUserId
    // 公账才计算我的收付；私账不显示
    //   我是付款人：别人欠我的 = 总额 - 我自己那份 → 我应收
    //   我不是付款人：splits 里我的份额 → 我应付
    let myShareText = '' // 应付金额（元）
    let myReceiveText = '' // 应收金额（元）
    if (t.type !== 'private') {
      const mine = (t.splits || []).find((s) => s.userId === myUserId)
      const myShareAmount = mine ? mine.amount : 0
      if (isMyPayment) {
        const receive = t.amount - myShareAmount // 别人应还给我的部分
        if (receive > 0) myReceiveText = (receive / 100).toFixed(2)
      } else if (mine) {
        myShareText = (myShareAmount / 100).toFixed(2)
      }
    }
    const activeSet = new Set(this.data.activeRoundIds || [])
    const settling = !!t.settledRoundId && activeSet.has(t.settledRoundId)
    return {
      ...t,
      amountText: (t.amount / 100).toFixed(2),
      categoryName: cat.name,
      categoryIcon: cat.icon,
      payerName: memberMap[t.payerId] || '成员',
      isPrivate: t.type === 'private',
      isSettled: !!t.settledRoundId,
      settling, // 结算中（归属进行中轮次）：列表内展示、不可选/改
      isMyPayment,
      myShareText,
      myReceiveText,
    }
  },

  // 把流水按日期分组，附带展示字段
  groupByDate(txs) {
    const memberMap = {}
    ;(this.data.members || []).forEach((m) => (memberMap[m.userId] = m.nickname))
    const map = {}
    const myUserId = this.data.myUserId
    txs.forEach((t) => {
      const d = t.spentAt ? t.spentAt.slice(0, 10) : ''
      if (!map[d]) map[d] = []
      map[d].push(this.decorateTx(t, memberMap, myUserId))
    })
    return Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => ({ date, items: map[date] }))
  },

  onAddTransaction() {
    wx.navigateTo({ url: `/pages/add-transaction/add-transaction?bookId=${this.data.id}` })
  },

  // 票据自动识别：拍照/相册 → 上传识别 → 跳批量编辑页
  onOcrRecognize() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: async (res) => {
        wx.showLoading({ title: '识别中...', mask: true })
        try {
          const filePath = res.tempFiles[0].tempFilePath
          const result = await api.ocrRecognizeReceipt(filePath, this.data.id)
          wx.hideLoading()
          if (!result.records || result.records.length === 0) {
            wx.showToast({ title: '未识别到账单记录', icon: 'none' })
            return
          }
          wx.navigateTo({
            url: `/pages/ocr-batch-edit/ocr-batch-edit?bookId=${this.data.id}`,
            success: (navRes) => {
              navRes.eventChannel.emit('ocrResult', result)
            },
          })
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '识别失败', icon: 'none' })
        }
      },
    })
  },

  onTapTransaction(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/add-transaction/add-transaction?bookId=${this.data.id}&id=${id}` })
  },

  onInvite() {
    wx.navigateTo({ url: `/pages/invite/invite?id=${this.data.id}` })
  },

  onStatistics() {
    // 统计页是 tabbar 页，switchTab 不支持 query，用全局变量传递目标账本
    getApp().globalData.statsTargetBookId = this.data.id
    wx.switchTab({ url: '/pages/statistics/statistics' })
  },

  // 点击待支付/待收款卡片 → 按人结算明细页
  onOpenSettleDetail(e) {
    const tab = e.currentTarget.dataset.tab
    wx.navigateTo({
      url: `/pages/settle-detail/settle-detail?bookId=${this.data.id}&tab=${tab}`,
    })
  },

  // 是否存在可结算账单（未结算的公账）
  _hasSettleable() {
    return (this.data.allTxs || []).some((t) => t.type !== 'private' && !t.settledRoundId)
  },

  // 全部结算：把当前与我相关的未入轮次账单锁进新轮次 → 进该轮次的按人结算页
  async onSettleAll() {
    if (this.data.settling) return
    this.setData({ settling: true })
    wx.showLoading({ title: '生成结算...', mask: true })
    try {
      const res = await api.settle({ bookId: this.data.id, type: 'all' })
      wx.hideLoading()
      this.setData({ settling: false })
      const roundId = res && res.round && res.round.id
      if (!roundId) {
        wx.showToast({ title: '结算创建异常，请重试', icon: 'none' })
        return
      }
      wx.navigateTo({
        url: `/pages/settle-detail/settle-detail?bookId=${this.data.id}&roundId=${roundId}`,
      })
    } catch (e) {
      wx.hideLoading()
      this.setData({ settling: false })
      wx.showToast({ title: (e && e.message) || '没有可结算的账单', icon: 'none' })
    }
  },

  // 部分结算：先查进行中轮次，有则弹窗让用户选择
  async onSettlePartial() {
    let rounds = []
    try {
      rounds = await api.activeRounds(this.data.id)
    } catch (e) {}
    if (rounds && rounds.length > 0) {
      this.setData({ activeRounds: this._decorateRounds(rounds), showRoundDrawer: true })
    } else {
      this._gotoSettleSelect()
    }
  },

  // 进部分结算选账单页
  _gotoSettleSelect() {
    const bookName = encodeURIComponent(this.data.book.name || '账本')
    wx.navigateTo({
      url: `/pages/settle-select/settle-select?bookId=${this.data.id}&bookName=${bookName}`,
    })
  },

  // 轮次弹窗：附加展示字段
  _decorateRounds(rounds) {
    return rounds.map((r) => ({
      id: r.id,
      typeText: r.type === 'all' ? '全部结算' : '部分结算',
      txCount: r.txCount,
      amountText: ((r.totalAmount || 0) / 100).toFixed(2),
      dateText: r.createdAt ? String(r.createdAt).slice(0, 10) : '',
    }))
  },

  // 弹窗：关闭
  onCloseRoundDrawer() {
    this.setData({ showRoundDrawer: false })
  },

  // 弹窗：直接开启新一轮部分结算
  onStartNewRound() {
    this.setData({ showRoundDrawer: false })
    this._gotoSettleSelect()
  },

  // 弹窗：点某进行中轮次 → 进该轮次结算页
  onTapRound(e) {
    const roundId = e.currentTarget.dataset.id
    this.setData({ showRoundDrawer: false })
    wx.navigateTo({
      url: `/pages/settle-detail/settle-detail?bookId=${this.data.id}&roundId=${roundId}`,
    })
  },

  // 弹窗：删除进行中轮次（释放账单）
  onDeleteRound(e) {
    const roundId = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除结算轮次',
      content: '删除后本轮账单将被释放，可重新参与结算。确认删除？',
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中...', mask: true })
        try {
          await api.revertSettlementRound(roundId)
          wx.hideLoading()
          wx.showToast({ title: '已删除', icon: 'success' })
          // 刷新弹窗内轮次列表
          const rounds = await api.activeRounds(this.data.id)
          if (rounds && rounds.length > 0) {
            this.setData({ activeRounds: this._decorateRounds(rounds) })
          } else {
            this.setData({ showRoundDrawer: false })
          }
          this.loadAll()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
        }
      },
    })
  },

  // 结算记录入口
  onOpenSettleRounds() {
    wx.navigateTo({ url: `/pages/settle-rounds/settle-rounds?bookId=${this.data.id}` })
  },

  // 阻止弹窗面板点击冒泡到遮罩
  stopPropagation() {},

  // book-menu 组件抛出的操作事件
  onBookAction(e) {
    const detail = e.detail
    handleBookAction(detail, (result) => {
      if (result && result.removed) {
        // 删除 / 退出：直接返回上一页
        setTimeout(() => wx.navigateBack(), 300)
      } else {
        this.loadAll()
      }
    })
  },

  // 转发给微信好友：邀请一起记账
  onShareAppMessage() {
    const book = this.data.book || {}
    const code = book.inviteCode || ''
    // 优先自定义封面；否则按场景取分享专属图；再兜底 custom
    const imageUrl = this.data.coverUrl || shareImageForScene(book.scene)
    return {
      title: `邀请你加入「${book.name || '账本'}」一起记账`,
      path: `/pages/join/join?code=${code}`,
      imageUrl,
    }
  },

  // 长按成员头像：移除成员（仅owner可操作）
  onLongPressMember(e) {
    const { userid } = e.detail
    if (!userid) return
    if (!this.data.isOwner) {
      wx.showToast({ title: '仅创建者可移除成员', icon: 'none' })
      return
    }
    if (userid === this.data.myUserId) {
      wx.showToast({ title: '不能移除自己', icon: 'none' })
      return
    }

    const member = this.data.members.find((m) => m.userId === userid)
    if (!member) return

    wx.showActionSheet({
      itemList: ['查看信息', '移除成员'],
      itemColor: '#2f4159',
      success: (res) => {
        if (res.tapIndex === 1) {
          this.confirmRemoveMember(member)
        } else if (res.tapIndex === 0) {
          wx.showToast({ title: '功能开发中', icon: 'none' })
        }
      },
    })
  },

  // 确认移除成员
  confirmRemoveMember(member) {
    wx.showModal({
      title: '移除成员',
      content: `确定将「${member.nickname}」移出账本吗？该成员的账单记录将保留。`,
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.removeMember(this.data.id, member.userId)
          wx.showToast({ title: '已移除', icon: 'success' })
          setTimeout(() => this.loadAll(), 600)
        } catch (e) {
          wx.showToast({
            title: (e && e.message) || '操作失败',
            icon: 'none',
          })
        }
      },
    })
  },
})
