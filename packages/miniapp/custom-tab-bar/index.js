const app = getApp()
const { requireLogin } = require('../utils/auth')

Component({
  data: {
    selected: 0, // 当前高亮项（图标/文字变色）
    pillIndex: 0, // pill 当前位置（用于动画）
    noAnim: false, // 是否禁用 pill 过渡
    hide: false, // 是否隐藏整个 tabBar（用于抽屉等全屏遮罩场景）
    list: [
      { key: 'book', text: '账本', pagePath: '/pages/books/books' },
      { key: 'chart', text: '统计', pagePath: '/pages/statistics/statistics' },
      { key: 'user', text: '我的', pagePath: '/pages/profile/index' },
    ],
  },

  methods: {
    /**
     * 由各 tab 页 onShow 调用：把 pill 定位到目标项。
     * 关键：先无动画瞬移到「上一个位置」，再下一帧带动画滑到「当前位置」，
     * 这样即使是新的组件实例，也能演出正确方向的滑动（解决多实例起点错乱）。
     */
    setActive(index) {
      const prev = app.globalData.tabPrevSelected
      const cur = index

      // 高亮项立即生效
      this.setData({ selected: cur })

      if (prev === cur) {
        // 没有位移，直接定位
        this.setData({ noAnim: false, pillIndex: cur })
        return
      }

      // 第一步：禁用动画，把 pill 瞬移到起点（上一个 tab）
      this.setData({ noAnim: true, pillIndex: prev }, () => {
        // 第二步：下一帧启用动画，滑到当前 tab
        setTimeout(() => {
          this.setData({ noAnim: false, pillIndex: cur })
        }, 20)
      })
    },

    /** 快速记账：选录入方式 → 跳账本选择中转页（需登录） */
    onFab() {
      if (!requireLogin()) return
      wx.showActionSheet({
        itemList: ['手动录入', '票据自动识别'],
        success: (res) => {
          const mode = res.tapIndex === 0 ? 'manual' : 'ocr'
          wx.navigateTo({ url: `/pages/quick-add/quick-add?mode=${mode}` })
        },
      })
    },

    /** 点击某个 tab */
    onTap(e) {
      const index = e.currentTarget.dataset.index
      if (index === this.data.selected) return

      const target = this.data.list[index]
      // 记录切换前后的位置到全局
      app.globalData.tabPrevSelected = this.data.selected
      app.globalData.tabSelected = index

      wx.switchTab({ url: target.pagePath })
    },
  },
})
