const app = getApp()

Page({
  data: {
    user: null,
  },

  onShow() {
    if (!app.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.setData({ user: app.globalData.user })
  },

  // 修改昵称
  editNickname() {
    wx.navigateTo({
      url: `/pages/edit-nickname/index?nickname=${this.data.user.nickname}`
    })
  },

  // 上传头像
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

  // 上传头像到服务器
  uploadAvatar(filePath) {
    wx.showLoading({ title: '上传中...' })

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
          // 更新本地用户信息
          const user = app.globalData.user
          user.avatar = data.data.url

          wx.setStorageSync('user', user)
          app.globalData.user = user

          this.setData({ user })

          wx.hideLoading()
          wx.showToast({
            title: '更新成功',
            icon: 'success'
          })
        } else {
          wx.hideLoading()
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        })
      }
    })
  },

  // 更新日志
  goToChangelog() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmColor: '#fa9583',
      success: (res) => {
        if (res.confirm) {
          app.clearLoginState()
          wx.reLaunch({ url: '/pages/login/login' })
        }
      },
    })
  },
})
