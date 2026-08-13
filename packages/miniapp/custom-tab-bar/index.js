Component({
  data: {
    selected: 0,
    // tab 列表：图标用组件内 SVG 渲染，这里只存 key 和文字、路径
    list: [
      { key: 'book', text: '账本', pagePath: '/pages/books/books' },
      { key: 'chart', text: '统计', pagePath: '/pages/statistics/statistics' },
      { key: 'user', text: '我的', pagePath: '/pages/profile/profile' },
    ],
  },

  lifetimes: {
    attached() {
      // 组件挂载时根据当前页面路径同步选中态
      this.syncSelected()
    },
  },

  methods: {
    /** 根据当前页面路径设置 selected */
    syncSelected() {
      const pages = getCurrentPages()
      const current = pages[pages.length - 1]
      if (!current) return
      const route = `/${current.route}`
      const idx = this.data.list.findIndex((item) => item.pagePath === route)
      if (idx !== -1 && idx !== this.data.selected) {
        this.setData({ selected: idx })
      }
    },

    /** 点击某个 tab */
    onTap(e) {
      const index = e.currentTarget.dataset.index
      const target = this.data.list[index]
      if (index === this.data.selected) return

      // 先切换页面（switchTab 无动画，但 pill 动画在组件内做）
      wx.switchTab({ url: target.pagePath })
      // 立即更新选中态，触发 pill 滑动动画
      this.setData({ selected: index })
    },
  },
})
