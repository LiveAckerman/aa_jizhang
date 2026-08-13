const app = getApp()
const request = require('../../utils/request')

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
      const { token, user, isNewUser } = res

      wx.setStorageSync('token', token)
      app.setUser(user)

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })

      // 4. 判断是否需要完善信息
      setTimeout(() => {
        if (isNewUser) {
          // 首次登录，跳转到完善信息页
          wx.redirectTo({
            url: '/pages/profile-setup/index'
          })
        } else {
          // 老用户，直接进入账本页
          wx.reLaunch({
            url: '/pages/books/books'
          })
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
