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

  onChooseAvatar() {
    if (this.data.uploading) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        this.uploadAvatar(filePath)
      },
    })
  },

  uploadAvatar(filePath) {
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
            this.updateProfile({ avatar: body.data.url })
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

  async updateProfile(data) {
    try {
      await request({ url: '/user/profile', method: 'PUT', data })
      const user = Object.assign({}, this.data.user, data)
      wx.setStorageSync('user', user)
      app.globalData.user = user
      this.setData({ user })
      wx.showToast({ title: '更新成功', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },
})
