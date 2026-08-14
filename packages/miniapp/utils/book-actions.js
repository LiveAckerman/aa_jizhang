/**
 * 账本 book-menu 组件抛出的 action 事件统一处理器。
 * onDone 回调用于让调用方在操作成功后刷新列表 / 关闭页面。
 */
const api = require('./api')

async function handleBookAction(detail, onDone) {
  const { type, book } = detail
  if (!book || !book.id) return

  switch (type) {
    case 'settings':
      wx.navigateTo({ url: `/pages/book-form/book-form?id=${book.id}` })
      break

    case 'invite':
      wx.navigateTo({ url: `/pages/invite/invite?id=${book.id}` })
      break

    case 'copy':
      openCopyDialog(book, onDone)
      break

    case 'move-group':
      openMoveGroupDialog(book, onDone)
      break

    case 'archive':
    case 'unarchive':
      try {
        await api.updateBook(book.id, { archived: type === 'archive' })
        wx.showToast({ title: type === 'archive' ? '已归档' : '已取消归档', icon: 'success' })
        onDone && onDone()
      } catch (e) {}
      break

    case 'delete':
      wx.showModal({
        title: '删除账本',
        content: '删除后账本内所有账单一并删除，且不可恢复',
        confirmColor: '#fa9583',
        success: async (res) => {
          if (!res.confirm) return
          try {
            await api.deleteBook(book.id)
            wx.showToast({ title: '已删除', icon: 'success' })
            onDone && onDone({ removed: true, id: book.id })
          } catch (e) {}
        },
      })
      break

    case 'leave':
      wx.showModal({
        title: '退出账本',
        content: '退出后将不再看到该账本，确定退出吗？',
        success: async (res) => {
          if (!res.confirm) return
          try {
            await api.leaveBook(book.id)
            wx.showToast({ title: '已退出', icon: 'success' })
            onDone && onDone({ removed: true, id: book.id })
          } catch (e) {}
        },
      })
      break
  }
}

/** 复制账本弹窗：填名称 + 是否复制成员 */
function openCopyDialog(book, onDone) {
  const defaultName = `(复制)${book.name || '账本'}`
  wx.showModal({
    title: '复制账本',
    editable: true,
    placeholderText: '新账本名称',
    content: defaultName,
    success: (res) => {
      if (!res.confirm) return
      const name = (res.content || '').trim() || defaultName
      wx.showModal({
        title: '同时复制成员？',
        content: '选择「是」会把原账本的成员也拉进新账本',
        confirmText: '是',
        cancelText: '否',
        success: async (r2) => {
          try {
            const book2 = await api.copyBook(book.id, { name, copyMembers: r2.confirm })
            wx.showToast({ title: '已复制', icon: 'success' })
            setTimeout(() => {
              wx.navigateTo({ url: `/pages/book-detail/book-detail?id=${book2.id}` })
            }, 500)
            onDone && onDone()
          } catch (e) {
            wx.showToast({ title: (e && e.message) || '复制失败', icon: 'none' })
          }
        },
      })
    },
  })
}

/** 移动到分组弹窗：拉分组列表让用户选 */
async function openMoveGroupDialog(book, onDone) {
  let groups
  try {
    groups = await api.listGroups()
  } catch (e) {
    return
  }
  const items = groups.map((g) => (g.isDefault ? `${g.name}（默认）` : g.name))
  items.push('＋ 新建分组')
  wx.showActionSheet({
    itemList: items,
    success: async (res) => {
      if (res.tapIndex === items.length - 1) {
        // 新建分组
        wx.showModal({
          title: '新建分组',
          editable: true,
          placeholderText: '分组名称',
          success: async (r) => {
            if (!r.confirm) return
            try {
              const g = await api.createGroup((r.content || '').trim())
              await api.assignBookGroup(book.id, g.id)
              wx.showToast({ title: '已移动', icon: 'success' })
              onDone && onDone()
            } catch (e) {
              wx.showToast({ title: (e && e.message) || '操作失败', icon: 'none' })
            }
          },
        })
      } else {
        const g = groups[res.tapIndex]
        try {
          await api.assignBookGroup(book.id, g.isDefault ? '' : g.id)
          wx.showToast({ title: '已移动', icon: 'success' })
          onDone && onDone()
        } catch (e) {}
      }
    },
  })
}

module.exports = { handleBookAction }
