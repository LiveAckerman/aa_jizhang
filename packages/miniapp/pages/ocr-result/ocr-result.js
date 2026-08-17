const app = getApp()
const api = require('../../utils/api')
const { CATEGORIES, CATEGORY_MAP } = require('../../constants/ledger')

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

    // 分类选择弹窗
    showCategoryDialog: false,
    categoryDialogId: '',

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

  // 把后端一条 record 补全展示字段（金额转元、分类映射、置信度百分比等）
  // 后端只返回业务数据（分/key），展示层格式化统一收敛在这里
  decorateRecord(r, id) {
    const cat = CATEGORY_MAP[r.category] || CATEGORY_MAP.other
    const amount = r.amount || 0
    const confidence = r.confidence == null ? 0.5 : r.confidence
    return {
      id,
      merchant: r.merchant || '未知商户',
      amount,
      amountText: (amount / 100).toFixed(2),
      category: cat.key,
      categoryName: cat.name,
      categoryIcon: cat.icon,
      spentAt: r.spentAt || new Date().toISOString(),
      note: r.note || r.merchant || '',
      confidence,
      confidencePercent: Math.round(confidence * 100),
      confidenceWidth: (confidence * 100).toFixed(0),
      checked: true,
    }
  },

  // 把 OCR 结果套用到页面（新识别 / 重新识别共用）
  applyOcrResult(data) {
    const records = (data.records || []).map((r, i) =>
      this.decorateRecord(r, String(i)),
    )

    this.setData({
      imageUrl: data.imageUrl || '',
      rawText: data.rawOcrResult || '',
      records,
    })
    this.updateCheckedCount()
  },

  // 点击原图放大预览
  onPreviewImage() {
    if (!this.data.imageUrl) return
    wx.previewImage({
      current: this.data.imageUrl,
      urls: [this.data.imageUrl],
    })
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

  // 统一更新某条记录：合并业务字段后经 decorateRecord 重算所有展示字段，
  // 避免各处编辑手动同步 amountText/categoryName 等派生字段导致遗漏
  patchRecord(id, patch) {
    const records = this.data.records.map((r) => {
      if (r.id !== id) return r
      const merged = { ...r, ...patch }
      const decorated = this.decorateRecord(merged, id)
      decorated.checked = r.checked // 保留勾选状态
      return decorated
    })
    this.setData({ records })
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
        this.patchRecord(id, { amount: Math.round(amount * 100) })
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
        this.patchRecord(id, { merchant, note: merchant })
      },
    })
  },

  // 打开分类选择弹窗（ActionSheet 最多6项，分类有9个，改用自定义网格弹窗）
  onEditCategory(e) {
    const { id } = e.currentTarget.dataset
    this.setData({ categoryDialogId: id, showCategoryDialog: true })
  },

  // 选中某个分类
  onPickCategory(e) {
    const { key } = e.currentTarget.dataset
    const id = this.data.categoryDialogId
    this.patchRecord(id, { category: key })
    this.setData({ showCategoryDialog: false, categoryDialogId: '' })
  },

  // 关闭分类弹窗
  onCloseCategoryDialog() {
    this.setData({ showCategoryDialog: false, categoryDialogId: '' })
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
