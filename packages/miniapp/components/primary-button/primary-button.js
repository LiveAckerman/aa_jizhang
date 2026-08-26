Component({
  options: {
    styleIsolation: 'apply-shared',
  },

  properties: {
    text: { type: String, value: '确定' },
    loading: { type: Boolean, value: false },
    loadingText: { type: String, value: '加载中...' },
    disabled: { type: Boolean, value: false },
    // primary（橙）/ secondary（蓝）/ outline（描边）
    type: { type: String, value: 'primary' },
    openType: { type: String, value: '' },
  },

  methods: {
    onTap(e) {
      if (this.data.disabled || this.data.loading) return
      this.triggerEvent('tap', e.detail)
    },
    onGetUserInfo(e) {
      this.triggerEvent('getuserinfo', e.detail)
    },
    onGetPhoneNumber(e) {
      this.triggerEvent('getphonenumber', e.detail)
    },
    onChooseAvatar(e) {
      this.triggerEvent('chooseavatar', e.detail)
    },
  },
})
