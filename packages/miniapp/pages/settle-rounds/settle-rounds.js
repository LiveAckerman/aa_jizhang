const api = require('../../utils/api')

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const h = pad(d.getHours())
  const min = pad(d.getMinutes())
  return `${y}-${m}-${day} ${h}:${min}`
}

Page({
  data: {
    bookId: '',
    rounds: [],
    loading: true,
  },

  onLoad(query) {
    this.setData({ bookId: query.bookId || '' })
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh())
  },

  async loadData() {
    if (this.data.rounds.length === 0) this.setData({ loading: true })
    try {
      const list = await api.listSettlementRounds(this.data.bookId)
      const rounds = (list || []).map((r) => ({
        ...r,
        typeText: r.type === 'all' ? '全部结算' : '部分结算',
        statusText: r.status === 'completed' ? '已完成' : '进行中',
        isCompleted: r.status === 'completed',
        amountText: (r.totalAmount / 100).toFixed(2),
        timeText: formatTime(r.createdAt),
      }))
      this.setData({ rounds, loading: false })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
    }
  },

  onTapRound(e) {
    const roundId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/settle-detail/settle-detail?bookId=' + this.data.bookId + '&roundId=' + roundId,
    })
  },

  // 删除轮次（仅进行中可删）：释放本轮账单，可重新参与结算
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
          this.loadData()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
        }
      },
    })
  },
})
