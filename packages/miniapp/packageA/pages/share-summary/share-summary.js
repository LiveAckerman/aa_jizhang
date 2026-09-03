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
    // 离屏 canvas 尺寸（CSS px），导出前按内容动态计算
    canvasW: 375,
    canvasH: 600,
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
        // 给每个 transaction 添加分类图标信息
        transactions: (g.transactions || []).map((tx) => {
          const cat = CATEGORY_MAP[tx.category] || CATEGORY_MAP.other
          return {
            ...tx,
            categoryIcon: cat.icon,
            categorySvg: cat.svgIcon || '',
          }
        }),
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
          // 分类模式下，transaction 已经有了分类信息，只需要添加图标
          transactions: (g.transactions || []).map((tx) => ({
            ...tx,
            categoryIcon: cat.icon,
            categorySvg: cat.svgIcon || '',
          })),
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
          // 支付方式模式下，需要添加分类图标信息
          transactions: (g.transactions || []).map((tx) => {
            const cat = CATEGORY_MAP[tx.category] || CATEGORY_MAP.other
            return {
              ...tx,
              categoryIcon: cat.icon,
              categorySvg: cat.svgIcon || '',
            }
          }),
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
  async onSaveImage() {
    if (this.data.saving) return
    this.setData({ saving: true })
    wx.showLoading({ title: '生成中...', mask: true })

    try {
      const tempFilePath = await this.renderToImage()
      await this.saveToAlbum(tempFilePath)
      wx.hideLoading()
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (e) {
      // 打出真实错误，便于定位（不再吞掉 errMsg）
      console.error('[share-summary] 生成/保存失败:', (e && e.errMsg) || (e && e.message) || e)
      wx.hideLoading()
      // 权限弹窗已在 saveToAlbum 内处理，这里不再重复提示
      if (!(e && e.__handled)) {
        wx.showToast({ title: '生成失败', icon: 'none' })
      }
    } finally {
      this.setData({ saving: false })
    }
  },

  // 渲染并导出为临时图片（Promise）
  renderToImage() {
    const CANVAS_MAX = 4096 // 微信 Canvas 2D 单边像素上限
    const BASE_W = 375 // 逻辑宽度（CSS px）
    // 高度测量必须与 drawTicket 的排版累计增量一致（含底部留白）
    // drawTicket: 进 groups 循环前累计 ~290，每组 60，循环后水印+日期收尾 ~90
    const HEADER = 300
    const ITEM = 60
    const FOOTER = 90
    const cssH = Math.min(HEADER + this.data.groups.length * ITEM + FOOTER, CANVAS_MAX)

    return new Promise((resolve, reject) => {
      // 先把内容高度同步到 canvas 的 CSS 尺寸，setData 回调里再查询节点
      this.setData({ canvasW: BASE_W, canvasH: cssH }, () => {
        this.createSelectorQuery()
          .select('#summaryCanvas')
          .fields({ node: true, size: true })
          .exec((res) => {
            // 注意：绝不 console.log(res) —— canvas 节点含循环引用，序列化会爆栈
            if (!res || !res[0] || !res[0].node) {
              return reject(new Error('canvas 节点获取失败'))
            }
            const canvas = res[0].node
            const ctx = canvas.getContext('2d')

            // 安全 dpr：设备 dpr 与 4096/边长 取最小，保证物理像素不超上限
            const winInfo = wx.getWindowInfo ? wx.getWindowInfo() : { pixelRatio: 2 }
            const rawDpr = Math.min(3, Math.max(1, winInfo.pixelRatio || 2))
            const dpr = Math.max(
              1,
              Math.min(rawDpr, CANVAS_MAX / BASE_W, CANVAS_MAX / cssH),
            )

            // backing store 物理像素，取整避免 stride 对齐导致斜切
            const pxW = Math.round(BASE_W * dpr)
            const pxH = Math.round(cssH * dpr)
            canvas.width = pxW
            canvas.height = pxH
            ctx.scale(dpr, dpr) // 之后按 CSS 尺寸绘制

            try {
              this.drawTicket(ctx, BASE_W, cssH)
            } catch (e) {
              return reject(e)
            }

            // 等两帧确保绘制真正落到 buffer（官方建议延迟导出）
            canvas.requestAnimationFrame(() => {
              canvas.requestAnimationFrame(() => {
                wx.canvasToTempFilePath({
                  canvas,
                  x: 0,
                  y: 0,
                  width: pxW,
                  height: pxH,
                  destWidth: pxW, // 必须显式传，否则默认再乘一次 dpr → 超 4096
                  destHeight: pxH,
                  fileType: 'png',
                  success: (r) => resolve(r.tempFilePath),
                  fail: (err) => reject(err), // 把真实 errMsg 抛出去
                })
              })
            })
          })
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
    ctx.fillText('账本总结', width / 2, y)
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

  // 保存到相册（Promise）
  saveToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: (err) => {
          const msg = (err && err.errMsg) || ''
          if (msg.includes('auth deny') || msg.includes('auth denied')) {
            wx.hideLoading()
            wx.showModal({
              title: '需要相册权限',
              content: '请在设置中允许访问相册后重试',
              confirmText: '去设置',
              success: (res) => {
                if (res.confirm) wx.openSetting()
              },
            })
            const e = new Error('相册权限被拒绝')
            e.__handled = true // 标记：已弹窗，外层不再 toast
            return reject(e)
          }
          reject(err)
        },
      })
    })
  },

  // 返回首页
  onBackHome() {
    wx.switchTab({ url: '/pages/books/books' })
  },
})
