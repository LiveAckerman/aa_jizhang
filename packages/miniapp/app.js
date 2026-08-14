/**
 * 出发AA记账 - 小程序入口
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
})
