const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    code: '',
    info: null,
    coverUrl: '',
    loading: true,
    joining: false,
    error: '',
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
      this.setData({ info, coverUrl: info.coverUrl, loading: false })
    } catch (e) {
      this.setData({ loading: false, error: (e && e.message) || '邀请码无效' })
    }
  },

  async onJoin() {
    if (this.data.joining) return
    this.setData({ joining: true })
    try {
      const book = await api.joinBook(this.data.code)
      wx.showToast({ title: '加入成功', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/book-detail/book-detail?id=${book.id}` })
      }, 600)
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '加入失败', icon: 'none' })
      this.setData({ joining: false })
    }
  },

  onCancel() {
    wx.reLaunch({ url: '/pages/books/books' })
  },
})
