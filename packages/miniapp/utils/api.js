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
  ocrRecognizeReceipt: (filePath, bookId) => {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${getBaseURL()}/ocr/recognize-receipt`,
        filePath,
        name: 'file',
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
        fail: reject,
      })
    })
  },
  batchCreateFromOcr: (data) => request({ url: '/ocr/batch-create-transactions', method: 'POST', data }),
}

module.exports = api
