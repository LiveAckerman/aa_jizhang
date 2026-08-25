const app = getApp()
const { setTabBarSelected } = require('../../utils/tabbar')
const { requireLogin } = require('../../utils/auth')
const authDrawerBehavior = require('../../utils/auth-drawer-behavior')
const { APP_VERSION } = require('../../config/index')

Page({
  behaviors: [authDrawerBehavior],
  data: {
    user: null,
    isGuest: false, // 未登录游客态：展示登录引导，隐藏账号相关操作
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '我的' })
    // 同步自定义 tabBar 选中态（我的 = 2）
    setTabBarSelected(this, 2)
    this.loadUserInfo()
    this.maybeShowAuthDrawer()
  },

  loadUserInfo() {
    // 微信审核要求：未登录也可进入「我的」页浏览，不强制跳转登录。
    if (!app.isLoggedIn()) {
      this.setData({ isGuest: true, user: {} })
      return
    }
    this.setData({ isGuest: false, user: app.globalData.user || {} })
  },

  // 游客态「去登录」按钮
  onGuestLogin() {
    requireLogin()
  },

  // 进入二级页：个人资料编辑
  goEdit() {
    if (!requireLogin()) return
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
  },

  goToAbout() {
    wx.navigateTo({ url: '/pages/document/document?type=about' })
  },

  goToVersion() {
    wx.showToast({ title: `当前版本 v${APP_VERSION}`, icon: 'none' })
  },

  // 微信客服会话回调（用户在会话内点击卡片消息等场景触发，此处仅留空占位）
  onContact(e) {
    // e.detail 含 path / query，可按需处理，暂无需额外逻辑
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearLoginState()
          // 退出后回到首页游客态（不再强制停留登录页）
          wx.reLaunch({ url: '/pages/books/books' })
        }
      },
    })
  },
})
