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
