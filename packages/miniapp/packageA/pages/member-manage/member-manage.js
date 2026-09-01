const app = getApp()
const api = require('../../../utils/api')

Page({
  data: {
    bookId: '',
    myUserId: '',
    isOwner: false,
    members: [],
    loading: true,
  },

  onLoad(query) {
    const myUserId = (app.globalData.user || {}).id || ''
    this.setData({ bookId: query.id || '', myUserId })
    this.loadMembers()
  },

  onPullDownRefresh() {
    this.loadMembers().finally(() => wx.stopPullDownRefresh())
  },

  async loadMembers() {
    try {
      const book = await api.bookDetail(this.data.bookId)
      const ownerId = book.ownerId
      const myUserId = this.data.myUserId
      const members = (book.members || []).map((m) => ({
        ...m,
        isOwner: m.userId === ownerId,
        isMe: m.userId === myUserId,
      }))
      this.setData({
        members,
        isOwner: ownerId === myUserId,
        loading: false,
      })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
    }
  },

  onRemove(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '移除成员',
      content: `确定将「${name}」移出账本吗？该成员的账单记录将保留。`,
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '移除中...', mask: true })
        try {
          await api.removeMember(this.data.bookId, id)
          wx.hideLoading()
          wx.showToast({ title: '已移除', icon: 'success' })
          this.loadMembers()
        } catch (err) {
          wx.hideLoading()
          // 后端未结清校验等错误，用 modal 展示完整文案
          wx.showModal({
            title: '无法移除',
            content: (err && err.message) || '移除失败',
            showCancel: false,
            confirmText: '知道了',
          })
        }
      },
    })
  },
})
