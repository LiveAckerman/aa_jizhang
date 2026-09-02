/**
 * 业务接口封装：账本 / 分组 / 记账 / 汇率 / 日志 / 上传
 */
const { request, getBaseURL } = require('./request')

const api = {
  // ===== 账本 =====
  createBook: (data) => request({ url: '/books', method: 'POST', data }),
  listBooks: (groupId) => {
    const q = groupId ? `?groupId=${encodeURIComponent(groupId)}` : ''
    return request({ url: `/books${q}` })
  },
  bookDetail: (id) => request({ url: `/books/${id}` }),
  updateBook: (id, data) => request({ url: `/books/${id}`, method: 'PATCH', data }),
  deleteBook: (id) => request({ url: `/books/${id}`, method: 'DELETE' }),
  inviteInfo: (code) => request({ url: `/books/invite/${code}` }),
  joinBook: (code, displayName) =>
    request({ url: `/books/join/${code}`, method: 'POST', data: { displayName } }),
  removeMember: (bookId, userId) =>
    request({ url: `/books/${bookId}/members/${userId}`, method: 'DELETE' }),
  leaveBook: (bookId) => request({ url: `/books/${bookId}/leave`, method: 'POST' }),
  copyBook: (bookId, data) =>
    request({ url: `/books/${bookId}/copy`, method: 'POST', data }),

  // ===== 账本分组 =====
  listGroups: () => request({ url: '/book-groups' }),
  createGroup: (name) => request({ url: '/book-groups', method: 'POST', data: { name } }),
  renameGroup: (id, name) =>
    request({ url: `/book-groups/${id}`, method: 'PATCH', data: { name } }),
  deleteGroup: (id) => request({ url: `/book-groups/${id}`, method: 'DELETE' }),
  assignBookGroup: (bookId, groupId) =>
    request({ url: `/books/${bookId}/group`, method: 'PATCH', data: { groupId } }),

  // ===== 记账 =====
  createTransaction: (data) => request({ url: '/transactions', method: 'POST', data }),
  listTransactions: (bookId) => request({ url: `/transactions?bookId=${bookId}` }),
  transactionSummary: (bookId) => request({ url: `/transactions/summary?bookId=${bookId}` }),
  // 可部分结算的公账（与当前用户相关、仍有未结清份额）
  settleableTransactions: (bookId) => request({ url: `/transactions/settleable?bookId=${bookId}` }),
  transactionDetail: (id) => request({ url: `/transactions/${id}` }),
  updateTransaction: (id, data) => request({ url: `/transactions/${id}`, method: 'PATCH', data }),
  deleteTransaction: (id) => request({ url: `/transactions/${id}`, method: 'DELETE' }),
  transactionLogs: (id) => request({ url: `/transactions/${id}/logs` }),
  // 重复金额检查（传入支付方式：相同金额 + 相同支付方式才算重复）
  checkDuplicateAmount: (bookId, amount, paymentMethod, excludeId) => {
    let url = `/transactions/duplicate-check?bookId=${bookId}&amount=${amount}&paymentMethod=${paymentMethod}`
    if (excludeId) url += `&excludeId=${excludeId}`
    return request({ url })
  },

  // ===== 汇率 =====
  exchangeRates: () => request({ url: '/exchange-rates' }),

  // ===== 统计 =====
  statsOverview: (range, scope, bookId) => {
    let q = `?range=${range}&scope=${scope}`
    if (bookId && bookId !== 'all') q += `&bookId=${encodeURIComponent(bookId)}`
    return request({ url: `/stats/overview${q}` })
  },

  // ===== 结算（轮次容器 + 按人两两净额）=====
  // 执行结算（全部/部分）：建轮次并锁定账单
  settle: (data) => request({ url: '/settlements/settle', method: 'POST', data }),
  // 结算轮次列表（带 active/completed 状态）
  listSettlementRounds: (bookId) => request({ url: `/settlements/rounds?bookId=${bookId}` }),
  // 删除某一轮结算（释放该轮账单）
  revertSettlementRound: (roundId) =>
    request({ url: `/settlements/rounds/${roundId}/revert`, method: 'POST' }),

  // 按人结算：待收款/待支付明细（roundId 可选：轮次模式）
  settleByPerson: (bookId, roundId) => {
    const q = roundId ? `?bookId=${bookId}&roundId=${roundId}` : `?bookId=${bookId}`
    return request({ url: `/settlements/by-person${q}` })
  },
  // 按人结算：结清我与某成员之间的全部账单份额（roundId 可选）
  settlePersonDebt: (bookId, otherUserId, roundId) =>
    request({ url: '/settlements/settle-person', method: 'POST', data: { bookId, otherUserId, roundId } }),
  // 撤回按人结算
  revertPersonDebt: (bookId, otherUserId, roundId) =>
    request({ url: '/settlements/revert-person', method: 'POST', data: { bookId, otherUserId, roundId } }),
  // 账本所有进行中轮次
  activeRounds: (bookId) => request({ url: `/settlements/active-rounds?bookId=${bookId}` }),

  // ===== OCR识别 =====
  ocrRecognizeReceipt: async (filePath, bookId) => {
    // 1. 大图先压缩（真机拍照几 MB 时上传太慢，叠加后端 OCR + AI 耗时会超过 60s 默认超时）
    //    阈值 500KB：小于此值直接上传，大于则压到 quality 80
    let uploadPath = filePath
    try {
      const info = await new Promise((resolve, reject) => {
        wx.getFileSystemManager().getFileInfo({
          filePath,
          success: resolve,
          fail: reject,
        })
      })
      if (info.size > 500 * 1024) {
        const compressed = await new Promise((resolve, reject) => {
          wx.compressImage({
            src: filePath,
            quality: 80,
            success: resolve,
            fail: reject,
          })
        })
        uploadPath = compressed.tempFilePath
      }
    } catch (e) {
      // 压缩失败不阻断，回退到原图直传（旧行为）
    }

    // 2. 上传，超时给到 2 分钟 + 暴露真实错误信息
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${getBaseURL()}/ocr/recognize-receipt`,
        filePath: uploadPath,
        name: 'file',
        timeout: 120000,
        header: {
          Authorization: `Bearer ${wx.getStorageSync('token')}`,
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            if (data.code === 0) {
              resolve(data.data)
            } else {
              reject(new Error(data.message || '识别失败'))
            }
          } catch (e) {
            reject(new Error('解析响应失败'))
          }
        },
        // 把 wx 原生的 errMsg 透出给上层，让 toast 显示真实原因（超时/网络中断等）
        fail: (err) => reject(new Error(err.errMsg || '上传失败')),
      })
    })
  },
  batchCreateFromOcr: (data) => request({ url: '/ocr/batch-create-transactions', method: 'POST', data }),

  // ===== 分享总结 =====
  // 创建分享令牌（登录态）
  createShareToken: (bookId, data) =>
    request({ url: `/books/${bookId}/share-token`, method: 'POST', data }),
  // 获取分享总结数据（公开接口，无需登录）
  getShareSummary: (tokenId) =>
    request({ url: `/share/summary/${tokenId}`, skipAuth: true }),
}

module.exports = api
