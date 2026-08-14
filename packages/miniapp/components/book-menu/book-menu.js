/**
 * 通用「账本操作」菜单触发按钮
 * 属性：
 *   book         - 账本对象（含 id / ownerId / archived / inviteCode）
 *   isOwner      - 当前用户是否是 owner
 *   light        - 是否用浅色样式（图标白色，用于封面上方）
 *   showCopy     - 是否显示「复制账本」入口（默认 true）
 * 触发的事件（自定义 event）：
 *   action { type: 'settings'|'invite'|'archive'|'unarchive'|'delete'|'leave'|'copy'|'move-group', book }
 */
Component({
  properties: {
    book: { type: Object, value: null },
    isOwner: { type: Boolean, value: false },
    light: { type: Boolean, value: false },
    showCopy: { type: Boolean, value: true },
  },

  methods: {
    onTapMenu() {
      const book = this.data.book || {}
      const isOwner = this.data.isOwner
      const showCopy = this.data.showCopy
      // 依次组装菜单项 → 保持顺序稳定，事件回调用 index 分派
      const items = []
      // 「邀请好友」放最上面 —— 是账本高频操作
      items.push({ label: '邀请好友', type: 'invite' })
      if (isOwner) items.push({ label: '账本设置', type: 'settings' })
      if (showCopy) items.push({ label: '复制账本', type: 'copy' })
      items.push({ label: '移动到分组', type: 'move-group' })
      if (isOwner) items.push({ label: book.archived ? '取消归档' : '归档账本', type: book.archived ? 'unarchive' : 'archive' })
      if (isOwner) items.push({ label: '删除账本', type: 'delete' })
      if (!isOwner) items.push({ label: '退出账本', type: 'leave' })

      wx.showActionSheet({
        itemList: items.map((i) => i.label),
        success: (res) => {
          const it = items[res.tapIndex]
          if (!it) return
          this.triggerEvent('action', { type: it.type, book })
        },
      })
    },
  },
})
