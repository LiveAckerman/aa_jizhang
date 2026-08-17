const app = getApp()
const api = require('../../utils/api')
const { CATEGORIES } = require('../../constants/ledger')

Page({
  data: {
    bookId: '',
    imageUrl: '',
    rawText: '',
    records: [],
    categories: CATEGORIES,

    // 计算属性
    checkedCount: 0,
    allChecked: false,

    loading: false,
    submitting: false,
    showRawText: false,
  },

  onLoad(query) {
    this.setData({
      bookId: query.bookId || '',
    })

    // 接收从上一页传来的识别结果
    const eventChannel = this.getOpenerEventChannel()
    eventChannel.on('ocrResult', (data) => {
      this.applyOcrResult(data)
    })
  },

  // 把 OCR 结果套用到页面（新识别 / 重新识别共用）
  applyOcrResult(data) {
    const records = (data.records || []).map((r, i) => {
      const category = CATEGORIES.find((c) => c.key === r.category) || CATEGORIES[CATEGORIES.length - 1]
      return {
        id: String(i),
        merchant: r.merchant || '未知商户',
        amount: r.amount || 0,
        amountText: ((r.amount || 0) / 100).toFixed(2),
        category: r.category || 'other',
        categoryName: category.name,
        categoryIcon: category.icon,
        spentAt: r.spentAt || new Date().toISOString(),
        note: r.note || r.merchant || '',
        confidence: r.confidence || 0.5,
        confidencePercent: Math.round((r.confidence || 0.5) * 100), // 预计算百分比
        confidenceWidth: ((r.confidence || 0.5) * 100).toFixed(0), // 预计算宽度
        checked: true,
      }
    })

    this.setData({
      imageUrl: data.imageUrl || '',
      rawText: data.rawOcrResult || '',
      records,
    })
    this.updateCheckedCount()
  },

  // 重新上传图片并重新识别（覆盖当前结果）
  onReupload() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: async (res) => {
        const filePath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '重新识别中...' })
        try {
          const result = await api.ocrRecognizeReceipt(filePath, this.data.bookId)
          wx.hideLoading()
          if (!result.records || result.records.length === 0) {
            wx.showToast({ title: '未识别到支付记录', icon: 'none' })
          } else {
            wx.showToast({ title: `识别到 ${result.records.length} 条`, icon: 'success' })
          }
          this.applyOcrResult(result)
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '识别失败', icon: 'none' })
        }
      },
    })
  },

  // 更新选中数量
  updateCheckedCount() {
    const checkedCount = this.data.records.filter((r) => r.checked).length
    const allChecked = this.data.records.length > 0 && checkedCount === this.data.records.length
    this.setData({ checkedCount, allChecked })
  },

  // 切换勾选状态
  onToggleCheck(e) {
    const { id } = e.currentTarget.dataset
    const records = this.data.records.map((r) =>
      r.id === id ? { ...r, checked: !r.checked } : r,
    )
    this.setData({ records })
    this.updateCheckedCount()
  },

  // 全选/取消全选
  onToggleAll() {
    const allChecked = this.data.allChecked
    const records = this.data.records.map((r) => ({ ...r, checked: !allChecked }))
    this.setData({ records })
    this.updateCheckedCount()
  },

  // 切换原始文本显示
  onToggleRawText() {
    this.setData({ showRawText: !this.data.showRawText })
  },

  // 快捷编辑金额
  onEditAmount(e) {
    const { id } = e.currentTarget.dataset
    const record = this.data.records.find((r) => r.id === id)

    wx.showModal({
      title: '修改金额',
      editable: true,
      placeholderText: '请输入金额（元）',
      content: record.amountText,
      success: (res) => {
        if (!res.confirm) return
        const amount = parseFloat(res.content || '0')
        if (isNaN(amount) || amount <= 0) {
          wx.showToast({ title: '请输入有效金额', icon: 'none' })
          return
        }
        const records = this.data.records.map((r) =>
          r.id === id
            ? { ...r, amount: Math.round(amount * 100), amountText: amount.toFixed(2) }
            : r,
        )
        this.setData({ records })
      },
    })
  },

  // 快捷编辑商户名
  onEditMerchant(e) {
    const { id } = e.currentTarget.dataset
    const record = this.data.records.find((r) => r.id === id)

    wx.showModal({
      title: '修改商户名',
      editable: true,
      placeholderText: '请输入商户名',
      content: record.merchant,
      success: (res) => {
        if (!res.confirm) return
        const merchant = (res.content || '').trim()
        if (!merchant) return
        const records = this.data.records.map((r) =>
          r.id === id ? { ...r, merchant, note: merchant } : r,
        )
        this.setData({ records })
      },
    })
  },

  // 选择分类
  onEditCategory(e) {
    const { id } = e.currentTarget.dataset
    const items = this.data.categories.map((c) => c.name)

    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const category = this.data.categories[res.tapIndex]
        const records = this.data.records.map((r) =>
          r.id === id
            ? {
                ...r,
                category: category.key,
                categoryName: category.name,
                categoryIcon: category.icon,
              }
            : r,
        )
        this.setData({ records })
      },
    })
  },

  // 删除记录
  onDelete(e) {
    const { id } = e.currentTarget.dataset
    const record = this.data.records.find((r) => r.id === id)

    wx.showModal({
      title: '删除记录',
      content: `确定删除「${record.merchant}」吗？`,
      confirmColor: '#fa9583',
      success: (res) => {
        if (!res.confirm) return
        const records = this.data.records.filter((r) => r.id !== id)
        this.setData({ records })
        this.updateCheckedCount()
        if (records.length === 0) {
          wx.showToast({ title: '已清空，请返回', icon: 'none' })
        }
      },
    })
  },

  // 提交创建
  async onSubmit() {
    const checked = this.data.records.filter((r) => r.checked)
    if (checked.length === 0) {
      wx.showToast({ title: '请至少选择一条记录', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const transactions = checked.map((r) => ({
        bookId: this.data.bookId,
        type: 'shared',
        amount: r.amount,
        category: r.category,
        note: r.note,
        spentAt: r.spentAt,
      }))

      await api.batchCreateFromOcr({ transactions })
      wx.showToast({ title: `已创建 ${checked.length} 条记录`, icon: 'success' })

      setTimeout(() => {
        wx.navigateBack({ delta: 2 }) // 返回到账本详情页
      }, 1000)
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '创建失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },
})
