const app = getApp()
const { setTabBarSelected } = require('../../utils/tabbar')
const api = require('../../utils/api')
const { handleBookAction } = require('../../utils/book-actions')
const { requireLogin } = require('../../utils/auth')
const authDrawerBehavior = require('../../utils/auth-drawer-behavior')

Page({
  behaviors: [authDrawerBehavior],
  data: {
    books: [],
    active: [],
    archived: [],         // 已结算账本（全量，交给 card-stack 组件展示）
    groups: [],           // 分组列表（首项固定为「全部」）
    activeGroupId: 'all', // 当前选中的分组 id：'all' / '' (默认) / <groupId>
    ownerFilter: 'all',   // 归属筛选：'all' / 'owned'(我创建的) / 'joined'(我加入的)
    keyword: '',          // 搜索关键词
    filteredEmpty: false, // 有数据但搜索结果为空（区别于"账本为零"的空状态）
    loading: true,
    isGuest: false,       // 未登录游客态：展示登录引导空状态，不强制跳转
    // showAuthDrawer / userAvatar / userNickname 由 auth-drawer-behavior 提供
  },

  onShow() {
    // 从 book-detail 返回时，导航栏标题仍是账本名，需重置为「账本」
    wx.setNavigationBarTitle({ title: '账本' })
    setTabBarSelected(this, 0)
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hide: false })
    }

    // 微信审核要求：未登录也可进入首页浏览，不强制跳转登录。
    // 游客态展示「登录后查看你的账本」空状态，点击需要账号的动作时再引导登录。
    if (!app.isLoggedIn()) {
      this.setData({ isGuest: true, loading: false, books: [], active: [], archived: [], groups: [] })
      return
    }

    this.setData({ isGuest: false })
    this.loadGroups()
    this.loadBooks()
    this.maybeShowAuthDrawer()
  },

  async loadGroups() {
    try {
      const groups = await api.listGroups()
      this.setData({ groups })
      // groups 可能晚于 books 到达；已有账本时重新过滤，确保分组筛选/计数生效
      if (this.data.books && this.data.books.length > 0) {
        this.applyFilter()
      }
    } catch (e) {}
  },

  onPickGroup(e) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.activeGroupId) return
    // 分组筛选纯前端，直接重新过滤即可
    this.setData({ activeGroupId: id })
    this.applyFilter()
  },

  // 长按分组标签：改名/删除（默认分组只允许「新建同级」）
  onLongPressGroup(e) {
    if (!requireLogin()) return
    const id = e.currentTarget.dataset.id
    if (id === 'all') return
    const group = this.data.groups.find((g) => g.id === id)
    if (!group) return
    const items = group.isDefault ? ['新建分组'] : ['重命名', '删除分组', '新建分组']
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const label = items[res.tapIndex]
        if (label === '重命名') this.renameGroup(group)
        else if (label === '删除分组') this.deleteGroup(group)
        else if (label === '新建分组') this.createGroup()
      },
    })
  },

  renameGroup(group) {
    wx.showModal({
      title: '重命名分组',
      editable: true,
      placeholderText: '分组名称',
      content: group.name,
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '保存中...', mask: true })
          await api.renameGroup(group.id, (res.content || '').trim())
          await this.loadGroups()
          wx.hideLoading()
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '操作失败', icon: 'none' })
        }
      },
    })
  },

  deleteGroup(group) {
    wx.showModal({
      title: '删除分组',
      content: `确定删除「${group.name}」？分组内的账本将回到「默认」分组。`,
      confirmColor: '#e64340',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '删除中...', mask: true })
          await api.deleteGroup(group.id)
          if (this.data.activeGroupId === group.id) {
            this.setData({ activeGroupId: 'all' })
          }
          await Promise.all([this.loadGroups(), this.loadBooks()])
          wx.hideLoading()
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '操作失败', icon: 'none' })
        }
      },
    })
  },

  createGroup() {
    wx.showModal({
      title: '新建分组',
      editable: true,
      placeholderText: '分组名称',
      success: async (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) return
        try {
          wx.showLoading({ title: '创建中...', mask: true })
          await api.createGroup(name)
          await this.loadGroups()
          wx.hideLoading()
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '操作失败', icon: 'none' })
        }
      },
    })
  },

  // maybeShowAuthDrawer / onAuthorized / onAuthClose 由 auth-drawer-behavior 提供

  onPullDownRefresh() {
    if (this.data.isGuest) {
      wx.stopPullDownRefresh()
      return
    }
    Promise.all([this.loadGroups(), this.loadBooks()]).finally(() =>
      wx.stopPullDownRefresh(),
    )
  },

  async loadBooks() {
    // 首次加载 / 上次为空 时展示骨架屏；已有数据时静默刷新，避免闪烁
    if (!this.data.books || this.data.books.length === 0) {
      this.setData({ loading: true })
    }
    try {
      // 恒拉全量：分组/归属/搜索三重筛选统一在前端做，保证列表与分组计数口径一致
      const books = await api.listBooks('')
      this.setData({ loading: false, books: books || [] })
      this.applyFilter()
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  // 根据当前 keyword + 归属筛选过滤 books，拆分 active/archived 并计算金额文案
  applyFilter() {
    const kw = (this.data.keyword || '').trim().toLowerCase()
    const myId = (app.globalData.user || {}).id || ''
    const owner = this.data.ownerFilter

    // 1. 归属筛选：我创建的 / 我加入的（分组计数以此为基准，与列表口径一致）
    let ownerScoped = this.data.books
    if (owner === 'owned') {
      ownerScoped = ownerScoped.filter((b) => b.ownerId === myId)
    } else if (owner === 'joined') {
      ownerScoped = ownerScoped.filter((b) => b.ownerId !== myId)
    }

    // 基于归属筛选结果重算各分组计数，写回 chip（默认分组：myGroupId 空或匹配默认 UUID）
    this.recalcGroupCounts(ownerScoped)

    // 2. 分组筛选
    let list = ownerScoped
    const gid = this.data.activeGroupId
    if (gid && gid !== 'all') {
      const defaultGroup = this.data.groups.find((g) => g.isDefault)
      const defaultId = defaultGroup ? defaultGroup.id : ''
      if (gid === 'default') {
        list = list.filter((b) => !b.myGroupId || b.myGroupId === defaultId)
      } else {
        list = list.filter((b) => b.myGroupId === gid)
      }
    }

    // 3. 关键词筛选
    if (kw) {
      list = list.filter((b) => (b.name || '').toLowerCase().includes(kw))
    }

    const active = []
    const archived = []
    list.forEach((b) => {
      const myPrivate = b.myPrivateAmount || 0
      const myShared = b.mySharedAmount || 0
      const item = {
        ...b,
        isOwner: b.ownerId === myId,
        hasCover: !!b.cover,
        dateText: this.formatDate(b.createdAt),
        hasPrivate: myPrivate > 0,
        myTotalText: ((myShared + myPrivate) / 100).toFixed(2),
        mySharedText: (myShared / 100).toFixed(2),
        myPrivateText: (myPrivate / 100).toFixed(2),
        bookTotalText: ((b.bookTotal || 0) / 100).toFixed(2),
        // 归一化 memberAvatars → members[{avatar}]，与 detail 保持字段一致，供 book-card 使用
        members: (b.memberAvatars || []).map((av) => ({ avatar: av })),
      }
      if (b.archived) archived.push(item)
      else active.push(item)
    })

    // 有账本但被搜索/归属/分组筛选过滤到空
    const hasFilter =
      kw.length > 0 || this.data.ownerFilter !== 'all' || this.data.activeGroupId !== 'all'
    const filteredEmpty = hasFilter && active.length === 0 && archived.length === 0
    this.setData({ active, archived, filteredEmpty })
  },

  // 基于归属筛选后的账本重算各分组计数，写回 groups 的 bookCount
  recalcGroupCounts(scopedBooks) {
    const defaultGroup = this.data.groups.find((g) => g.isDefault)
    const defaultId = defaultGroup ? defaultGroup.id : ''
    const groups = this.data.groups.map((g) => {
      let count
      if (g.isDefault) {
        count = scopedBooks.filter((b) => !b.myGroupId || b.myGroupId === defaultId).length
      } else {
        count = scopedBooks.filter((b) => b.myGroupId === g.id).length
      }
      return { ...g, bookCount: count }
    })
    this.setData({ groups })
  },

  // 切换归属筛选：全部 / 我创建的 / 我加入的
  onPickOwner(e) {
    const val = e.currentTarget.dataset.val
    if (val === this.data.ownerFilter) return
    this.setData({ ownerFilter: val })
    this.applyFilter()
  },

  // 搜索输入
  onSearch(e) {
    this.setData({ keyword: e.detail.value })
    this.applyFilter()
  },

  // 清空搜索
  onClearSearch() {
    this.setData({ keyword: '' })
    this.applyFilter()
  },

  formatDate(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    const p = (n) => (n < 10 ? '0' + n : '' + n)
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  },

  onTapCreate() {
    if (!requireLogin()) return
    wx.showActionSheet({
      itemList: ['创建账本', '加入账本', '新建分组'],
      success: (res) => {
        if (res.tapIndex === 0) wx.navigateTo({ url: '/packageA/pages/book-form/book-form' })
        else if (res.tapIndex === 1) this.promptJoin()
        else if (res.tapIndex === 2) this.createGroup()
      },
    })
  },

  // 游客态空状态里的「去登录」按钮
  onGuestLogin() {
    requireLogin()
  },

  promptJoin() {
    wx.showModal({
      title: '加入账本',
      editable: true,
      placeholderText: '请输入邀请码',
      success: async (res) => {
        if (!res.confirm) return
        const code = (res.content || '').trim().toUpperCase()
        if (!code) return
        wx.navigateTo({ url: `/packageA/pages/join/join?code=${code}` })
      },
    })
  },

  onTapBook(e) {
    if (!requireLogin()) return
    const { id } = e.detail
    // 兜底：只有拿到有效 id 才跳转，防止原生 tap 冒泡带来的空 detail 造成 ?id=undefined
    if (!id) return
    wx.navigateTo({ url: `/packageA/pages/book-detail/book-detail?id=${id}` })
  },

  // book-card 邀请+按钮：跳转到邀请页
  onInviteBook(e) {
    if (!requireLogin()) return
    const { id } = e.detail
    if (!id) return
    wx.navigateTo({ url: `/packageA/pages/invite/invite?id=${id}` })
  },

  // book-card 组件抛出的操作事件
  onBookAction(e) {
    handleBookAction(e.detail, () => {
      this.loadGroups()
      this.loadBooks()
    })
  },

  // 阻止列表项内 book-menu 点击冒泡到 onTapBook
  noop() {},

  // 分享到聊天
  onShareAppMessage() {
    return {
      title: '一起分账吧 - 多人记账小程序',
      path: '/pages/books/books',
      imageUrl: 'https://cdn.ljw44.com/assets/share/share-1.jpg',
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '一起分账吧 - 多人记账小程序',
      query: '',
      imageUrl: 'https://cdn.ljw44.com/assets/share/share-1.jpg',
    }
  },
})
