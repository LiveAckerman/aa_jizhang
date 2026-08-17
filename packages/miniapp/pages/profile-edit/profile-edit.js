const app = getApp()
const { request } = require('../../utils/request')

Page({
  data: {
    user: null,
    uploading: false,
  },

  onShow() {
    // 每次进来同步一次（从 edit-nickname 返回时会刷新昵称）
    this.setData({ user: app.globalData.user || {} })
  },

  onEditNickname() {
    wx.navigateTo({
      url: '/pages/edit-nickname/index?nickname=' + (this.data.user.nickname || ''),
    })
  },

  // 微信授权头像回调（open-type="chooseAvatar"）
  onChooseWechatAvatar(e) {
    if (this.data.uploading) return
    const avatarUrl = e.detail.avatarUrl
    if (!avatarUrl) return
    // 微信返回的是临时文件路径，需上传到自己的存储，并标记为微信授权
    this.uploadAvatar(avatarUrl, true)
  },

  onChooseAvatar() {
    if (this.data.uploading) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        this.uploadAvatar(filePath, false)
      },
    })
  },

  uploadAvatar(filePath, fromWechat) {
    this.setData({ uploading: true })
    wx.uploadFile({
      url: app.globalData.apiBaseUrl + '/upload/avatar',
      filePath,
      name: 'file',
      header: { Authorization: 'Bearer ' + app.globalData.token },
      success: (res) => {
        try {
          const body = JSON.parse(res.data)
          if (body.code === 0 && body.data && body.data.url) {
            this.updateProfile({ avatar: body.data.url }, fromWechat)
          } else {
            wx.showToast({ title: body.message || '上传失败', icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' })
        }
      },
      fail: () => wx.showToast({ title: '上传失败', icon: 'none' }),
      complete: () => this.setData({ uploading: false }),
    })
  },

  // fromWechat=true 走微信授权接口，会标记 hasUsedWechatAvatar
  async updateProfile(data, fromWechat) {
    try {
      const url = fromWechat ? '/user/wechat-profile' : '/user/profile'
      // request() 直接 resolve 后端的 data 字段
      const resData = await request({ url, method: 'PUT', data })
      // 以后端返回为准（含 hasUsedWechatAvatar/Nickname 等最新标记）
      const user = Object.assign({}, this.data.user, data, resData || {})
      wx.setStorageSync('user', user)
      app.globalData.user = user
      this.setData({ user })
      wx.showToast({ title: '更新成功', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },
})
