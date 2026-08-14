Component({
  options: {
    multipleSlots: true, // 启用多 slot（左、中、右）
  },

  properties: {
    // 标题
    title: {
      type: String,
      value: '',
    },
    // 是否显示返回按钮
    showBack: {
      type: Boolean,
      value: true,
    },
    // 背景色（默认透明，可传 #ffffff 等）
    background: {
      type: String,
      value: 'transparent',
    },
    // 标题颜色
    color: {
      type: String,
      value: '#2f4159',
    },
    // 返回时的兜底行为：无历史栈时跳转的页面（tabBar 页需用 switchTab）
    fallbackUrl: {
      type: String,
      value: '',
    },
    // 是否固定在顶部（fixed）
    fixed: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    statusBarHeight: 0, // 状态栏高度
    navBarHeight: 44, // 导航栏内容高度
    totalHeight: 44, // 总高度 = 状态栏 + 导航栏
  },

  lifetimes: {
    attached() {
      this.initLayout()
    },
  },

  methods: {
    // 计算状态栏 + 胶囊按钮布局
    initLayout() {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const statusBarHeight = windowInfo.statusBarHeight || 20

      let navBarHeight = 44
      try {
        // 胶囊按钮位置，用于精确对齐导航栏高度
        const menu = wx.getMenuButtonBoundingClientRect()
        if (menu && menu.height) {
          // 导航栏高度 = 胶囊上下间距对称 + 胶囊高度
          navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height
        }
      } catch (e) {
        navBarHeight = 44
      }

      this.setData({
        statusBarHeight,
        navBarHeight,
        totalHeight: statusBarHeight + navBarHeight,
      })

      // 通知外部导航栏总高度（页面可据此留白）
      this.triggerEvent('ready', { totalHeight: statusBarHeight + navBarHeight })
    },

    // 点击返回
    onBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack({ delta: 1 })
      } else if (this.data.fallbackUrl) {
        // tab 页需用 switchTab，否则 reLaunch 会失败
        const tabPages = this.getTabBarPages()
        const path = this.data.fallbackUrl.split('?')[0]
        if (tabPages.indexOf(path) !== -1) {
          wx.switchTab({ url: this.data.fallbackUrl })
        } else {
          wx.reLaunch({ url: this.data.fallbackUrl })
        }
      }
      this.triggerEvent('back')
    },

    // 读取 app.json tabBar 页面路径列表
    getTabBarPages() {
      try {
        const cfg = (typeof __wxConfig !== 'undefined' && __wxConfig.tabBar) || null
        if (cfg && cfg.list) {
          return cfg.list.map((i) => '/' + i.pagePath)
        }
      } catch (e) {}
      return []
    },
  },
})
