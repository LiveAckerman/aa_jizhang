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

  // ===== 结算 =====
  calculateSettlement: (bookId) => request({ url: `/settlements/calculate?bookId=${bookId}` }),
  createSettlement: (data) => request({ url: '/settlements', method: 'POST', data }),
  batchCreateSettlement: (data) => request({ url: '/settlements/batch', method: 'POST', data }),
  listSettlements: (bookId) => request({ url: `/settlements?bookId=${bookId}` }),
  completeSettlement: (id) => request({ url: `/settlements/${id}/complete`, method: 'PATCH' }),
  deleteSettlement: (id) => request({ url: `/settlements/${id}`, method: 'DELETE' }),
  // 撤回单条已完成结算
  revertSettlement: (id) => request({ url: `/settlements/${id}/revert`, method: 'PATCH' }),
  // 按成员撤回已完成结算（targetUserId 为空则撤回全部）
  revertSettlementByUser: (bookId, targetUserId) =>
    request({ url: '/settlements/revert-by-user', method: 'POST', data: { bookId, targetUserId } }),

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
