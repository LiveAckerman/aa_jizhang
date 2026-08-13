const app = getApp()
const { request } = require('../../utils/request')

Page({
  data: {
    avatar: '',
    nickname: '',
    uploading: false
  },

  onLoad() {
    // 获取默认信息
    const user = app.globalData.user
    this.setData({
      avatar: user.avatar,
      nickname: user.nickname
    })
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({
      nickname: e.detail.value
    })
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.uploadAvatar(tempFilePath)
      }
    })
  },

  // 上传头像
  uploadAvatar(filePath) {
    this.setData({ uploading: true })

    const token = app.globalData.token

    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}/upload/avatar`,
      filePath: filePath,
      name: 'file',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        const data = JSON.parse(res.data)
        if (data.code === 200) {
          this.setData({
            avatar: data.data.url,
            uploading: false
          })
          wx.showToast({
            title: '上传成功',
            icon: 'success'
          })
        } else {
          this.setData({ uploading: false })
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          })
        }
      },
      fail: () => {
        this.setData({ uploading: false })
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        })
      }
    })
  },

  // 跳过
  onSkip() {
    wx.switchTab({
      url: '/pages/books/books'
    })
  },

  // 完成
  async onComplete() {
    const { avatar, nickname } = this.data

    if (!nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      await request({
        url: '/user/profile',
        method: 'PUT',
        data: { avatar, nickname }
      })

      // 更新本地用户信息
      const user = app.globalData.user
      user.avatar = avatar
      user.nickname = nickname
      user.isProfileComplete = true

      wx.setStorageSync('user', user)
      app.globalData.user = user

      wx.hideLoading()
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })

      setTimeout(() => {
        wx.switchTab({
          url: '/pages/books/books'
        })
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
