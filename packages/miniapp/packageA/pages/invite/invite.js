const app = getApp()
const api = require('../../../utils/api')
const { shareImageForScene, SCENE_MAP } = require('../../../constants/ledger')

Page({
  data: {
    id: '',
    book: null,
    coverUrl: '',
    inviteCode: '',
    sceneName: '',
    memberCount: 0,
    qrUrl: '',
    qrLoading: true,
    loading: true,
  },

  onLoad(query) {
    this.setData({ id: query.id })
    this.loadBook()
  },

  async loadBook() {
    try {
      const book = await api.bookDetail(this.data.id)
      const sceneName =
        book.scene === 'custom'
          ? book.sceneName || ''
          : (SCENE_MAP[book.scene] && SCENE_MAP[book.scene].name) || ''
      this.setData({
        book,
        coverUrl: book.coverUrl,
        inviteCode: book.inviteCode,
        sceneName,
        memberCount: (book.members || []).length,
        loading: false,
      })
      this.loadQrCode()
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
    }
  },

  // 小程序码由后端生成，需要带 token，用 wx.request 拿二进制转本地文件
  loadQrCode() {
    const baseUrl = app.globalData.apiBaseUrl
    const token = app.globalData.token
    wx.request({
      url: `${baseUrl}/books/${this.data.id}/qrcode`,
      method: 'GET',
      responseType: 'arraybuffer',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode !== 200) {
          this.setData({ qrLoading: false })
          return
        }
        // 写入临时文件供 image 显示
        const fs = wx.getFileSystemManager()
        const filePath = `${wx.env.USER_DATA_PATH}/qr_${this.data.id}.png`
        try {
          fs.writeFileSync(filePath, res.data, 'binary')
          this.setData({ qrUrl: filePath, qrLoading: false })
        } catch (e) {
          this.setData({ qrLoading: false })
        }
      },
      fail: () => this.setData({ qrLoading: false }),
    })
  },

  onCopyCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' }),
    })
  },

  onShareAppMessage() {
    const book = this.data.book || {}
    const imageUrl = this.data.coverUrl || shareImageForScene(book.scene)
    return {
      title: `邀请你加入「${book.name || '账本'}」一起记账`,
      path: `/pages/join/join?code=${this.data.inviteCode}`,
      imageUrl,
    }
  },
})
