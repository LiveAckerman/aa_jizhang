const app = getApp()
const api = require('../../../utils/api')

Page({
  data: {
    bookId: '',
    myUserId: '',
    members: [],
    rates: [{ code: 'CNY', name: '人民币', symbol: '¥', rate: 1, label: '人民币 (CNY)' }],

    ocrImageUrl: '',   // 首张图缩略图（顶部展示用）
    allImages: [],     // 所有已识别图片 URL（点缩略图预览全部）
    records: [],   // [{ id, initial }] 待处理
    trashed: [],   // [{ id, initial }] 已跳过（垃圾桶，可恢复）
    current: 0,    // 当前展示索引
    ready: false,
    submitting: false,
    showTrash: false, // 垃圾桶抽屉显隐

    // 批量串行识别状态
    firstReady: false,   // 首条记录是否就绪（false 时整页 loading）
    processing: false,   // 是否仍在后台串行识别剩余图片
    processedCount: 0,   // 已识别完成的图片数（含失败/空）
    totalCount: 1,       // 图片总数
    skipEmpty: 0,        // 识别为空的图片数
    skipFailed: 0,       // 识别失败的图片数
    everHadRecords: false, // 本批是否识别到过任何记录（区分"全部处理完"和"啥都没识别到"）
  },

  onLoad(query) {
    const myUserId = (app.globalData.user || {}).id || ''
    this.setData({ bookId: query.bookId || '', myUserId })
    wx.setNavigationBarTitle({ title: '票据识别结果' })

    // 自增序号，生成稳定唯一 id（避免串行循环里 Date.now() 碰撞导致 wx:key 复用错位）
    this._seq = 0
    // 代次令牌：每次开跑 +1，串行循环比对，重新上传时旧循环自动失效
    this._runId = 0
    // 页面销毁标志：与代次令牌解耦，避免 onUnload 的 ++ 被随后的 startBatch ++ 追平
    this._unloaded = false

    // 读取入口页写入的批量传参，读完立即清空
    const payload = app.globalData.ocrBatchPayload
    app.globalData.ocrBatchPayload = null

    Promise.all([this.loadMembers(), this.loadRates()]).finally(() => {
      this.setData({ ready: true })
      this.startBatch(payload)
    })
  },

  onUnload() {
    // 页面销毁：置标志，使 startBatch/processQueue 全部提前返回，避免 setData 到已销毁页面
    this._unloaded = true
  },

  // 应用入口页传参：落定首张结果，再串行识别剩余图片
  startBatch(payload) {
    if (this._unloaded) return // Promise.all 回调期间页面已退出
    if (!payload) {
      // 无传参（异常兜底）：直接空态
      this.setData({ firstReady: true, totalCount: 0 })
      return
    }
    const { firstResult, firstSkip, remainingPaths = [], totalImages = 1 } = payload
    this.setData({
      totalCount: totalImages,
      processedCount: 1, // 第 1 张已在入口页处理
      skipEmpty: firstSkip === 'empty' ? 1 : 0,
      skipFailed: firstSkip === 'failed' ? 1 : 0,
    })

    if (firstResult) {
      this.appendResult(firstResult)
    }

    if (remainingPaths.length > 0) {
      this.setData({ processing: true })
      this.processQueue(remainingPaths, ++this._runId)
    } else {
      // 只有 1 张：无后续，首条若为空则整页转空态
      this.finishBatch()
    }
  },

  // 串行识别图片，逐张追加结果。runId 为代次令牌，页面销毁/重新上传会使旧循环失效
  async processQueue(paths, runId) {
    // 循环失效条件：页面已销毁，或已被新一轮重新上传取代
    const stale = () => this._unloaded || this._runId !== runId
    for (let i = 0; i < paths.length; i++) {
      if (stale()) return
      try {
        const result = await api.ocrRecognizeReceipt(paths[i], this.data.bookId)
        if (stale()) return
        if (result && result.records && result.records.length > 0) {
          this.appendResult(result)
        } else {
          this.setData({ skipEmpty: this.data.skipEmpty + 1 })
        }
      } catch (e) {
        if (stale()) return
        this.setData({ skipFailed: this.data.skipFailed + 1 })
      }
      this.setData({ processedCount: this.data.processedCount + 1 })
    }
    if (stale()) return
    this.setData({ processing: false })
    this.finishBatch()
  },

  // 追加一批 OCR 结果到 records 末尾（不重置 current，不影响正在编辑的表单）
  appendResult(data) {
    const imageUrl = data.imageUrl || ''
    const list = (data.records || []).map((r) => ({
      id: 'rec_' + this._seq++,
      initial: {
        type: 'shared',
        amount: (r.amount || 0) / 100,
        category: r.category || 'other',
        paymentMethod: r.paymentMethod || 'wechat',
        note: r.note || r.merchant || '',
        images: imageUrl ? [imageUrl] : [], // 各条用各自那张原图作凭证
        spentAt: r.spentAt || new Date().toISOString(),
      },
    }))
    const newRecords = this.data.records.concat(list)
    const newAllImages = imageUrl ? this.data.allImages.concat(imageUrl) : this.data.allImages
    this.setData({
      records: newRecords,
      allImages: newAllImages,
      ocrImageUrl: this.data.ocrImageUrl || imageUrl, // 缩略图固定用第 1 张
      firstReady: true,
      everHadRecords: true,
    })
  },

  // 批量结束：汇总失败/空的提示
  finishBatch() {
    if (!this.data.firstReady) this.setData({ firstReady: true })
    const { skipEmpty, skipFailed } = this.data
    const parts = []
    if (skipEmpty > 0) parts.push(`${skipEmpty} 张未识别到记录`)
    if (skipFailed > 0) parts.push(`${skipFailed} 张识别失败`)
    if (parts.length > 0) {
      wx.showToast({ title: parts.join('，'), icon: 'none', duration: 2500 })
    }
  },

  async loadRates() {
    try {
      const res = await api.exchangeRates()
      if (res && res.rates && res.rates.length) {
        this.setData({ rates: res.rates.map((r) => ({ ...r, label: `${r.name} (${r.code})` })) })
      }
    } catch (e) {}
  },

  async loadMembers() {
    try {
      const book = await api.bookDetail(this.data.bookId)
      this.setData({ members: book.members || [] })
    } catch (e) {}
  },

  onPrev() {
    if (this.data.current > 0) this.setData({ current: this.data.current - 1 })
  },
  onNext() {
    if (this.data.current < this.data.records.length - 1) {
      this.setData({ current: this.data.current + 1 })
    }
  },

  // 重新上传：多选图片，清空所有现有状态，重新串行识别（首张整页 loading）
  onReupload() {
    const doReupload = () => {
      wx.chooseMedia({
        count: 9,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        success: (res) => {
          const paths = (res.tempFiles || []).map((f) => f.tempFilePath)
          if (paths.length === 0) return
          this._seq = 0
          this.setData({
            records: [],
            trashed: [],
            allImages: [],
            ocrImageUrl: '',
            current: 0,
            showTrash: false,
            firstReady: false,
            processing: true,
            processedCount: 0,
            totalCount: paths.length,
            skipEmpty: 0,
            skipFailed: 0,
            everHadRecords: false,
          })
          // 全量走串行队列（含首张，首张就绪前整页 loading）；++_runId 使上一批循环失效
          this.processQueue(paths, ++this._runId)
        },
      })
    }

    // 有未提交记录或后台仍在识别时，二次确认（防止丢失已编辑内容）
    if (this.data.records.length > 0 || this.data.processing) {
      wx.showModal({
        title: '重新上传',
        content: `重新上传将清空当前所有记录并重新识别，确认继续？`,
        confirmText: '继续',
        confirmColor: '#fa9583',
        success: (r) => { if (r.confirm) doReupload() },
      })
    } else {
      doReupload()
    }
  },

  // 预览所有已识别的原图
  onPreviewImage() {
    const urls = this.data.allImages
    if (!urls || urls.length === 0) return
    wx.previewImage({ current: urls[0], urls })
  },

  // 提交当条，提交成功后从列表移除
  async onSubmit() {
    if (this.data.submitting) return
    const { records, current, bookId } = this.data
    if (records.length === 0) return

    const form = this.selectComponent('#form_' + records[current].id)
    if (!form) return

    const res = form.buildPayload(bookId)
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...', mask: true })
    try {
      await api.createTransaction(res.payload)
      wx.hideLoading()

      const newRecords = records.slice()
      newRecords.splice(current, 1)

      if (newRecords.length === 0 && !this.data.processing) {
        // 全部处理完成且无后台识别：通知上一页刷新后返回
        const pages = getCurrentPages()
        if (pages.length >= 2) {
          const prevPage = pages[pages.length - 2]
          if (prevPage.route && prevPage.route.includes('book-detail')) {
            prevPage._needRefresh = true
          }
        }
        wx.navigateBack()
        return
      }

      const newCurrent = newRecords.length === 0 ? 0 : Math.min(current, newRecords.length - 1)
      wx.showToast({ title: '已提交', icon: 'success' })
      // records 空但仍在识别：停留显示"等待识别中"（由 wxml 的 processing 态渲染）
      this.setData({ records: newRecords, current: newCurrent, submitting: false })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: (e && e.message) || '提交失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  // 跳过当前条：移进垃圾桶，自动展示下一条；records 空则直接返回
  onSkipCurrent() {
    const { records, current, trashed } = this.data
    if (records.length === 0) return

    const skipped = records[current]
    const newRecords = records.slice()
    newRecords.splice(current, 1)
    const newTrashed = trashed.concat(skipped)

    if (newRecords.length === 0 && !this.data.processing) {
      // 待处理清空且无后台识别：通知上一页刷新后返回（有些记录已提交成功）
      const pages = getCurrentPages()
      if (pages.length >= 2) {
        const prevPage = pages[pages.length - 2]
        if (prevPage.route && prevPage.route.includes('book-detail')) {
          prevPage._needRefresh = true
        }
      }
      wx.navigateBack()
      return
    }

    const newCurrent = newRecords.length === 0 ? 0 : Math.min(current, newRecords.length - 1)
    this.setData({ records: newRecords, trashed: newTrashed, current: newCurrent })
  },

  // 打开垃圾桶抽屉（空则不弹）
  onOpenTrash() {
    if (this.data.trashed.length === 0) return
    this.setData({ showTrash: true })
  },

  onCloseTrash() {
    this.setData({ showTrash: false })
  },

  // 从垃圾桶恢复某条：移回待处理末尾，关抽屉并跳到该条
  onRestore(e) {
    const id = e.currentTarget.dataset.id
    const { trashed, records } = this.data
    const idx = trashed.findIndex((r) => r.id === id)
    if (idx === -1) return

    const restored = trashed[idx]
    const newTrashed = trashed.slice()
    newTrashed.splice(idx, 1)
    const newRecords = records.concat(restored)

    this.setData({
      records: newRecords,
      trashed: newTrashed,
      current: newRecords.length - 1, // 跳到恢复的这条
      showTrash: false,
    })
  },

  // 主动返回（缩略图 × / 空态返回）：有未处理记录或垃圾桶非空时二次确认
  onExit() {
    const remaining = this.data.records.length
    const trashedCount = this.data.trashed.length
    if (remaining === 0 && trashedCount === 0) {
      // 可能有部分已提交成功，通知刷新
      const pages = getCurrentPages()
      if (pages.length >= 2) {
        const prevPage = pages[pages.length - 2]
        if (prevPage.route && prevPage.route.includes('book-detail')) {
          prevPage._needRefresh = true
        }
      }
      wx.navigateBack()
      return
    }
    const parts = []
    if (remaining > 0) parts.push(`${remaining} 条未处理`)
    if (trashedCount > 0) parts.push(`${trashedCount} 条已跳过`)
    wx.showModal({
      title: '退出识别',
      content: `还有 ${parts.join('、')}，退出后将丢弃，确认退出？`,
      confirmText: '退出',
      confirmColor: '#fa9583',
      success: (r) => {
        if (r.confirm) {
          // 确认退出时也通知刷新（可能有部分已提交）
          const pages = getCurrentPages()
          if (pages.length >= 2) {
            const prevPage = pages[pages.length - 2]
            if (prevPage.route && prevPage.route.includes('book-detail')) {
              prevPage._needRefresh = true
            }
          }
          wx.navigateBack()
        }
      },
    })
  },

  // 空态下直接返回
  onBack() {
    // 空态说明所有记录都已处理完，通知刷新
    const pages = getCurrentPages()
    if (pages.length >= 2) {
      const prevPage = pages[pages.length - 2]
      if (prevPage.route && prevPage.route.includes('book-detail')) {
        prevPage._needRefresh = true
      }
    }
    wx.navigateBack()
  },

  // 阻止抽屉面板内点击冒泡到遮罩层（避免误关）
  stopPropagation() {},
})
