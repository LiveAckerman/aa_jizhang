const app = getApp()
const { request } = require('../../utils/request')

Page({
  data: {
    nickname: '',
    originalNickname: ''
  },

  onLoad(options) {
    const nickname = options.nickname || ''
    this.setData({
      nickname,
      originalNickname: nickname
    })
  },

  onInput(e) {
    this.setData({
      nickname: e.detail.value
    })
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

    wx.showLoading({ title: '保存中...' })

    try {
      await request({
        url: '/user/profile',
        method: 'PUT',
        data: { nickname }
      })

      // 更新本地用户信息
      const user = app.globalData.user
      user.nickname = nickname

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
      wx.showToast({
        title: err.message || '保存失败',
        icon: 'none'
      })
    }
  }
})
