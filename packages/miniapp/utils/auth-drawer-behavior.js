/**
 * 头像昵称授权抽屉 —— 公共 Behavior
 *
 * 背景：登录后需引导新用户完善头像昵称，只弹一次。
 * 过去只把这套逻辑写在 books / join 两个页面里，但登录成功后
 * navigateBack 回到的是「触发登录的原页」（可能是统计 / 我的），
 * 那些页面没有抽屉逻辑，导致新用户压根不弹。
 *
 * 现改为公共 Behavior，所有可能成为「登录回跳落点」的页面
 * （books / statistics / profile / join）统一引入，onShow / 数据就绪后
 * 调 this.maybeShowAuthDrawer() 即可。
 *
 * 「只弹一次」由会话级门闩 app.globalData.needProfilePrompt 控制：
 *  - 登录接口按 !hasPromptedProfile 返回，login.js 写入该门闩；
 *  - 冷启动时 app.js 按 !isProfileComplete 兜底置位；
 *  - 弹过一次即置 false，并调 dismiss 接口让后端置 isProfileComplete=true。
 * 这样切 tab / 反复 onShow 都不会重弹（不依赖本地改 user 资料状态）。
 */
const { request } = require('./request')

module.exports = Behavior({
  data: {
    showAuthDrawer: false,
    userAvatar: '',
    userNickname: '',
  },

  methods: {
    // 登录后弹一次头像昵称授权抽屉（门闩 + 未完善资料双重判断）
    maybeShowAuthDrawer() {
      const app = getApp()
      if (!app.isLoggedIn()) return
      // join 流程期间延迟弹出：不弹、不消费门闩，待离开加入流程后进一级页面再弹
      if (app.globalData.deferAuthDrawer) return
      const user = app.globalData.user || {}
      if (!app.globalData.needProfilePrompt || user.isProfileComplete) return

      this.setData({
        showAuthDrawer: true,
        userAvatar: user.avatar || '',
        userNickname: user.nickname || '',
      })
      // 关掉会话门闩：本次会话内不再重弹（切 tab / 再次 onShow 均不触发）
      app.globalData.needProfilePrompt = false
      this._toggleTabBar(true)
      // 立即标记「已弹过」，后端置 isProfileComplete=true，同时更新本地缓存防止刷新后重弹
      request({ url: '/user/profile-prompt/dismiss', method: 'POST' })
        .then(() => {
          // dismiss 成功：更新本地 user.isProfileComplete=true，写入 storage
          const updatedUser = { ...app.globalData.user, isProfileComplete: true }
          app.setLoginState(app.globalData.token, updatedUser)
        })
        .catch(() => {})
    },

    async onAuthorized(e) {
      const app = getApp()
      const { avatar, nickname } = e.detail
      wx.showLoading({ title: '保存中...', mask: true })
      try {
        // request 已解包后端统一响应，直接返回完整 client user
        const updatedUser = await request({
          url: '/user/profile',
          method: 'PUT',
          data: { avatar, nickname },
        })
        // 用后端返回的完整 user 覆盖，确保各字段一致
        app.setLoginState(app.globalData.token, updatedUser)
        wx.hideLoading()
        wx.showToast({ title: '已保存', icon: 'success' })
      } catch (err) {
        wx.hideLoading()
        wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
        return // 保存失败不关抽屉，让用户重试
      }
      this.setData({ showAuthDrawer: false })
      this._toggleTabBar(false)
    },

    onAuthClose() {
      this.setData({ showAuthDrawer: false })
      this._toggleTabBar(false)
    },

    // tab 页在抽屉打开时隐藏自定义 tabBar，避免层级遮挡；
    // 非 tab 页（如 join）getTabBar 取不到实例，自动跳过。
    _toggleTabBar(hide) {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({ hide })
      }
    },
  },
})
