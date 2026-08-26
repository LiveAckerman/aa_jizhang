const app = getApp()
const { request } = require('../../utils/request')

Page({
  data: {
    nickname: '',
    originalNickname: '',
    hasUsedWechatNickname: false,
    // 本次输入是否来自微信昵称组件（type="nickname" 有内容即视为微信授权）
    fromWechat: false,
    saving: false,
  },

  onLoad(options) {
    const nickname = options.nickname || ''
    const user = app.globalData.user || {}
    this.setData({
      nickname,
      originalNickname: nickname,
      hasUsedWechatNickname: !!user.hasUsedWechatNickname,
    })
  },

  onInput(e) {
    // type="nickname" 的输入视为微信授权来源
    const fromWechat = !this.data.hasUsedWechatNickname
    this.setData({
      nickname: e.detail.value,
      fromWechat,
    })
  },

  // 微信昵称合规性检测回调
  onNicknameReview(e) {
    // e.detail.pass 为是否通过审核，这里仅标记来源为微信
    this.setData({ fromWechat: true })
  },

  onCancel() {
    wx.navigateBack()
  },

  async onSave() {
    const { nickname, originalNickname } = this.data

    // 校验
    if (!nickname.trim()) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none'
      })
      return
    }

    if (nickname === originalNickname) {
      wx.navigateBack()
      return
    }

    if (this.data.saving) return
    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...', mask: true })

    try {
      const url = this.data.fromWechat ? '/user/wechat-profile' : '/user/profile'
      const resData = await request({
        url,
        method: 'PUT',
        data: { nickname }
      })

      // 更新本地用户信息（以后端返回为准，含 hasUsedWechatNickname 标记）
      const user = Object.assign({}, app.globalData.user, { nickname }, resData || {})

      wx.setStorageSync('user', user)
      app.globalData.user = user

      wx.hideLoading()
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      wx.hideLoading()
      this.setData({ saving: false })
      wx.showToast({
        title: err.message || '保存失败',
        icon: 'none'
      })
    }
  }
})
