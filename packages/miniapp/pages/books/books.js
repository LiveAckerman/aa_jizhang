const app = getApp()
const { setTabBarSelected } = require('../../utils/tabbar')
const { request } = require('../../utils/request')
const api = require('../../utils/api')
const { handleBookAction } = require('../../utils/book-actions')

Page({
  data: {
    books: [],
    active: [],
    archived: [],
    archivedStack: [],   // 最多5条，用于堆叠展示
    groups: [],           // 分组列表（首项固定为「全部」）
    activeGroupId: 'all', // 当前选中的分组 id：'all' / '' (默认) / <groupId>
    ownerFilter: 'all',   // 归属筛选：'all' / 'owned'(我创建的) / 'joined'(我加入的)
    keyword: '',          // 搜索关键词
    filteredEmpty: false, // 有数据但搜索结果为空（区别于"账本为零"的空状态）
    loading: true,
    showArchivedDrawer: false, // 已归档账本抽屉
    showAuthDrawer: false,
    userAvatar: '',
    userNickname: '',
  },

  onShow() {
    if (!app.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    // 从 book-detail 返回时，导航栏标题仍是账本名，需重置为「账本」
    wx.setNavigationBarTitle({ title: '账本' })
    // 从抽屉内点进账本详情再返回：抽屉已关，需恢复被隐藏的 tabbar
    if (this.data.showArchivedDrawer) {
      this.setData({ showArchivedDrawer: false })
    }
    setTabBarSelected(this, 0)
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hide: false })
    }
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
          await api.deleteGroup(group.id)
          if (this.data.activeGroupId === group.id) {
            this.setData({ activeGroupId: 'all' })
          }
          this.loadGroups()
          this.loadBooks()
        } catch (e) {
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
          await api.createGroup(name)
          this.loadGroups()
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '操作失败', icon: 'none' })
        }
      },
    })
  },

  maybeShowAuthDrawer() {
    const user = app.globalData.user || {}
    if (app.globalData.needProfilePrompt && !user.isProfileComplete) {
      this.setData({
        showAuthDrawer: true,
        userAvatar: user.avatar || '',
        userNickname: user.nickname || '',
      })
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ hide: true })
      }
      app.globalData.needProfilePrompt = false
      request({ url: '/user/profile-prompt/dismiss', method: 'POST' }).catch(() => {})
    }
  },

  async onAuthorized(e) {
    const { avatar, nickname } = e.detail
    wx.showLoading({ title: '保存中...', mask: true })
    try {
      await request({ url: '/user/profile', method: 'PUT', data: { avatar, nickname } })
      const user = Object.assign({}, app.globalData.user, { avatar, nickname, isProfileComplete: true })
      app.setLoginState(app.globalData.token, user)
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
      return
    }
    this.setData({ showAuthDrawer: false })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hide: false })
    }
  },

  onAuthClose() {
    this.setData({ showAuthDrawer: false })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hide: false })
    }
  },

  onPullDownRefresh() {
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
      }
      if (b.archived) archived.push(item)
      else active.push(item)
    })

    // 已归档堆叠：最新的5条，倒序排列（最新的在最上层）
    const archivedStack = archived.slice(0, 5)

    // 有账本但被搜索/归属/分组筛选过滤到空
    const hasFilter =
      kw.length > 0 || this.data.ownerFilter !== 'all' || this.data.activeGroupId !== 'all'
    const filteredEmpty = hasFilter && active.length === 0 && archived.length === 0
    this.setData({ active, archived, archivedStack, filteredEmpty })
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

  // 打开已归档抽屉（同时隐藏 tabbar，避免层级遮挡）
  onOpenArchivedDrawer() {
    this.setData({ showArchivedDrawer: true })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hide: true })
    }
  },

  // 关闭已归档抽屉（恢复 tabbar）
  onCloseArchivedDrawer() {
    this.setData({ showArchivedDrawer: false })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hide: false })
    }
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
    wx.showActionSheet({
      itemList: ['创建账本', '加入账本', '新建分组'],
      success: (res) => {
        if (res.tapIndex === 0) wx.navigateTo({ url: '/pages/book-form/book-form' })
        else if (res.tapIndex === 1) this.promptJoin()
        else if (res.tapIndex === 2) this.createGroup()
      },
    })
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
        wx.navigateTo({ url: `/pages/join/join?code=${code}` })
      },
    })
  },

  onTapBook(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/book-detail/book-detail?id=${id}` })
  },

  // book-menu 组件抛出的操作事件
  onBookAction(e) {
    handleBookAction(e.detail, () => {
      // 若在已归档抽屉内操作：先关抽屉并恢复 tabbar，避免刷新后抽屉悬空
      if (this.data.showArchivedDrawer) {
        this.onCloseArchivedDrawer()
      }
      this.loadGroups()
      this.loadBooks()
    })
  },

  // 阻止抽屉列表项内 book-menu 点击冒泡到 onTapBook
  noop() {},
})
