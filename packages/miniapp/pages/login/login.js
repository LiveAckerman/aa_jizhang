const app = getApp()
const { request } = require('../../utils/request')

Page({
  data: {
    logining: false,
    agreed: false, // 修改为默认不同意，用户需主动勾选
    redirect: '',  // 登录成功后的目标页（扫码/分享等场景），普通场景留空则返回上一页
  },

  onLoad(query) {
    // 登录成功后的目标页（由 requireLogin 传入，可选）
    if (query && query.redirect) {
      this.setData({ redirect: decodeURIComponent(query.redirect) })
    }
    // 已登录：不应再停留在登录页
    if (app.isLoggedIn()) {
      // 能返回则返回（游客浏览时触发登录、登录后回原页），否则回首页
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack()
      } else {
        wx.reLaunch({ url: '/pages/books/books' })
      }
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
        title: '请先阅读并同意用户协议和隐私政策',
        icon: 'none',
        duration: 2000
      })
      return
    }

    this.setData({ logining: true })

    try {
      // 1. 获取微信登录凭证
      const loginRes = await wx.login()
      if (!loginRes.code) {
        throw new Error('获取登录凭证失败，请重试')
      }

      // 2. 调用后端登录接口
      const res = await request({
        url: '/auth/wechat/login',
        method: 'POST',
        data: { code: loginRes.code }
      })

      if (!res || !res.token) {
        throw new Error('登录失败，请重试')
      }

      // 3. 保存登录信息
      const { token, user, needProfilePrompt } = res

      app.setLoginState(token, user)
      // 是否需要在首页弹授权抽屉（只弹一次，由后端标记决定）
      app.globalData.needProfilePrompt = !!needProfilePrompt

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })

      // 4. 登录成功后的跳转
      const pendingCode = wx.getStorageSync('pendingInviteCode')
      const redirect = this.data.redirect
      const pages = getCurrentPages()
      const canGoBack = pages.length > 1
      setTimeout(() => {
        if (pendingCode) {
          // 扫码/分享进入但未登录：登录后直达加入页
          wx.removeStorageSync('pendingInviteCode')
          // 先 reLaunch 到 tabbar 首页作为栈底，再 navigateTo 到加入页，
          // 这样加入页左上角 home 图标能正确回到首页，而不是回登录页
          wx.reLaunch({
            url: '/pages/books/books',
            complete: () => {
              wx.navigateTo({ url: `/pages/join/join?code=${pendingCode}` })
            },
          })
        } else if (redirect) {
          // 指定了目标页（如需要账号的动作携带 redirect）
          wx.reLaunch({ url: redirect })
        } else if (canGoBack) {
          // 游客浏览中触发登录：返回触发登录的原页面（其 onShow 会重新拉取数据）
          wx.navigateBack()
        } else {
          // 登录页作为栈底（冷启动直达登录页等）：回首页
          wx.reLaunch({ url: '/pages/books/books' })
        }
      }, 800)

    } catch (err) {
      console.error('登录失败:', err)
      const errorMsg = err.message || err.errMsg || '登录失败，请检查网络后重试'
      wx.showModal({
        title: '登录失败',
        content: errorMsg,
        showCancel: false,
        confirmText: '知道了'
      })
    } finally {
      this.setData({ logining: false })
    }
  },
})
