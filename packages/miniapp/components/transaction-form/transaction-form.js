const app = getApp()
const { CATEGORIES, SPLIT_METHODS, PAYMENT_METHODS } = require('../../constants/ledger')

// 分账方式 key → 名称映射（分账预览里显示当前方式）
const SPLIT_METHOD_MAP = {}
SPLIT_METHODS.forEach((m) => (SPLIT_METHOD_MAP[m.key] = m.name))

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
    // 所属账本 id：查重接口需要（金额失焦时校验该账本内是否已有相同金额账单）
    bookId: { type: String, value: '' },
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
    currencyUnit: '元', // 指定金额分账输入框的单位（跟随币种）

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

    // 重复金额提示
    duplicateWarning: '',
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

      // 记录初始币种 + 记账时快照汇率：编辑保存时若币种未变，沿用快照汇率，
      // 避免用当日汇率重算 CNY amount 导致金额漂移（改了币种则用当前汇率）
      this._initialCurrency = currency
      this._initialRate =
        init.exchangeRate != null && init.exchangeRate > 0 ? init.exchangeRate : null

      // 参与人：优先用 initial.participantIds，否则默认全体成员
      if (init.participantIds && init.participantIds.length) {
        this._participantsTouched = true
        this.setParticipants(init.participantIds)
      } else if (this.properties.members.length) {
        this.setParticipants(this.properties.members.map((m) => m.userId))
      }

      // 三种分账方式各存一份独立草稿（弹窗回显专用，避免 ratio 的百分比串到 shares 的份数）。
      // 键为 userId，值为弹窗输入字符串。splitDetails 仍是「当前生效明细」，用于计算/提交。
      this._splitDrafts = { ratio: {}, shares: {}, fixed: {} }

      // 回填分账明细：非平分方式（fixed/ratio/shares）需恢复每人金额/权重，
      // 否则编辑态会因 splitDetails 为空而退回平分。fixed 用 amount(原币分)，ratio/shares 用 weight。
      const method = init.splitMethod || 'average'
      if (method !== 'average' && init.splits && init.splits.length) {
        // 后端 splits[].amount 存的是 CNY 分；splitDetails 约定存原币分。
        // 外币 fixed 编辑时需按快照汇率把 CNY 分还原成原币分，否则弹窗显示错、保存会二次乘汇率。
        const backRate =
          method === 'fixed' && currency !== 'CNY' && this._initialRate
            ? this._initialRate
            : 1
        const details = init.splits.map((s) =>
          method === 'fixed'
            ? { userId: s.userId, amount: Math.round((s.amount || 0) / backRate) }
            : { userId: s.userId, weight: s.weight },
        )
        this.setData({ splitDetails: details })
        // 同步把编辑态的值写进对应模式的草稿，便于打开弹窗回显
        const draft = {}
        details.forEach((d) => {
          draft[d.userId] = method === 'fixed' ? String((d.amount || 0) / 100) : String(d.weight)
        })
        this._splitDrafts[method] = draft
        // 编辑态：快照指向已确认的方案，取消弹窗时恢复到它
        this._prevSplitMethod = method
        this._prevSplitDetails = details
      } else {
        this.setData({ splitDetails: [] })
        // 无已确认方案（平均分摊/新建）：取消时回退平均分摊
        this._prevSplitMethod = 'average'
        this._prevSplitDetails = []
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
    async onAmountBlur() {
      this.setData({ amountFocus: false })
      // 金额失焦时检查重复
      await this.checkDuplicate()
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
      // 支付方式变化后重新查重（金额+支付方式联合判断）
      this.checkDuplicate()
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
      if (method !== 'average') {
        // 不在此处记快照：快照指向「最后一次确认过的方案」（在 initForm / 确认时维护）。
        // 否则先点 average 再点本方式，会把临时的 average 误记为快照，取消后错退到 average。
        this.setData({ splitMethod: method })
        this.openSplitDialog(method)
      } else {
        // 切到平均分摊：保留 splitDetails（average 计算/提交都不看它），
        // 以便之后切回按比例/份额/指定金额时能回显上次填的明细
        this.setData({ splitMethod: 'average' })
      }
    },
    openSplitDialog(mode) {
      const { participantIds } = this.data
      const members = this.properties.members
      if (participantIds.length === 0) {
        wx.showToast({ title: '请先选择参与人', icon: 'none' })
        return
      }
      const titles = { ratio: '按比例分账', shares: '按份额分账', fixed: '指定金额分账' }
      // 从「本模式」的独立草稿回显；无草稿时用各自默认值（份额默认 1，其余留空）。
      // 三模式草稿隔离，切换不再串味（比例的 30% 不会当成份额的 30 份）。
      const draft = (this._splitDrafts && this._splitDrafts[mode]) || {}
      const items = participantIds.map((userId) => {
        const member = members.find((m) => m.userId === userId) || {}
        const saved = draft[userId]
        let defaultValue = saved != null && saved !== '' ? saved : (mode === 'shares' ? '1' : '')
        return { userId, nickname: member.nickname || '成员', avatar: member.avatar || '', value: defaultValue }
      })
      this.setData({
        showSplitDialog: true, splitDialogMode: mode,
        splitDialogTitle: titles[mode] || '分账明细', splitDialogItems: items,
        splitDialogValidation: '', splitDialogValid: false,
        // 指定金额分账的单位跟随当前币种（CNY 显示「元」，外币显示币种代码）
        currencyUnit: this.data.currency === 'CNY' ? '元' : this.data.currency,
      })
    },
    onSplitDialogInput(e) {
      const idx = e.currentTarget.dataset.index
      const mode = this.data.splitDialogMode
      const items = this.data.splitDialogItems.slice()
      let val = e.detail.value

      // 该模式的「总数」：指定金额=总金额(元)，按比例=100(%)，按份额无固定总数(NaN)
      const modeTotal =
        mode === 'fixed' ? parseFloat(this.data.amount) : mode === 'ratio' ? 100 : NaN

      // 单框钳制在 [0, 总数]（type=digit 无原生 min/max，手动处理）
      if (!isNaN(modeTotal) && modeTotal > 0) {
        const cur = parseFloat(val)
        if (!isNaN(cur)) {
          if (cur < 0) {
            val = '0'
          } else if (cur > modeTotal) {
            // 超出总数则截断（用原始字符串，避免 toFixed 引入多余小数）
            val = String(modeTotal)
          }
        }
      }
      items[idx].value = val

      // 自动补足最后一人（fixed / ratio，都有明确总数）：
      //   - 恰好 2 人：改一个，另一个始终自动 = 总数 - 这个
      //   - 3 人及以上：只补空缺，当「除当前框外恰好剩一个空框」时把它自动算出；全部填满后不再联动
      if (!isNaN(modeTotal) && modeTotal > 0) {
        let targetIdx = -1
        if (items.length === 2) {
          targetIdx = idx === 0 ? 1 : 0
        } else if (items.length >= 3) {
          const otherEmpties = []
          for (let i = 0; i < items.length; i++) {
            if (i !== idx && (items[i].value === '' || items[i].value == null)) otherEmpties.push(i)
          }
          if (otherEmpties.length === 1) targetIdx = otherEmpties[0]
        }
        if (targetIdx !== -1) {
          const cur = parseFloat(val)
          if (!isNaN(cur) && cur >= 0) {
            // 用「百分之一」精度(×100 取整)做差，规避 0.1+0.2 类浮点误差；fixed 即分、ratio 即 0.01%
            let sumOthersUnit = 0
            for (let i = 0; i < items.length; i++) {
              if (i === targetIdx) continue
              sumOthersUnit += Math.round((parseFloat(items[i].value) || 0) * 100)
            }
            const restUnit = Math.round(modeTotal * 100) - sumOthersUnit
            // 已填之和已超总数则不硬填负数，留空交给校验提示
            if (restUnit >= 0) items[targetIdx].value = String(restUnit / 100)
          }
        }
      }
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
        this.setSplitValidation(`✓ 每份约 ${this.data.currencySymbol}${(totalCent / totalShares / 100).toFixed(2)}`, true); return true
      } else if (splitDialogMode === 'fixed') {
        let sum = 0
        for (let i = 0; i < splitDialogItems.length; i++) {
          const v = parseFloat(splitDialogItems[i].value)
          if (isNaN(v) || v < 0) { this.setSplitValidation('请输入有效的金额（≥0）', false); return false }
          sum += v
        }
        const diff = Math.abs(sum - yuan)
        if (diff > 0.01) {
          const sym = this.data.currencySymbol
          const status = sum > yuan ? '超出' : '不足'
          this.setSplitValidation(`当前总和：${sym}${sum.toFixed(2)}，${status} ${sym}${diff.toFixed(2)}`, false); return false
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
      // 把本次输入存进「本模式」草稿，下次打开同模式时回显（切到其他模式不受影响）
      if (!this._splitDrafts) this._splitDrafts = { ratio: {}, shares: {}, fixed: {} }
      const draft = {}
      splitDialogItems.forEach((it) => (draft[it.userId] = it.value))
      this._splitDrafts[splitDialogMode] = draft
      // 确认成功 → 本方案成为「最后确认的方案」，更新快照供后续取消时恢复
      this._prevSplitMethod = splitDialogMode
      this._prevSplitDetails = details
      this.setData({ splitDetails: details, showSplitDialog: false })
      wx.showToast({ title: '已设置', icon: 'success' })
    },
    onSplitDialogCancel() {
      // 取消 = 回到打开弹窗前的状态（有快照则恢复，否则回退平均分摊兜底）
      this.setData({
        showSplitDialog: false,
        splitMethod: this._prevSplitMethod || 'average',
        splitDetails: this._prevSplitDetails || [],
      })
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
        // details[].amount 是原币分；amountCent 是 CNY 分。
        // 币种一致（CNY）时原样用；外币需按汇率转成 CNY 分，末位差值补足保证总和 = amountCent。
        const currency = this.data.currency || 'CNY'
        if (currency === 'CNY') {
          details.forEach((d) => (map[d.userId] = d.amount || 0))
        } else {
          const rateObj = (this.properties.rates || []).find((r) => r.code === currency)
          const rate = rateObj ? rateObj.rate : 1
          let allocated = 0
          details.forEach((d, i) => {
            let share
            if (i === details.length - 1) {
              share = amountCent - allocated
            } else {
              share = Math.round((d.amount || 0) * rate)
              allocated += share
            }
            map[d.userId] = share
          })
        }
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

      // 分账方式标签 + 每人明细文本（按比例→百分比，按份额→份数；平均/指定金额不额外标注）
      const method = this.data.splitMethod
      const methodLabel = SPLIT_METHOD_MAP[method] || ''
      const details = this.data.splitDetails || []
      const detailTextOf = (uid) => {
        if (method !== 'ratio' && method !== 'shares') return ''
        const d = details.find((x) => x.userId === uid)
        if (!d || d.weight == null) return ''
        return method === 'ratio' ? `${d.weight}%` : `${d.weight} 份`
      }

      if (payerId === myUserId) {
        // 付款人视角：其他参与人各自应还给我的份额
        const items = ids
          .filter((uid) => uid !== myUserId)
          .map((uid) => ({
            nickname: nameOf(uid),
            amountText: ((shareMap[uid] || 0) / 100).toFixed(2),
            detailText: detailTextOf(uid),
          }))
          .filter((it) => Number(it.amountText) > 0)
        this.setData({ settlePreview: { mode: 'payer', methodLabel, payerName: '', myPayText: '', myDetailText: '', items } })
      } else if (ids.indexOf(myUserId) !== -1) {
        // 参与人视角：我应付给付款人的份额
        const myShare = (shareMap[myUserId] || 0) / 100
        this.setData({
          settlePreview: {
            mode: 'participant',
            methodLabel,
            payerName: nameOf(payerId),
            myPayText: myShare.toFixed(2),
            myDetailText: detailTextOf(myUserId),
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
      const currentRate = rateObj ? rateObj.rate : 1
      // 币种未改动且存在记账时快照汇率 → 沿用快照，避免无关编辑用当日汇率重算导致金额漂移；
      // 改了币种（或新建）→ 用当前汇率
      const rate =
        currency !== 'CNY' && currency === this._initialCurrency && this._initialRate
          ? this._initialRate
          : currentRate
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
          // 有明细（弹窗确认过）：ratio/shares 直接用 weight，fixed 需汇率转换
          if (this.data.splitMethod === 'fixed' && this.data.currency !== 'CNY') {
            // 外币 fixed：splitDetails 存的是原币分，需乘汇率转 CNY 分，且总和要精确等于 amount（避免舍入差）
            const rateObj = (this.properties.rates || []).find((r) => r.code === this.data.currency)
            const rate = rateObj ? rateObj.rate : 1
            const details = this.data.splitDetails.slice()
            let sum = 0
            const converted = details.map((d, i) => {
              // 最后一个用差值补足，其他按汇率四舍五入
              if (i === details.length - 1) {
                return { userId: d.userId, amount: amount - sum }
              } else {
                const amountCNY = Math.round(d.amount * rate)
                sum += amountCNY
                return { userId: d.userId, amount: amountCNY }
              }
            })
            payload.splits = converted
          } else {
            // CNY 的 fixed 或 ratio/shares：直接用 splitDetails
            payload.splits = this.data.splitDetails
          }
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

    /** 检查重复金额：金额失焦时调用，发现重复则显示黄色提示 */
    async checkDuplicate() {
      const { amount, currency } = this.data
      const bookId = this.properties.bookId
      const excludeId = this.properties.initial?.id // 编辑态排除自己

      // 金额为空或无效，清空提示
      if (!amount || !bookId) {
        this.setData({ duplicateWarning: '' })
        return
      }

      const yuan = parseFloat(amount)
      if (!yuan || yuan <= 0) {
        this.setData({ duplicateWarning: '' })
        return
      }

      try {
        // 换算成分（与提交逻辑一致）
        const originalAmount = Math.round(yuan * 100)
        const rateObj = (this.properties.rates || []).find((r) => r.code === currency)
        const rate = rateObj ? rateObj.rate : 1
        const amountInCents = currency === 'CNY' ? originalAmount : Math.round(originalAmount * rate)

        const paymentMethod = this.data.paymentMethod || 'wechat'
        const api = require('../../utils/api')
        const res = await api.checkDuplicateAmount(bookId, amountInCents, paymentMethod, excludeId)

        if (res.count > 0) {
          this.setData({ duplicateWarning: `该账本存在 ${res.count} 笔相同金额、相同支付方式的账单，请留意重复` })
        } else {
          this.setData({ duplicateWarning: '' })
        }
      } catch (e) {
        // 查重失败不阻塞表单，静默降级
        console.warn('checkDuplicate failed:', e)
        this.setData({ duplicateWarning: '' })
      }
    },
  },
})
