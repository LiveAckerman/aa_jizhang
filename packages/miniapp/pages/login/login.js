const app = getApp()
const { request } = require('../../utils/request')

Page({
  data: {
    logining: false,
    agreed: true, // 默认同意协议
  },

  onLoad() {
    // 检查是否已登录
    if (app.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/books/books' })
    }
  },

  // 切换协议同意状态
  toggleAgree() {
    this.setData({
      agreed: !this.data.agreed
    })
  },

  // 微信登录
  async handleWechatLogin() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      })
      return
    }

    this.setData({ logining: true })

    try {
      // 1. 获取微信登录凭证
      const { code } = await wx.login()

      // 2. 调用后端登录接口
      const res = await request({
        url: '/auth/wechat/login',
        method: 'POST',
        data: { code }
      })

      // 3. 保存登录信息
      const { token, user, needProfilePrompt } = res

      app.setLoginState(token, user)
      // 是否需要在首页弹授权抽屉（只弹一次，由后端标记决定）
      app.globalData.needProfilePrompt = !!needProfilePrompt

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })

      // 4. 若有待处理的邀请码（扫码/分享进入但未登录），登录后直达加入页
      const pendingCode = wx.getStorageSync('pendingInviteCode')
      setTimeout(() => {
        if (pendingCode) {
          wx.removeStorageSync('pendingInviteCode')
          // 先 reLaunch 到 tabbar 首页作为栈底，再 navigateTo 到加入页，
          // 这样加入页左上角 home 图标能正确回到首页，而不是回登录页
          wx.reLaunch({
            url: '/pages/books/books',
            complete: () => {
              wx.navigateTo({ url: `/pages/join/join?code=${pendingCode}` })
            },
          })
        } else {
          wx.reLaunch({ url: '/pages/books/books' })
        }
      }, 800)

    } catch (err) {
      console.error('登录失败:', err)
      wx.showToast({
        title: err.message || '登录失败',
        icon: 'none'
      })
    } finally {
      this.setData({ logining: false })
    }
  },
})
