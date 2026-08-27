const app = getApp()
const { CATEGORIES, SPLIT_METHODS, PAYMENT_METHODS } = require('../../constants/ledger')

/**
 * 通用记账表单组件
 * 被 add-transaction（单条）和 ocr-batch-edit（多条 swiper）复用。
 *
 * 属性：
 *   members   - 账本成员 [{userId, nickname, avatar}]
 *   rates     - 汇率列表 [{code,name,symbol,rate,label}]
 *   myUserId  - 当前用户 id（默认付款人）
 *   initial   - 初始表单值（编辑态/OCR 预填）；不传则用默认值
 *   autofocus - 是否自动聚焦金额输入框
 *
 * 对外方法（父组件 selectComponent 后调用）：
 *   buildPayload() → { ok, message, payload }  组装并校验后端入参
 *   getAmount()    → 当前金额字符串（供父级判断是否为空）
 */
Component({
  properties: {
    members: { type: Array, value: [] },
    rates: {
      type: Array,
      value: [{ code: 'CNY', name: '人民币', symbol: '¥', rate: 1, label: '人民币 (CNY)' }],
    },
    myUserId: { type: String, value: '' },
    initial: { type: Object, value: null },
    autofocus: { type: Boolean, value: false },
  },

  data: {
    type: 'shared',
    amount: '',
    amountFocus: false,
    category: 'food',
    note: '',
    categories: CATEGORIES,
    splitMethods: SPLIT_METHODS,
    splitMethod: 'average',
    splitDetails: [],

    participantIds: [],
    participantMap: {},
    payerId: '',

    showSplitDialog: false,
    splitDialogTitle: '',
    splitDialogMode: '',
    splitDialogItems: [],
    splitDialogValidation: '',
    splitDialogValid: false,

    images: [],
    location: null,
    spentAt: '',
    dateText: '',

    currency: 'CNY',
    currencySymbol: '¥',
    currencyIndex: 0,
    convertedText: '',

    paymentMethods: PAYMENT_METHODS,
    paymentMethod: 'wechat',

    // 分账关系预览：付款人视角(别人给我) / 参与人视角(我给付款人)
    settlePreview: { mode: '', payerName: '', myPayText: '', items: [] },
  },

  lifetimes: {
    attached() {
      this.initForm()
      this._inited = true
    },
  },

  observers: {
    // 父级异步加载完成员后回填参与人（仅在未手动改过时）
    members(list) {
      if (!this._participantsTouched && list && list.length && this.data.type === 'shared') {
        this.setParticipants(list.map((m) => m.userId))
      }
    },
    // initial 变化时重新初始化（多条复用同一组件实例时，切换/删除记录后需重置表单）
    initial() {
      if (this._inited) {
        this._participantsTouched = false
        this.initForm()
      }
    },
    // 影响分账关系的字段变化时，重算预览
    'type, amount, payerId, participantIds, splitMethod, splitDetails, currency'() {
      this.computeSettlePreview()
    },
  },

  methods: {
    initForm() {
      const init = this.properties.initial || {}
      const myUserId = this.properties.myUserId
      const now = new Date()
      const spentAt = init.spentAt || now.toISOString()
      const currency = init.currency || 'CNY'

      this.setData({
        type: init.type || 'shared',
        amount: init.amount != null ? String(init.amount) : '',
        category: init.category || 'food',
        note: init.note || '',
        images: init.images || [],
        splitMethod: init.splitMethod || 'average',
        paymentMethod: init.paymentMethod || 'wechat',
        payerId: init.payerId || myUserId,
        currency,
        currencySymbol: this.symbolOf(currency),
        currencyIndex: Math.max(0, this.properties.rates.findIndex((r) => r.code === currency)),
        location: init.location || null,
        spentAt,
        dateText: this.formatDate(new Date(spentAt)),
      })

      // 参与人：优先用 initial.participantIds，否则默认全体成员
      if (init.participantIds && init.participantIds.length) {
        this._participantsTouched = true
        this.setParticipants(init.participantIds)
      } else if (this.properties.members.length) {
        this.setParticipants(this.properties.members.map((m) => m.userId))
      }

      // 回填分账明细：非平分方式（fixed/ratio/shares）需恢复每人金额/权重，
      // 否则编辑态会因 splitDetails 为空而退回平分。fixed 用 amount(分)，ratio/shares 用 weight。
      const method = init.splitMethod || 'average'
      if (method !== 'average' && init.splits && init.splits.length) {
        const details = init.splits.map((s) =>
          method === 'fixed'
            ? { userId: s.userId, amount: s.amount }
            : { userId: s.userId, weight: s.weight },
        )
        this.setData({ splitDetails: details })
      } else {
        this.setData({ splitDetails: [] })
      }

      this.updateConverted()

      if (this.properties.autofocus) {
        setTimeout(() => this.setData({ amountFocus: true }), 150)
      }
    },

    // ---- 派生工具 ----
    symbolOf(code) {
      const r = (this.properties.rates || []).find((x) => x.code === code)
      return r ? r.symbol : '¥'
    },
    formatDate(d) {
      const p = (n) => (n < 10 ? '0' + n : '' + n)
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    },
    setParticipants(ids) {
      const map = {}
      ids.forEach((id) => (map[id] = true))
      this.setData({ participantIds: ids, participantMap: map })
    },
    updateConverted() {
      const { amount, currency } = this.data
      const rates = this.properties.rates
      if (currency === 'CNY' || !amount) {
        this.setData({ convertedText: '' })
        return
      }
      const rate = (rates.find((r) => r.code === currency) || {}).rate
      const yuan = parseFloat(amount)
      if (!rate || !yuan || yuan <= 0) {
        this.setData({ convertedText: '' })
        return
      }
      this.setData({ convertedText: `≈ ¥${(yuan * rate).toFixed(2)} CNY（汇率 ${rate}）` })
    },

    // ---- 交互 ----
    onSwitchType(e) {
      this.setData({ type: e.currentTarget.dataset.type })
    },
    onAmountInput(e) {
      this.setData({ amount: e.detail.value })
      this.updateConverted()
    },
    onAmountBlur() {
      this.setData({ amountFocus: false })
    },
    onCurrencyChange(e) {
      const idx = Number(e.detail.value)
      const r = this.properties.rates[idx]
      if (!r) return
      this.setData({ currency: r.code, currencySymbol: r.symbol, currencyIndex: idx })
      this.updateConverted()
    },
    onPickCategory(e) {
      this.setData({ category: e.currentTarget.dataset.key })
    },
    onPickPaymentMethod(e) {
      this.setData({ paymentMethod: e.currentTarget.dataset.key })
    },
    onNoteInput(e) {
      this.setData({ note: e.detail.value })
    },
    onPickPayer(e) {
      this.setData({ payerId: e.currentTarget.dataset.id })
    },
    onToggleParticipant(e) {
      this._participantsTouched = true
      const id = e.currentTarget.dataset.id
      const set = new Set(this.data.participantIds)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      this.setParticipants(Array.from(set))
    },
    onDateChange(e) {
      const dateText = e.detail.value
      this.setData({ dateText, spentAt: new Date(`${dateText}T12:00:00`).toISOString() })
    },

    // ---- 位置 ----
    onChooseLocation() {
      const doChoose = () => {
        wx.chooseLocation({
          success: (res) => {
            if (!res.name && !res.address) return
            this.setData({
              location: { name: res.name, address: res.address, latitude: res.latitude, longitude: res.longitude },
            })
          },
          fail: (err) => {
            console.log('chooseLocation fail:', err)
            const msg = err.errMsg || ''
            if (msg.includes('cancel')) return
            wx.showToast({ title: '选择位置失败', icon: 'none' })
          },
        })
      }
      // 先走隐私授权（未注册自定义弹窗时微信会弹官方默认弹窗）；低版本基础库无此 API 则直接调用
      if (wx.requirePrivacyAuthorize) {
        wx.requirePrivacyAuthorize({
          success: doChoose,
          fail: () => {
            wx.showToast({ title: '需要同意隐私协议才能使用该功能', icon: 'none' })
          },
        })
      } else {
        doChoose()
      }
    },
    onClearLocation() {
      this.setData({ location: null })
    },

    // ---- 图片 ----
    async onChooseImage() {
      const remain = 9 - this.data.images.length
      if (remain <= 0) { wx.showToast({ title: '最多 9 张', icon: 'none' }); return }
      try {
        const res = await wx.chooseMedia({ count: remain, mediaType: ['image'], sourceType: ['camera', 'album'] })
        wx.showLoading({ title: '上传中...', mask: true })
        const urls = []
        // 传统 for 循环，避免 for...of 触发增强编译注入 @babel/runtime helper
        for (let i = 0; i < res.tempFiles.length; i++) {
          urls.push(await this.uploadImage(res.tempFiles[i].tempFilePath))
        }
        wx.hideLoading()
        this.setData({ images: this.data.images.concat(urls) })
      } catch (e) { wx.hideLoading() }
    },
    uploadImage(filePath) {
      const baseUrl = app.globalData.apiBaseUrl
      const token = app.globalData.token
      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${baseUrl}/upload/image`, filePath, name: 'file',
          header: token ? { Authorization: `Bearer ${token}` } : {},
          success(r) {
            try { const b = JSON.parse(r.data); b.code === 0 ? resolve(b.data.url) : reject(b) }
            catch (e) { reject(e) }
          },
          fail: reject,
        })
      })
    },
    onPreviewImage(e) {
      wx.previewImage({ current: e.currentTarget.dataset.url, urls: this.data.images })
    },
    onDeleteImage(e) {
      const images = this.data.images.slice()
      images.splice(e.currentTarget.dataset.index, 1)
      this.setData({ images })
    },

    // ---- 分账方式 + 明细弹窗 ----
    onPickSplitMethod(e) {
      const method = e.currentTarget.dataset.key
      this.setData({ splitMethod: method })
      if (method !== 'average') this.openSplitDialog(method)
      else this.setData({ splitDetails: [] })
    },
    openSplitDialog(mode) {
      const { participantIds, splitDetails } = this.data
      const members = this.properties.members
      if (participantIds.length === 0) {
        wx.showToast({ title: '请先选择参与人', icon: 'none' })
        return
      }
      const titles = { ratio: '按比例分账', shares: '按份额分账', fixed: '指定金额分账' }
      const items = participantIds.map((userId) => {
        const member = members.find((m) => m.userId === userId) || {}
        const existing = splitDetails.find((s) => s.userId === userId)
        let defaultValue = ''
        if (mode === 'ratio') defaultValue = existing?.weight ? String(existing.weight) : ''
        else if (mode === 'shares') defaultValue = existing?.weight ? String(existing.weight) : '1'
        else if (mode === 'fixed') defaultValue = existing?.amount ? String(existing.amount / 100) : ''
        return { userId, nickname: member.nickname || '成员', avatar: member.avatar || '', value: defaultValue }
      })
      this.setData({
        showSplitDialog: true, splitDialogMode: mode,
        splitDialogTitle: titles[mode] || '分账明细', splitDialogItems: items,
        splitDialogValidation: '', splitDialogValid: false,
      })
    },
    onSplitDialogInput(e) {
      const items = this.data.splitDialogItems.slice()
      items[e.currentTarget.dataset.index].value = e.detail.value
      this.setData({ splitDialogItems: items })
      this.validateSplitDialog()
    },
    setSplitValidation(text, valid) {
      this.setData({ splitDialogValidation: text, splitDialogValid: valid })
    },
    validateSplitDialog() {
      const { splitDialogMode, splitDialogItems, amount } = this.data
      const yuan = parseFloat(amount)
      if (!yuan || yuan <= 0) { this.setSplitValidation('请先输入总金额', false); return false }
      const totalCent = Math.round(yuan * 100)
      if (splitDialogMode === 'ratio') {
        let sum = 0
        for (let i = 0; i < splitDialogItems.length; i++) {
          const v = parseFloat(splitDialogItems[i].value)
          if (isNaN(v) || v <= 0) { this.setSplitValidation('请输入有效的百分比（大于0）', false); return false }
          sum += v
        }
        if (Math.abs(sum - 100) > 0.01) { this.setSplitValidation(`当前总和：${sum.toFixed(2)}%，需等于100%`, false); return false }
        this.setSplitValidation('✓ 校验通过', true); return true
      } else if (splitDialogMode === 'shares') {
        for (let i = 0; i < splitDialogItems.length; i++) {
          const v = parseFloat(splitDialogItems[i].value)
          if (isNaN(v) || v <= 0) { this.setSplitValidation('请输入有效的份数（大于0）', false); return false }
        }
        const totalShares = splitDialogItems.reduce((s, it) => s + parseFloat(it.value || 0), 0)
        this.setSplitValidation(`✓ 每份约 ¥${(totalCent / totalShares / 100).toFixed(2)}`, true); return true
      } else if (splitDialogMode === 'fixed') {
        let sum = 0
        for (let i = 0; i < splitDialogItems.length; i++) {
          const v = parseFloat(splitDialogItems[i].value)
          if (isNaN(v) || v < 0) { this.setSplitValidation('请输入有效的金额（≥0）', false); return false }
          sum += v
        }
        const diff = Math.abs(sum - yuan)
        if (diff > 0.01) {
          const status = sum > yuan ? '超出' : '不足'
          this.setSplitValidation(`当前总和：¥${sum.toFixed(2)}，${status} ¥${diff.toFixed(2)}`, false); return false
        }
        this.setSplitValidation('✓ 校验通过', true); return true
      }
      return false
    },
    onSplitDialogConfirm() {
      if (!this.validateSplitDialog()) { wx.showToast({ title: '请检查输入', icon: 'none' }); return }
      const { splitDialogMode, splitDialogItems } = this.data
      const details = splitDialogItems.map((it) =>
        splitDialogMode === 'fixed'
          ? { userId: it.userId, amount: Math.round(parseFloat(it.value) * 100) }
          : { userId: it.userId, weight: parseFloat(it.value) },
      )
      this.setData({ splitDetails: details, showSplitDialog: false })
      wx.showToast({ title: '已设置', icon: 'success' })
    },
    onSplitDialogCancel() {
      this.setData({ showSplitDialog: false, splitMethod: 'average', splitDetails: [] })
    },

    // ---- 对外：读取金额 ----
    getAmount() {
      return this.data.amount
    },

    // 计算每个参与人应承担的份额（分），返回 { userId: cents }
    perShareMap(amountCent) {
      const ids = this.data.participantIds || []
      const n = ids.length
      const map = {}
      if (n === 0 || amountCent <= 0) return map
      const method = this.data.splitMethod
      const details = this.data.splitDetails || []

      if (method === 'fixed' && details.length > 0) {
        details.forEach((d) => (map[d.userId] = d.amount || 0))
        return map
      }
      if ((method === 'ratio' || method === 'shares') && details.length > 0) {
        const totalWeight = details.reduce((s, d) => s + (d.weight || 0), 0)
        if (totalWeight > 0) {
          let allocated = 0
          details.forEach((d, i) => {
            let share
            if (i === details.length - 1) share = amountCent - allocated
            else {
              share = Math.round((amountCent * (d.weight || 0)) / totalWeight)
              allocated += share
            }
            map[d.userId] = share
          })
          return map
        }
      }
      // 默认（average 或无明细）：均摊，余数分给前几位
      const base = Math.floor(amountCent / n)
      let rem = amountCent - base * n
      ids.forEach((id) => {
        const extra = rem > 0 ? 1 : 0
        rem -= extra
        map[id] = base + extra
      })
      return map
    },

    // 计算分账关系预览
    computeSettlePreview() {
      const empty = { mode: '', payerName: '', myPayText: '', items: [] }
      if (this.data.type !== 'shared') {
        this.setData({ settlePreview: empty })
        return
      }
      const yuan = parseFloat(this.data.amount)
      const ids = this.data.participantIds || []
      if (!yuan || yuan <= 0 || ids.length === 0) {
        this.setData({ settlePreview: empty })
        return
      }
      const currency = this.data.currency || 'CNY'
      const rateObj = (this.properties.rates || []).find((r) => r.code === currency)
      const rate = rateObj ? rateObj.rate : 1
      const amountCent = currency === 'CNY' ? Math.round(yuan * 100) : Math.round(yuan * 100 * rate)

      const myUserId = this.properties.myUserId
      const payerId = this.data.payerId
      const members = this.properties.members || []
      const nameOf = (uid) => {
        const m = members.find((x) => x.userId === uid)
        return m ? m.nickname : '成员'
      }
      const shareMap = this.perShareMap(amountCent)

      if (payerId === myUserId) {
        // 付款人视角：其他参与人各自应还给我的份额
        const items = ids
          .filter((uid) => uid !== myUserId)
          .map((uid) => ({
            nickname: nameOf(uid),
            amountText: ((shareMap[uid] || 0) / 100).toFixed(2),
          }))
          .filter((it) => Number(it.amountText) > 0)
        this.setData({ settlePreview: { mode: 'payer', payerName: '', myPayText: '', items } })
      } else if (ids.indexOf(myUserId) !== -1) {
        // 参与人视角：我应付给付款人的份额
        const myShare = (shareMap[myUserId] || 0) / 100
        this.setData({
          settlePreview: {
            mode: 'participant',
            payerName: nameOf(payerId),
            myPayText: myShare.toFixed(2),
            items: [],
          },
        })
      } else {
        this.setData({ settlePreview: empty })
      }
    },

    // ---- 对外：组装 + 校验后端 payload ----
    buildPayload(bookId) {
      const yuan = parseFloat(this.data.amount)
      if (!yuan || yuan <= 0) return { ok: false, message: '请输入金额' }
      const originalAmount = Math.round(yuan * 100)
      const currency = this.data.currency || 'CNY'
      const rateObj = (this.properties.rates || []).find((r) => r.code === currency)
      const rate = rateObj ? rateObj.rate : 1
      const amount = currency === 'CNY' ? originalAmount : Math.round(originalAmount * rate)

      if (this.data.type === 'shared' && this.data.participantIds.length === 0) {
        return { ok: false, message: '请选择参与人' }
      }

      const loc = this.data.location
      const payload = {
        bookId,
        type: this.data.type,
        amount, currency, originalAmount, exchangeRate: rate,
        category: this.data.category,
        paymentMethod: this.data.paymentMethod || 'wechat',
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
        if (this.data.splitMethod === 'average') {
          // 后端自动均摊
        } else if (this.data.splitDetails.length > 0) {
          payload.splits = this.data.splitDetails
        } else if (this.data.splitMethod === 'ratio' || this.data.splitMethod === 'shares') {
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
      return { ok: true, payload }
    },
  },
})
