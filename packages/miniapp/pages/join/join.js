const app = getApp()
const api = require('../../utils/api')
const { SCENE_MAP } = require('../../constants/ledger')
const authDrawerBehavior = require('../../utils/auth-drawer-behavior')

Page({
  behaviors: [authDrawerBehavior],
  data: {
    code: '',
    info: null,
    coverUrl: '',
    loading: true,
    joining: false,
    error: '',
    // showAuthDrawer / userAvatar / userNickname 由 auth-drawer-behavior 提供
  },

  onLoad(query) {
    // 两种来源：
    // 1) 转发/手动：?code=XXXX
    // 2) 扫小程序码：?scene=c%3DXXXX（scene 需 decode）
    let code = query.code || ''
    if (!code && query.scene) {
      const scene = decodeURIComponent(query.scene)
      const m = scene.match(/c=([A-Za-z0-9]+)/)
      if (m) code = m[1]
    }
    code = (code || '').toUpperCase()
    this.setData({ code })

    if (!app.isLoggedIn()) {
      // 未登录：暂存邀请码，登录成功后自动回到加入页
      if (code) wx.setStorageSync('pendingInviteCode', code)
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    if (!code) {
      this.setData({ loading: false, error: '邀请码无效' })
      return
    }
    this.loadInfo()
  },

  async loadInfo() {
    try {
      const info = await api.inviteInfo(this.data.code)
      // 已经是该账本成员：无需再走加入流程，直接进账本
      if (info.isMember) {
        wx.redirectTo({ url: `/pages/book-detail/book-detail?id=${info.id}` })
        return
      }
      // scene(key) → 中文场景名，供卡片展示标签
      // 自定义场景优先显示后端存的自定义名，否则用预设场景名
      const sceneName =
        info.scene === 'custom'
          ? info.sceneName || ''
          : (SCENE_MAP[info.scene] && SCENE_MAP[info.scene].name) || ''
      this.setData({ info: { ...info, sceneName }, coverUrl: info.coverUrl, loading: false })
      // 新用户从登录页回跳：先弹头像/昵称授权，完善后再加入
      this.maybeShowAuthDrawer()
    } catch (e) {
      this.setData({ loading: false, error: (e && e.message) || '邀请码无效' })
    }
  },

  // maybeShowAuthDrawer / onAuthorized / onAuthClose 由 auth-drawer-behavior 提供

  async onJoin() {
    if (this.data.joining) return
    this.setData({ joining: true })
    wx.showLoading({ title: '加入中...', mask: true })
    try {
      const book = await api.joinBook(this.data.code)
      wx.hideLoading()
      wx.showToast({ title: '加入成功', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/book-detail/book-detail?id=${book.id}` })
      }, 600)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: (e && e.message) || '加入失败', icon: 'none' })
      this.setData({ joining: false })
    }
  },

  onCancel() {
    // switchTab 回到 tabBar 首页，避免 reLaunch 后左上角出现 home 图标
    wx.switchTab({ url: '/pages/books/books' })
  },
})
