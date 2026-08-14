const app = getApp()

Component({
  properties: {
    show: { type: Boolean, value: false },
    defaultAvatar: { type: String, value: '' },
    defaultNickname: { type: String, value: '' },
  },

  data: {
    avatar: '',
    nickname: '',
  },

  observers: {
    'defaultAvatar, defaultNickname': function (av, nn) {
      this.setData({ avatar: av || '', nickname: nn || '' })
    },
  },

  methods: {
    onChooseAvatar(e) {
      const path = e.detail.avatarUrl
      if (!path) return
      // 上传到后端
      const baseUrl = app.globalData.apiBaseUrl
      const token = app.globalData.token
      wx.uploadFile({
        url: `${baseUrl}/upload/avatar`,
        filePath: path,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success: (res) => {
          try {
            const body = JSON.parse(res.data)
            if (body.code === 0 && body.data && body.data.url) {
              this.setData({ avatar: body.data.url })
            }
          } catch (e) {}
        },
      })
    },

    onNicknameInput(e) {
      this.setData({ nickname: e.detail.value })
    },

    onConfirm() {
      this.triggerEvent('authorized', { avatar: this.data.avatar, nickname: this.data.nickname })
    },

    onClose() {
      this.triggerEvent('close')
    },

    stopPropagation() {},
  },
})
