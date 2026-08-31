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
    /** 延迟授权抽屉：join 加入流程期间为 true，此期间各页不弹抽屉、不消费门闩，
     * 由 join 页 onUnload 清除，避免抽屉在转场账本页闪现后被加入页盖掉、门闩被吞 */
    deferAuthDrawer: false,
    /** 批量 OCR 跨页传参：入口页处理完第 1 张后写入，ocr-batch-edit onLoad 读取后清空。
     * 用 globalData 而非 eventChannel，规避 redirectTo 不支持 eventChannel 的问题。
     * 结构：{ firstResult, firstSkip, remainingPaths, totalImages } */
    ocrBatchPayload: null,
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

  // 注：分享必须在 Page 上声明 onShareAppMessage / onShareTimeline，
  // App 级声明微信不识别。各页面自行实现。
})
