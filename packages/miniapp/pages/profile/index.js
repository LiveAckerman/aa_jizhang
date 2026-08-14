const app = getApp()
const { setTabBarSelected } = require('../../utils/tabbar')

Page({
  data: {
    user: null,
  },

  onShow() {
    wx.setNavigationBarTitle({ title: '我的' })
    // 同步自定义 tabBar 选中态（我的 = 2）
    setTabBarSelected(this, 2)
    this.loadUserInfo()
  },

  loadUserInfo() {
    this.setData({ user: app.globalData.user || {} })
  },

  // 进入二级页：个人资料编辑
  goEdit() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
  },

  goToAbout() {
    wx.navigateTo({ url: '/pages/document/document?type=about' })
  },

  goToVersion() {
    wx.showToast({ title: '当前版本 v1.0.0', icon: 'none' })
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearLoginState()
          wx.reLaunch({ url: '/pages/login/login' })
        }
      },
    })
  },
})
