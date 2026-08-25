/**
 * 一起分账吧 - 小程序入口
 */
const { API_BASE_URL } = require('./config/index')

App({
  globalData: {
    /** 后端接口基础地址 */
    apiBaseUrl: API_BASE_URL,
    /** 当前登录用户信息 */
    user: null,
    /** 登录 token */
    token: '',
    /** tabBar 当前选中项（全局唯一数据源，跨实例共享） */
    tabSelected: 0,
    /** tabBar 上一个选中项（用于跨页面 pill 滑动动画的起点） */
    tabPrevSelected: 0,
    /** 是否需要弹出头像昵称授权抽屉（登录接口返回，只弹一次） */
    needProfilePrompt: false,
  },

  onLaunch() {
    // 读取本地缓存的登录态
    const token = wx.getStorageSync('token')
    const user = wx.getStorageSync('user')
    if (token) {
      this.globalData.token = token
      this.globalData.user = user || null
      // 冷启动时若用户资料未完善，允许首页再次弹出授权抽屉（用户可关闭不强制）
      // 后端会根据 hasPromptedProfile 决定是否真的需要弹（弹过一次后 dismiss 接口标记为 true）
      if (user && !user.isProfileComplete) {
        this.globalData.needProfilePrompt = true
      }
    }
  },

  /** 是否已登录 */
  isLoggedIn() {
    return !!this.globalData.token
  },

  /** 保存登录态 */
  setLoginState(token, user) {
    this.globalData.token = token
    this.globalData.user = user
    wx.setStorageSync('token', token)
    wx.setStorageSync('user', user)
  },

  /** 清除登录态 */
  clearLoginState() {
    this.globalData.token = ''
    this.globalData.user = null
    wx.removeStorageSync('token')
    wx.removeStorageSync('user')
  },

  /**
   * 全局分享配置：分享给朋友
   * 所有页面右上角「转发」按钮自动启用
   */
  onShareAppMessage() {
    // 随机选择一张分享封面(准备 3 张 webp 图放到 assets/ 目录)
    const covers = [
      '/assets/share-1.webp',
      '/assets/share-2.webp',
      '/assets/share-3.webp',
    ]
    const randomCover = covers[Math.floor(Math.random() * covers.length)]

    return {
      title: '一起分账吧 - 轻松记账，公平分账',
      path: '/pages/books/books',
      imageUrl: randomCover,
    }
  },

  /**
   * 全局分享配置：分享到朋友圈
   * 所有页面右上角「分享到朋友圈」按钮自动启用
   */
  onShareTimeline() {
    const covers = [
      '/assets/share-1.webp',
      '/assets/share-2.webp',
      '/assets/share-3.webp',
    ]
    const randomCover = covers[Math.floor(Math.random() * covers.length)]

    return {
      title: '一起分账吧 - 轻松记账，公平分账',
      imageUrl: randomCover,
    }
  },
})
