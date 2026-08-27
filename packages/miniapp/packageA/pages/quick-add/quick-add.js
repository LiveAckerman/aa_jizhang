const app = getApp()
const api = require('../../../utils/api')

Page({
  data: {
    mode: 'manual', // manual | ocr
    modeLabel: '手动录入',
    keyword: '',
    books: [], // 全部账本
    filtered: [], // 搜索过滤后
    selectedId: '', // 选中的账本
    loading: true,
  },

  onLoad(query) {
    const mode = query.mode === 'ocr' ? 'ocr' : 'manual'
    this.setData({ mode, modeLabel: mode === 'ocr' ? '票据自动识别' : '手动录入' })
    wx.setNavigationBarTitle({ title: '快速记账' })
  },

  onShow() {
    this.loadBooks()
  },

  async loadBooks() {
    try {
      const books = await api.listBooks()
      // 默认选中最新创建的账本（列表接口按 createdAt DESC，取第一个）
      const selectedId = this.data.selectedId || (books[0] && books[0].id) || ''
      this.setData({ books, filtered: books, selectedId, loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  onSearch(e) {
    const kw = (e.detail.value || '').trim().toLowerCase()
    const filtered = kw
      ? this.data.books.filter((b) => (b.name || '').toLowerCase().includes(kw))
      : this.data.books
    this.setData({ keyword: e.detail.value, filtered })
  },

  onPickBook(e) {
    this.setData({ selectedId: e.currentTarget.dataset.id })
  },

  // 在当前页新建账本
  onCreateBook() {
    wx.showModal({
      title: '新建账本',
      editable: true,
      placeholderText: '输入账本名称',
      success: async (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) return
        try {
          const book = await api.createBook({ name, scene: 'custom' })
          wx.showToast({ title: '已创建', icon: 'success' })
          // 新建后刷新并选中它
          this.setData({ selectedId: book.id })
          this.loadBooks()
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '创建失败', icon: 'none' })
        }
      },
    })
  },

  // 下一步：按 mode 进入对应流程
  onNext() {
    const bookId = this.data.selectedId
    if (!bookId) {
      wx.showToast({ title: '请选择账本', icon: 'none' })
      return
    }
    if (this.data.mode === 'manual') {
      wx.redirectTo({ url: `/packageA/pages/add-transaction/add-transaction?bookId=${bookId}` })
    } else {
      // OCR：先选图识别，再跳批量编辑
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        success: async (res) => {
          // 分阶段 loading：OCR 提取 → AI 总结
          wx.showLoading({ title: '提取文字中...', mask: true })
          const steps = [
            { delay: 2500, title: 'AI 总结中...' },
            { delay: 6000, title: '即将完成...' },
          ]
          const timers = steps.map(({ delay, title }) =>
            setTimeout(() => wx.showLoading({ title, mask: true }), delay),
          )

          try {
            const result = await api.ocrRecognizeReceipt(res.tempFiles[0].tempFilePath, bookId)
            timers.forEach(clearTimeout)
            wx.hideLoading()
            if (!result.records || result.records.length === 0) {
              wx.showToast({ title: '未识别到账单记录', icon: 'none' })
              return
            }
            wx.redirectTo({
              url: `/packageA/pages/ocr-batch-edit/ocr-batch-edit?bookId=${bookId}`,
              success: (navRes) => navRes.eventChannel.emit('ocrResult', result),
            })
          } catch (e) {
            timers.forEach(clearTimeout)
            wx.hideLoading()
            wx.showToast({ title: (e && e.message) || '识别失败', icon: 'none' })
          }
        },
      })
    }
  },

  onSwitchMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ mode, modeLabel: mode === 'ocr' ? '票据自动识别' : '手动录入' })
  },
})
