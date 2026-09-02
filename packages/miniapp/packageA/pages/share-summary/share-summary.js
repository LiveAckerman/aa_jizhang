const api = require('../../../utils/api')
const { CATEGORY_MAP, PAYMENT_MAP_FULL } = require('../../../constants/ledger')

Page({
  data: {
    tokenId: '',
    bookId: '',       // 从 book-detail 直接进入时使用
    isOwner: true,    // 从 book-detail 进入时为 true，分享链接进入为 false
    book: null,
    config: null,
    summary: null,
    groups: [],
    loading: true,     // 首次加载（整页骨架屏）
    groupsLoading: false, // 二次加载（仅列表区骨架屏）
    expired: false,
    saving: false,
    expandedMap: {},
    groupBy: 'person',
    includeUnsettled: false,
  },

  onLoad(query) {
    // 从 book-detail 直接进入：携带 bookId
    if (query.bookId) {
      this.setData({ bookId: query.bookId, isOwner: true })
      this.initWithBookId(query.bookId)
      wx.showShareMenu({ withShareTicket: false })
      return
    }

    // 从分享链接进入：携带 token 或 scene
    let tokenId = query.token || query.tokenId || ''
    if (query.scene) {
      const decoded = decodeURIComponent(query.scene)
      const match = decoded.match(/t=([^&]+)/)
      if (match) tokenId = match[1]
    }

    if (!tokenId) {
      wx.showToast({ title: '分享链接无效', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    this.setData({ tokenId, isOwner: false })
    this.loadData()
  },

  onShareAppMessage() {
    const { book, tokenId } = this.data
    if (!book || !tokenId) {
      return { title: '查看账本总结', path: '/pages/books/books' }
    }
    return {
      title: `${book.name} - 账本总结`,
      path: `/packageA/pages/share-summary/share-summary?token=${tokenId}`,
      imageUrl: 'https://cdn.ljw44.com/images/share-summary.jpg',
    }
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh())
  },

  // 从 bookId 进入：先创建 token，再加载数据
  async initWithBookId(bookId) {
    this.setData({ loading: true })
    try {
      const res = await api.createShareToken(bookId, {
        groupBy: this.data.groupBy,
        includeUnsettled: this.data.includeUnsettled,
      })
      this.setData({ tokenId: res.tokenId })
      await this.loadData()
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
    }
  },

  async loadData() {
    // 首次加载（无数据）用全页骨架；之后切换维度只 loading 列表区
    if (!this.data.book) {
      this.setData({ loading: true })
    } else {
      this.setData({ groupsLoading: true })
    }

    try {
      const res = await api.getShareSummary(this.data.tokenId, {
        groupBy: this.data.groupBy,
        includeUnsettled: this.data.includeUnsettled,
      })
      const { book, config, summary, groups, expiresAt } = res

      if (new Date().getTime() > new Date(expiresAt).getTime()) {
        this.setData({ expired: true, loading: false, groupsLoading: false })
        return
      }

      const decorated = this.decorateGroups(groups, config.groupBy)
      wx.setNavigationBarTitle({ title: `${book.name} · 账本总结` })

      this.setData({
        book,
        config,
        summary,
        groups: decorated,
        groupBy: config.groupBy,
        includeUnsettled: config.includeUnsettled,
        loading: false,
        groupsLoading: false,
        expired: false,
        expandedMap: {},
      })
    } catch (e) {
      this.setData({ loading: false, groupsLoading: false })
      const msg = (e && e.message) || '加载失败'
      if (msg.includes('过期') || msg.includes('expired')) {
        this.setData({ expired: true })
      } else {
        wx.showToast({ title: msg, icon: 'none' })
      }
    }
  },

  // 切换统计维度
  onSwitchGroupBy(e) {
    const groupBy = e.currentTarget.dataset.key
    if (groupBy === this.data.groupBy) return
    this.setData({ groupBy })
    this.loadData()
  },

  // 切换是否包含未结算
  onToggleUnsettled(e) {
    const includeUnsettled = !!e.detail.value
    this.setData({ includeUnsettled })
    this.loadData()
  },

  // 装饰分组数据，添加展示字段
  decorateGroups(groups, groupBy) {
    if (groupBy === 'person') {
      return groups.map((g) => ({
        ...g,
        key: g.key || g.userId, // 确保有 key 字段
        label: g.nickname || '未知成员',
        sublabel: `共 ${g.count} 笔`,
      }))
    } else if (groupBy === 'category') {
      return groups.map((g) => {
        const cat = CATEGORY_MAP[g.category] || CATEGORY_MAP.other
        return {
          ...g,
          key: g.key || g.category, // 确保有 key 字段
          label: cat.name,
          icon: cat.icon,
          svgIcon: cat.svgIcon || '',
          sublabel: `共 ${g.count} 笔`,
        }
      })
    } else if (groupBy === 'paymentMethod') {
      return groups.map((g) => {
        const pay = PAYMENT_MAP_FULL[g.paymentMethod] || { name: '未知', icon: 'paid' }
        return {
          ...g,
          key: g.key || g.paymentMethod, // 确保有 key 字段
          label: pay.name,
          icon: pay.icon,
          sublabel: `共 ${g.count} 笔`,
        }
      })
    }
    return groups
  },

  // 切换分组展开/收起
  toggleGroup(e) {
    const { key } = e.currentTarget.dataset
    const expandedMap = { ...this.data.expandedMap }
    expandedMap[key] = !expandedMap[key]
    this.setData({ expandedMap })
  },

  // 保存图片到相册
  onSaveImage() {
    if (this.data.saving) return
    this.setData({ saving: true })

    try {
      // 延迟绘制，确保数据已加载
      setTimeout(() => {
        this.renderToCanvas()
      }, 100)
    } catch (e) {
      console.error('保存图片失败', e)
      wx.showToast({ title: '生成失败', icon: 'none' })
      this.setData({ saving: false })
    }
  },

  // 使用 Canvas 2D 渲染小票样式图片
  renderToCanvas() {
    const query = wx.createSelectorQuery()
    query
      .select('#summaryCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) {
          wx.showToast({ title: '初始化失败', icon: 'none' })
          this.setData({ saving: false })
          return
        }

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio

        // Canvas 宽度 750rpx（逻辑像素），高度动态计算
        const width = 375 // 物理像素
        const itemHeight = 60 // 每项高度
        const baseHeight = 300 + this.data.groups.length * itemHeight

        canvas.width = width * dpr
        canvas.height = baseHeight * dpr
        ctx.scale(dpr, dpr)

        // 绘制内容
        this.drawTicket(ctx, width, baseHeight)

        // 导出图片
        wx.canvasToTempFilePath({
          canvas,
          success: (res) => {
            this.saveToAlbum(res.tempFilePath)
          },
          fail: () => {
            wx.showToast({ title: '生成失败', icon: 'none' })
            this.setData({ saving: false })
          },
        })
      })
  },

  // 绘制小票内容
  drawTicket(ctx, width, height) {
    const { book, summary, groups, config } = this.data

    // 背景色
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    let y = 40

    // 标题
    ctx.fillStyle = '#1a1a1a'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('账单总结', width / 2, y)
    y += 40

    // 账本名称
    ctx.font = '18px sans-serif'
    ctx.fillStyle = '#4097a9'
    ctx.fillText(book.name || '账本', width / 2, y)
    y += 30

    // 分隔线
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, y)
    ctx.lineTo(width - 20, y)
    ctx.stroke()
    y += 30

    // 总金额
    ctx.fillStyle = '#1a1a1a'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('总计金额', 40, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fa9583'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText(`¥${summary.totalAmountText}`, width - 40, y)
    y += 30

    // 账单笔数
    ctx.textAlign = 'left'
    ctx.fillStyle = '#1a1a1a'
    ctx.font = '16px sans-serif'
    ctx.fillText('账单笔数', 40, y)
    ctx.textAlign = 'right'
    ctx.fillText(`${summary.txCount} 笔`, width - 40, y)
    y += 30

    // 统计维度
    ctx.textAlign = 'left'
    ctx.fillText('统计维度', 40, y)
    ctx.textAlign = 'right'
    const modeText = config.groupBy === 'person' ? '按人员' : config.groupBy === 'category' ? '按分类' : '按支付方式'
    ctx.fillText(modeText, width - 40, y)
    y += 30

    // 分隔线
    ctx.beginPath()
    ctx.moveTo(20, y)
    ctx.lineTo(width - 20, y)
    ctx.stroke()
    y += 30

    // 明细标题
    ctx.fillStyle = '#5c6b7a'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('明细统计', 40, y)
    y += 30

    // 绘制每一项
    groups.forEach((group, index) => {
      ctx.fillStyle = '#1a1a1a'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'left'

      // 限制标签长度，避免溢出
      const label = group.label.length > 10 ? group.label.substring(0, 10) + '...' : group.label
      ctx.fillText(label, 40, y)

      ctx.textAlign = 'right'
      ctx.fillStyle = '#4097a9'
      ctx.font = 'bold 18px sans-serif'
      ctx.fillText(`¥${group.totalAmountText}`, width - 40, y)

      y += 25

      // 副标签（笔数）
      ctx.fillStyle = '#8091a5'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(group.sublabel, 40, y)

      y += 35

      // 分隔线（最后一项不画）
      if (index < groups.length - 1) {
        ctx.strokeStyle = '#f5f5f5'
        ctx.beginPath()
        ctx.moveTo(40, y - 10)
        ctx.lineTo(width - 40, y - 10)
        ctx.stroke()
      }
    })

    y += 20

    // 底部水印
    ctx.fillStyle = '#c4c4c4'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('一起分账吧 · 多人记账 简单明了', width / 2, y)
    y += 20

    // 日期
    const now = new Date()
    const dateText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    ctx.fillText(dateText, width / 2, y)
  },

  // 保存到相册
  saveToAlbum(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        wx.showToast({ title: '已保存到相册', icon: 'success' })
        this.setData({ saving: false })
      },
      fail: (err) => {
        console.error('保存失败', err)
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许访问相册',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting()
              }
            },
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
        this.setData({ saving: false })
      },
    })
  },

  // 返回首页
  onBackHome() {
    wx.switchTab({ url: '/pages/books/books' })
  },
})
