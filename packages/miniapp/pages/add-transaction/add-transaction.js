const app = getApp()
const api = require('../../utils/api')
const { CATEGORIES, SPLIT_METHODS } = require('../../constants/ledger')

Page({
  data: {
    bookId: '',
    id: '',
    isEdit: false,
    myUserId: '',

    type: 'shared',
    amount: '',
    amountFocus: false,   // 唤起软键盘
    category: 'food',
    note: '',
    categories: CATEGORIES,
    splitMethods: SPLIT_METHODS,
    splitMethod: 'average',
    splitDetails: [], // 分账明细：ratio/shares/fixed 时存储每人的 weight 或 amount

    members: [],
    participantIds: [],
    participantMap: {},
    payerId: '',

    // 分账明细弹窗
    showSplitDialog: false,
    splitDialogTitle: '',
    splitDialogMode: '', // 'ratio' | 'shares' | 'fixed'
    splitDialogItems: [], // [{userId, nickname, avatar, value}]
    splitDialogValidation: '', // 校验提示文本

    images: [],
    location: null,
    spentAt: '',
    dateText: '',

    // 货币
    currency: 'CNY',
    currencySymbol: '¥',
    currencyIndex: 0,
    rates: [{ code: 'CNY', name: '人民币', symbol: '¥', rate: 1, label: '人民币 (CNY)' }],
    convertedText: '', // 折算后显示：'≈ ¥68.42'（CNY 时空）

    saving: false,
    initLoading: true, // 初始数据加载中：显示骨架屏，避免用户在数据未回填前操作被覆盖
  },

  onLoad(query) {
    const myUserId = (app.globalData.user || {}).id || ''
    const today = this.formatDate(new Date())
    this.setData({
      bookId: query.bookId,
      id: query.id || '',
      isEdit: !!query.id,
      myUserId,
      payerId: myUserId,
      spentAt: new Date().toISOString(),
      dateText: today,
    })
    wx.setNavigationBarTitle({ title: query.id ? '编辑账单' : '记一笔' })

    // 并行加载依赖数据；编辑态额外拉账单详情，全部完成后再关闭骨架屏
    const tasks = [this.loadRates(), this.loadMembers()]
    if (query.id) tasks.push(this.loadTransaction(query.id))
    Promise.all(tasks).finally(() => {
      this.setData({ initLoading: false })
      // 新建态：数据就绪后再唤起金额输入
      if (!this.data.isEdit) {
        setTimeout(() => this.setData({ amountFocus: true }), 120)
      }
    })
  },

  async loadRates() {
    try {
      const res = await api.exchangeRates()
      if (res && res.rates && res.rates.length) {
        // 给每项加 label，供 picker 显示
        const rates = res.rates.map((r) => ({ ...r, label: `${r.name} (${r.code})` }))
        const idx = Math.max(0, rates.findIndex((r) => r.code === this.data.currency))
        this.setData({ rates, currencyIndex: idx })
      }
    } catch (e) {}
  },

  async loadMembers() {
    try {
      const book = await api.bookDetail(this.data.bookId)
      const members = book.members || []
      this.setData({ members })
      // 新建态：默认全选参与人；编辑态由 loadTransaction 按 splits 回填
      if (!this.data.isEdit) {
        this.setParticipants(members.map((m) => m.userId))
      }
    } catch (e) {}
  },

  async loadTransaction(id) {
    try {
      const tx = await api.transactionDetail(id)
      // 编辑态优先展示 originalAmount / currency（非 CNY 时）
      const currency = tx.currency || 'CNY'
      const displayAmount =
        currency === 'CNY' || !tx.originalAmount
          ? tx.amount / 100
          : tx.originalAmount / 100

      this.setData({
        type: tx.type,
        amount: displayAmount.toString(),
        category: tx.category,
        note: tx.note,
        splitMethod: tx.splitMethod || 'average',
        payerId: tx.payerId,
        images: tx.images || [],
        location: tx.locationName
          ? { name: tx.locationName, address: tx.locationAddress, latitude: tx.latitude, longitude: tx.longitude }
          : null,
        spentAt: tx.spentAt,
        dateText: this.formatDate(new Date(tx.spentAt)),
        currency,
        currencySymbol: this.symbolOf(currency),
      })
      if (tx.splits && tx.splits.length) {
        this.setParticipants(tx.splits.map((s) => s.userId))
      }
      this.updateConverted()
    } catch (e) {}
  },

  /** 从 rates 中取当前币种符号 */
  symbolOf(code) {
    const r = (this.data.rates || []).find((x) => x.code === code)
    return r ? r.symbol : '¥'
  },

  /** 计算折算显示：CNY 时清空，其它币种时 "≈ ¥xx.xx" */
  updateConverted() {
    const { amount, currency, rates } = this.data
    if (currency === 'CNY' || !amount) {
      this.setData({ convertedText: '' })
      return
    }
    const rate = (rates.find((r) => r.code === currency) || {}).rate
    if (!rate) {
      this.setData({ convertedText: '' })
      return
    }
    const yuan = parseFloat(amount)
    if (!yuan || yuan <= 0) {
      this.setData({ convertedText: '' })
      return
    }
    const cny = yuan * rate
    this.setData({ convertedText: `≈ ¥${cny.toFixed(2)} CNY（汇率 ${rate}）` })
  },

  formatDate(d) {
    const p = (n) => (n < 10 ? '0' + n : '' + n)
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  },

  // 由 participantIds 生成 map，供 WXML 判断选中态（WXML 不支持方法调用）
  setParticipants(ids) {
    const map = {}
    ids.forEach((id) => (map[id] = true))
    this.setData({ participantIds: ids, participantMap: map })
  },

  // ===== 输入交互 =====
  onSwitchType(e) {
    this.setData({ type: e.currentTarget.dataset.type })
  },
  onAmountInput(e) {
    this.setData({ amount: e.detail.value })
    this.updateConverted()
  },
  onAmountBlur() {
    // 失焦后回置标记，下次 setData({amountFocus:true}) 才能再次生效
    this.setData({ amountFocus: false })
  },

  // picker 选中变化
  onCurrencyChange(e) {
    const idx = Number(e.detail.value)
    const r = this.data.rates[idx]
    if (!r) return
    this.setData({
      currency: r.code,
      currencySymbol: r.symbol,
      currencyIndex: idx,
    })
    this.updateConverted()
  },

  onOpenLogs() {
    if (!this.data.id) return
    wx.navigateTo({ url: `/pages/transaction-logs/transaction-logs?id=${this.data.id}` })
  },
  onPickCategory(e) {
    this.setData({ category: e.currentTarget.dataset.key })
  },
  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },
  onPickSplitMethod(e) {
    const method = e.currentTarget.dataset.key
    this.setData({ splitMethod: method })

    // 非平均分摊：打开分账明细弹窗
    if (method !== 'average') {
      this.openSplitDialog(method)
    } else {
      // 平均分摊：清空明细
      this.setData({ splitDetails: [] })
    }
  },

  // 打开分账明细弹窗
  openSplitDialog(mode) {
    const { participantIds, members, splitDetails, amount } = this.data
    if (participantIds.length === 0) {
      wx.showToast({ title: '请先选择参与人', icon: 'none' })
      return
    }

    const titles = {
      ratio: '按比例分账',
      shares: '按份额分账',
      fixed: '指定金额分账'
    }

    // 构建输入项：按参与人顺序
    const items = participantIds.map(userId => {
      const member = members.find(m => m.userId === userId) || {}
      const existing = splitDetails.find(s => s.userId === userId)
      let defaultValue = ''
      if (mode === 'ratio') {
        defaultValue = existing?.weight ? String(existing.weight) : ''
      } else if (mode === 'shares') {
        defaultValue = existing?.weight ? String(existing.weight) : '1'
      } else if (mode === 'fixed') {
        defaultValue = existing?.amount ? String(existing.amount / 100) : ''
      }

      return {
        userId,
        nickname: member.nickname || '成员',
        avatar: member.avatar || '',
        value: defaultValue
      }
    })

    this.setData({
      showSplitDialog: true,
      splitDialogMode: mode,
      splitDialogTitle: titles[mode] || '分账明细',
      splitDialogItems: items,
      splitDialogValidation: ''
    })
  },

  // 分账明细输入
  onSplitDialogInput(e) {
    const { index } = e.currentTarget.dataset
    const { value } = e.detail
    const items = this.data.splitDialogItems.slice()
    items[index].value = value
    this.setData({ splitDialogItems: items })
    this.validateSplitDialog()
  },

  // 校验分账明细
  validateSplitDialog() {
    const { splitDialogMode, splitDialogItems, amount } = this.data
    const yuan = parseFloat(amount)
    if (!yuan || yuan <= 0) {
      this.setData({ splitDialogValidation: '请先输入总金额' })
      return false
    }

    const totalCent = Math.round(yuan * 100)

    if (splitDialogMode === 'ratio') {
      // 按比例：总和应为100
      let sum = 0
      for (const item of splitDialogItems) {
        const val = parseFloat(item.value)
        if (isNaN(val) || val <= 0) {
          this.setData({ splitDialogValidation: '请输入有效的百分比（大于0）' })
          return false
        }
        sum += val
      }
      if (Math.abs(sum - 100) > 0.01) {
        this.setData({ splitDialogValidation: `当前总和：${sum.toFixed(2)}%，需等于100%` })
        return false
      }
      this.setData({ splitDialogValidation: '✓ 校验通过' })
      return true
    } else if (splitDialogMode === 'shares') {
      // 按份额：每份>0即可
      for (const item of splitDialogItems) {
        const val = parseFloat(item.value)
        if (isNaN(val) || val <= 0) {
          this.setData({ splitDialogValidation: '请输入有效的份数（大于0）' })
          return false
        }
      }
      // 计算每份金额
      const totalShares = splitDialogItems.reduce((s, item) => s + parseFloat(item.value || 0), 0)
      const perShare = (totalCent / totalShares).toFixed(2)
      this.setData({ splitDialogValidation: `✓ 每份约 ¥${perShare}` })
      return true
    } else if (splitDialogMode === 'fixed') {
      // 指定金额：总和应等于总金额
      let sum = 0
      for (const item of splitDialogItems) {
        const val = parseFloat(item.value)
        if (isNaN(val) || val < 0) {
          this.setData({ splitDialogValidation: '请输入有效的金额（≥0）' })
          return false
        }
        sum += val
      }
      const diff = Math.abs(sum - yuan)
      if (diff > 0.01) {
        const status = sum > yuan ? '超出' : '不足'
        this.setData({ splitDialogValidation: `当前总和：¥${sum.toFixed(2)}，${status} ¥${diff.toFixed(2)}` })
        return false
      }
      this.setData({ splitDialogValidation: '✓ 校验通过' })
      return true
    }

    return false
  },

  // 确认分账明细
  onSplitDialogConfirm() {
    if (!this.validateSplitDialog()) {
      wx.showToast({ title: '请检查输入', icon: 'none' })
      return
    }

    const { splitDialogMode, splitDialogItems } = this.data
    const details = splitDialogItems.map(item => {
      if (splitDialogMode === 'ratio' || splitDialogMode === 'shares') {
        return {
          userId: item.userId,
          weight: parseFloat(item.value)
        }
      } else {
        return {
          userId: item.userId,
          amount: Math.round(parseFloat(item.value) * 100)
        }
      }
    })

    this.setData({
      splitDetails: details,
      showSplitDialog: false
    })
    wx.showToast({ title: '已设置', icon: 'success' })
  },

  // 取消分账明细
  onSplitDialogCancel() {
    this.setData({
      showSplitDialog: false,
      splitMethod: 'average', // 回退到平均分摊
      splitDetails: []
    })
  },
  onPickPayer(e) {
    this.setData({ payerId: e.currentTarget.dataset.id })
  },
  onToggleParticipant(e) {
    const id = e.currentTarget.dataset.id
    const set = new Set(this.data.participantIds)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    this.setParticipants(Array.from(set))
  },
  onDateChange(e) {
    const dateText = e.detail.value
    // 保留当前时间部分
    const spentAt = new Date(`${dateText}T12:00:00`).toISOString()
    this.setData({ dateText, spentAt })
  },

  // ===== 位置 =====
  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        if (!res.name && !res.address) return
        this.setData({
          location: {
            name: res.name,
            address: res.address,
            latitude: res.latitude,
            longitude: res.longitude,
          },
        })
      },
      fail: (err) => {
        // 用户拒绝授权时引导开启
        if (err && /auth deny|authorize/.test(err.errMsg || '')) {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置中允许获取位置信息',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) wx.openSetting()
            },
          })
        }
      },
    })
  },
  onClearLocation() {
    this.setData({ location: null })
  },

  // ===== 图片 =====
  async onChooseImage() {
    const remain = 9 - this.data.images.length
    if (remain <= 0) {
      wx.showToast({ title: '最多 9 张', icon: 'none' })
      return
    }
    try {
      const res = await wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
      })
      wx.showLoading({ title: '上传中...' })
      const urls = []
      for (const f of res.tempFiles) {
        const url = await this.uploadImage(f.tempFilePath)
        urls.push(url)
      }
      wx.hideLoading()
      this.setData({ images: this.data.images.concat(urls) })
    } catch (e) {
      wx.hideLoading()
    }
  },

  uploadImage(filePath) {
    const baseUrl = app.globalData.apiBaseUrl
    const token = app.globalData.token
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${baseUrl}/upload/image`,
        filePath,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success(r) {
          try {
            const body = JSON.parse(r.data)
            if (body.code === 0) resolve(body.data.url)
            else reject(body)
          } catch (e) {
            reject(e)
          }
        },
        fail: reject,
      })
    })
  },

  onPreviewImage(e) {
    const { url } = e.currentTarget.dataset
    wx.previewImage({ current: url, urls: this.data.images })
  },
  onDeleteImage(e) {
    const { index } = e.currentTarget.dataset
    const images = this.data.images.slice()
    images.splice(index, 1)
    this.setData({ images })
  },

  // ===== 保存 =====
  async onSave() {
    const yuan = parseFloat(this.data.amount)
    if (!yuan || yuan <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    const originalAmount = Math.round(yuan * 100) // 用户输入的原币金额（分）

    // 结算金额：始终是 CNY（分）
    const currency = this.data.currency || 'CNY'
    const rateObj = (this.data.rates || []).find((r) => r.code === currency)
    const rate = rateObj ? rateObj.rate : 1
    const amount =
      currency === 'CNY' ? originalAmount : Math.round(originalAmount * rate)

    if (this.data.type === 'shared' && this.data.participantIds.length === 0) {
      wx.showToast({ title: '请选择参与人', icon: 'none' })
      return
    }

    if (this.data.saving) return
    this.setData({ saving: true })

    const loc = this.data.location
    const payload = {
      bookId: this.data.bookId,
      type: this.data.type,
      amount,
      currency,
      originalAmount,
      exchangeRate: rate,
      category: this.data.category,
      note: this.data.note,
      images: this.data.images,
      spentAt: this.data.spentAt,
      locationName: loc ? loc.name : '',
      locationAddress: loc ? loc.address : '',
      latitude: loc ? loc.latitude : undefined,
      longitude: loc ? loc.longitude : undefined,
    }
    if (this.data.type === 'shared') {
      const ids = this.data.participantIds
      payload.payerId = this.data.payerId
      payload.splitMethod = this.data.splitMethod
      payload.participantIds = ids

      // 根据分账方式传递 splits
      if (this.data.splitMethod === 'average') {
        // 平均分摊：后端自动计算，不传 splits
      } else if (this.data.splitDetails.length > 0) {
        // 有明细：直接使用
        payload.splits = this.data.splitDetails
      } else {
        // 缺少明细：回退到默认值
        if (this.data.splitMethod === 'ratio' || this.data.splitMethod === 'shares') {
          payload.splits = ids.map((userId) => ({ userId, amount: 0, weight: 1 }))
        } else if (this.data.splitMethod === 'fixed') {
          const n = ids.length || 1
          const base = Math.floor(amount / n)
          let rem = amount - base * n
          payload.splits = ids.map((userId) => {
            const extra = rem > 0 ? 1 : 0
            rem -= extra
            return { userId, amount: base + extra }
          })
        }
      }
    }

    try {
      if (this.data.isEdit) {
        await api.updateTransaction(this.data.id, payload)
      } else {
        await api.createTransaction(payload)
      }
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' })
      this.setData({ saving: false })
    }
  },

  onDelete() {
    wx.showModal({
      title: '删除账单',
      content: '确定删除这笔账单吗？',
      confirmColor: '#fa9583',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.deleteTransaction(this.data.id)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 500)
        } catch (e) {}
      },
    })
  },
})
