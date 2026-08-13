const app = getApp()
const { request } = require('../../utils/request')

Page({
  data: {
    user: null,
    uploading: false
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
  },

  loadUserInfo() {
    const user = app.globalData.user
    this.setData({ user })
  },

  // 修改头像
  chooseAvatar() {
    if (this.data.uploading) return

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.uploadAvatar(tempFilePath)
      }
    })
  },

  // 上传头像
  uploadAvatar(filePath) {
    this.setData({ uploading: true })

    wx.uploadFile({
      url: app.globalData.apiBase + '/upload/avatar',
      filePath: filePath,
      name: 'file',
      header: {
        'Authorization': 'Bearer ' + app.globalData.token
      },
      success: (res) => {
        const data = JSON.parse(res.data)
        if (data.success) {
          this.updateProfile({ avatar: data.data.url })
        } else {
          wx.showToast({
            title: data.message || '上传失败',
            icon: 'none'
          })
        }
      },
      fail: () => {
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        })
      },
      complete: () => {
        this.setData({ uploading: false })
      }
    })
  },

  // 修改昵称
  editNickname() {
    wx.navigateTo({
      url: '/pages/edit-nickname/index?nickname=' + this.data.user.nickname
    })
  },

  // 更新个人信息
  async updateProfile(data) {
    try {
      await request({
        url: '/user/profile',
        method: 'PUT',
        data
      })

      // 更新本地信息
      const user = this.data.user
      Object.assign(user, data)

      wx.setStorageSync('user', user)
      app.globalData.user = user

      this.setData({ user })

      wx.showToast({
        title: '更新成功',
        icon: 'success'
      })
    } catch (err) {
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.clearLoginState()
          wx.reLaunch({
            url: '/pages/login/login'
          })
        }
      }
    })
  }
})
