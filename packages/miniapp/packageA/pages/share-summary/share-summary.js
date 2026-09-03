const api = require('../../../utils/api')
const { CATEGORY_MAP, PAYMENT_MAP_FULL } = require('../../../constants/ledger')

Page({
  data: {
    tokenId: '',
    bookId: '',       // 从 book-detail 直接进入时使用
    isOwner: true,    // 从 book-detail 进入时为 true，分享链接进入为 false
    book: null,
    headerCard: null,  // 通用 book-card 头部数据
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

      // 组装通用 book-card 头部数据（复用 book-detail 的顶部卡片样式）
      const headerCard = {
        name: book.name,
        coverUrl: book.coverUrl,
        members: (book.members || []).map((m, i) => ({ avatar: m.avatar, userId: String(i) })),
        bookTotalText: summary.totalAmountText,
        myTotalText: summary.totalAmountText,
        hasPrivate: false,
        dateText: `${book.memberCount || 0} 人参与`,
      }

      this.setData({
        book,
        headerCard,
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
    // 高度按内容精确测量（与 drawTicket 的排版增量一致）
    // 顶部：y起始16 + 账本信息卡96 + 汇总卡130 + 明细标题40 = 282
    // 每组：分组头68 + 明细行 txN*52 + 8
    // 底部：水印+日期 约 50
    const HEADER = 282
    const GROUP_HEAD = 68
    const TX_ROW = 52
    const FOOTER = 50
    let contentH = HEADER
    this.data.groups.forEach((g) => {
      const txN = (g.transactions || []).length
      contentH += GROUP_HEAD + txN * TX_ROW + 8
    })
    contentH += FOOTER
    const cssH = Math.min(Math.ceil(contentH), CANVAS_MAX)

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

            // 延迟一帧确保绘制落盘（用 setTimeout，兼容性优于 requestAnimationFrame）
            setTimeout(() => {
              wx.canvasToTempFilePath({
                canvas,
                x: 0,
                y: 0,
                width: pxW,
                height: pxH,
                destWidth: pxW, // 必须显式传，否则默认再乘一次 dpr → 超 4096
                destHeight: pxH,
                fileType: 'png',
                success: (r) => {
                  // 立即提取字符串路径，不持有 r 对象本身
                  const path = String((r && r.tempFilePath) || '')
                  if (!path) return reject(new Error('导出路径为空'))
                  resolve(path)
                },
                fail: (err) => {
                  // 只保留错误信息字符串，不透传原始 err 对象（可能引用 canvas）
                  reject(new Error(String((err && err.errMsg) || '导出失败')))
                },
              })
            }, 50)
          })
      })
    })
  },

  // 绘制小票内容（复刻页面视觉：白色圆角卡片 + 品牌主色 + 圆形头像 + 明细全展开）
  drawTicket(ctx, width, height) {
    const { book, summary, groups, config, groupBy } = this.data
    const PRIMARY = '#4097a9'
    const DARK = '#2f4159'
    const GRAY = '#8091a5'
    const LIGHT = '#f2f6f7'
    const ACCENT = '#fa9583'
    const BORDER = '#eceff1'

    // 背景（浅色渐变）
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height)
    bgGrad.addColorStop(0, '#eef5f6')
    bgGrad.addColorStop(1, '#f6f1ea')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)

    const PAD = 16 // 页面左右边距
    const cardX = PAD
    const cardW = width - PAD * 2
    let y = 16

    // 工具函数：圆角矩形
    const rrect = (x, yy, w, h, r) => {
      ctx.beginPath()
      ctx.moveTo(x + r, yy)
      ctx.arcTo(x + w, yy, x + w, yy + h, r)
      ctx.arcTo(x + w, yy + h, x, yy + h, r)
      ctx.arcTo(x, yy + h, x, yy, r)
      ctx.arcTo(x, yy, x + w, yy, r)
      ctx.closePath()
    }

    // ========== 1. 账本信息卡片 ==========
    const infoCardH = 84
    rrect(cardX, y, cardW, infoCardH, 14)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    // 封面（用色块代替，若书有 coverUrl 此处不上网络图，保持简单）
    rrect(cardX + 14, y + 16, 52, 52, 12)
    ctx.fillStyle = LIGHT
    ctx.fill()
    ctx.fillStyle = PRIMARY
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('账', cardX + 40, y + 42)
    // 名称 + 成员数
    ctx.fillStyle = DARK
    ctx.font = 'bold 17px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(this.truncate(book.name || '账本', 16), cardX + 78, y + 34)
    ctx.fillStyle = GRAY
    ctx.font = '12px sans-serif'
    ctx.fillText(`${book.memberCount || 0} 人参与`, cardX + 78, y + 54)
    y += infoCardH + 12

    // ========== 2. 汇总卡片 ==========
    const sumCardH = 118
    rrect(cardX, y, cardW, sumCardH, 14)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    const rowY = y + 40
    // 总金额行
    ctx.fillStyle = GRAY
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('总金额', cardX + 20, rowY)
    ctx.fillStyle = ACCENT
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`¥${summary.totalAmountText}`, cardX + cardW - 20, rowY)
    // 账单笔数 + 统计维度
    ctx.fillStyle = GRAY
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`账单 ${summary.txCount} 笔`, cardX + 20, rowY + 30)
    ctx.textAlign = 'right'
    const modeText = config.groupBy === 'person' ? '按人员' : config.groupBy === 'category' ? '按分类' : '按支付方式'
    ctx.fillText(modeText, cardX + cardW - 20, rowY + 30)
    // 结算状态
    ctx.textAlign = 'left'
    ctx.fillText(config.includeUnsettled ? '含未结算' : '仅已结算', cardX + 20, rowY + 48)
    y += sumCardH + 12

    // ========== 3. 明细（全展开） ==========
    ctx.fillStyle = DARK
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('明细统计', cardX + 4, y + 16)
    y += 40

    groups.forEach((group) => {
      // 分组卡片头部
      const headText = this.truncate(group.label || '', 10)
      // 头像（person 模式）或图标色块
      rrect(cardX, y, cardW, 60, 14)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      if (groupBy === 'person' && group.avatar) {
        // 圆形头像（用色块占位，不加载网络图）
        ctx.beginPath()
        ctx.arc(cardX + 34, y + 30, 20, 0, Math.PI * 2)
        ctx.fillStyle = LIGHT
        ctx.fill()
        ctx.fillStyle = PRIMARY
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(headText[0] || '', cardX + 34, y + 31)
      }
      // 名称
      ctx.fillStyle = DARK
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(headText, cardX + 62, y + 27)
      ctx.fillStyle = GRAY
      ctx.font = '11px sans-serif'
      ctx.fillText(group.sublabel || '', cardX + 62, y + 45)
      // 金额
      ctx.fillStyle = PRIMARY
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`¥${group.totalAmountText}`, cardX + cardW - 18, y + 32)
      y += 60 + 8

      // 该分组下所有明细行（全部展开）
      const txs = group.transactions || []
      if (txs.length > 0) {
        rrect(cardX, y, cardW, txs.length * 52, 0)
      }
      txs.forEach((tx, i) => {
        const rowH = 52
        // 每行背景
        ctx.fillStyle = i % 2 === 0 ? '#fafbfc' : '#ffffff'
        ctx.fillRect(cardX + 2, y, cardW - 4, rowH)
        // 分类图标色块
        rrect(cardX + 12, y + 10, 32, 32, 8)
        ctx.fillStyle = LIGHT
        ctx.fill()
        ctx.fillStyle = PRIMARY
        ctx.font = '13px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(this.truncate(tx.categoryName || '', 2), cardX + 28, y + 27)
        // 备注 + 日期
        ctx.fillStyle = DARK
        ctx.font = '13px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        const note = this.truncate(tx.note || '无备注', 18)
        ctx.fillText(note, cardX + 54, y + 22)
        ctx.fillStyle = GRAY
        ctx.font = '11px sans-serif'
        ctx.fillText(tx.spentAt || '', cardX + 54, y + 40)
        // 金额
        ctx.fillStyle = DARK
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(`¥${tx.amountText}`, cardX + cardW - 14, y + 30)
        y += rowH
        // 分隔线
        if (i < txs.length - 1) {
          ctx.strokeStyle = BORDER
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(cardX + 12, y)
          ctx.lineTo(cardX + cardW - 12, y)
          ctx.stroke()
        }
      })
      y += 8
    })

    // ========== 4. 底部水印 + 日期 ==========
    y += 12
    ctx.fillStyle = '#c4c4c4'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('一起分账吧 · 多人记账 简单明了', width / 2, y)
    y += 18
    const now = new Date()
    const dateText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    ctx.fillText(dateText, width / 2, y)
  },

  // 截断文本（超长加省略号）
  truncate(str, max) {
    if (!str) return ''
    return str.length > max ? str.substring(0, max) + '…' : str
  },

  // 保存到相册（Promise）
  saveToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath: String(filePath || ''),
        // 不把回调结果对象透传出去，避免被 SDK 日志层序列化
        success: () => resolve(),
        fail: (err) => {
          const msg = String((err && err.errMsg) || '')
          if (msg.includes('auth deny') || msg.includes('auth denied')) {
            wx.hideLoading()
            wx.showModal({
              title: '需要相册权限',
              content: '请在设置中允许访问相册后重试',
              confirmText: '去设置',
              success: (res) => {
                if (res && res.confirm) wx.openSetting()
              },
            })
            const e = new Error('相册权限被拒绝')
            e.__handled = true // 标记：已弹窗，外层不再 toast
            return reject(e)
          }
          // 只保留错误信息字符串，不透传原始 err 对象
          reject(new Error(msg || '保存失败'))
        },
      })
    })
  },

  // 返回首页
  onBackHome() {
    wx.switchTab({ url: '/pages/books/books' })
  },
})
