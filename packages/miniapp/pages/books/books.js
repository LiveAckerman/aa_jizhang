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
    groups: [],           // 分组列表（首项固定为「全部」）
    activeGroupId: 'all', // 当前选中的分组 id：'all' / '' (默认) / <groupId>
    loading: true,
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
    setTabBarSelected(this, 0)
    this.loadGroups()
    this.loadBooks()
    this.maybeShowAuthDrawer()
  },

  async loadGroups() {
    try {
      const groups = await api.listGroups()
      this.setData({ groups })
    } catch (e) {}
  },

  onPickGroup(e) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.activeGroupId) return
    // 切换分组时清空列表 + 显示骨架屏，避免旧数据闪烁
    this.setData({ activeGroupId: id, books: [], active: [], archived: [], loading: true })
    this.loadBooks()
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
          await api.renameGroup(group.id, (res.content || '').trim())
          this.loadGroups()
        } catch (e) {
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
      const groupId = this.data.activeGroupId === 'all' ? '' : this.data.activeGroupId
      const books = await api.listBooks(groupId)
      const active = []
      const archived = []
      const myId = (app.globalData.user || {}).id || ''
      ;(books || []).forEach((b) => {
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
      this.setData({ loading: false, books: books || [], active, archived })
    } catch (e) {
      this.setData({ loading: false })
    }
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
      this.loadGroups()
      this.loadBooks()
    })
  },
})
