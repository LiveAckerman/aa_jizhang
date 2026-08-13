const app = getApp()

Page({
  data: {
    books: [],
    loading: true,
  },

  onShow() {
    // 未登录则跳转登录页
    if (!app.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    // 同步自定义 tabBar 选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.loadBooks()
  },

  onPullDownRefresh() {
    this.loadBooks().finally(() => wx.stopPullDownRefresh())
  },

  async loadBooks() {
    // TODO: 接入后端账本列表接口
    this.setData({ loading: false, books: [] })
  },
})
