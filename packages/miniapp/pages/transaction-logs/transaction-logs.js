const app = getApp()
const api = require('../../utils/api')

/** 操作类型 → 中文动作词 */
const ACTION_LABEL = {
  create: '创建账单',
  update: '修改',
  delete: '删除账单',
}

Page({
  data: {
    id: '',
    logs: [],       // 展示用：[{ id, userNickname, avatar, dateText, timeText, action, actionLabel, lines: [] }]
    loading: true,
    members: {},    // userId → { nickname, avatar }
  },

  onLoad(query) {
    this.setData({ id: query.id })
    this.load()
  },

  async load() {
    try {
      const logs = await api.transactionLogs(this.data.id)
      // 顺带取账单详情去拿账本 → 成员映射，供日志展示头像/昵称
      let members = {}
      try {
        const tx = await api.transactionDetail(this.data.id)
        const book = await api.bookDetail(tx.bookId)
        ;(book.members || []).forEach((m) => {
          members[m.userId] = { nickname: m.nickname || '成员', avatar: m.avatar || '' }
        })
      } catch (e) {}

      const rows = (logs || []).map((log) => {
        const at = new Date(log.createdAt)
        const p = (n) => (n < 10 ? '0' + n : '' + n)
        const dateText = `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}`
        const timeText = `${p(at.getHours())}:${p(at.getMinutes())}`
        const user = members[log.userId] || { nickname: '成员', avatar: '' }
        const lines =
          log.action === 'update' && Array.isArray(log.changes)
            ? log.changes.map((c) => `· 修改 ${c.label}：由 "${c.oldValue || '空'}" 修改为 "${c.newValue || '空'}"`)
            : [`· ${ACTION_LABEL[log.action] || log.action}`]
        return {
          id: log.id,
          userNickname: user.nickname,
          avatar: user.avatar,
          dateText,
          timeText,
          action: log.action,
          actionLabel: ACTION_LABEL[log.action] || log.action,
          lines,
        }
      })
      this.setData({ logs: rows, loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },
})
