/**
 * 通用「账本操作」菜单触发按钮
 * 属性：
 *   book         - 账本对象（含 id / ownerId / archived / inviteCode）
 *   isOwner      - 当前用户是否是 owner
 *   light        - 是否用浅色样式（图标白色，用于封面上方）
 *   showCopy     - 是否显示「复制账本」入口（默认 true）
 * 触发的事件（自定义 event）：
 *   action { type: 'settings'|'members'|'invite'|'archive'|'unarchive'|'delete'|'leave'|'copy'|'move-group', book }
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
      // 注意：wx.showActionSheet 的 itemList 最多 6 项，超过会静默失败。
      // 邀请入口已收拢到「成员管理」页 + 详情卡片的「+」按钮，故不再放进本菜单。
      const items = []
      if (isOwner) items.push({ label: '账本设置', type: 'settings' })
      if (isOwner) items.push({ label: '成员管理', type: 'members' })
      if (showCopy) items.push({ label: '复制账本', type: 'copy' })
      items.push({ label: '移动到分组', type: 'move-group' })
      if (isOwner) items.push({ label: book.archived ? '取消归档' : '归档账本', type: book.archived ? 'unarchive' : 'archive' })
      if (isOwner) items.push({ label: '删除账本', type: 'delete' })
      if (!isOwner) items.push({ label: '邀请好友', type: 'invite' })
      if (!isOwner) items.push({ label: '退出账本', type: 'leave' })

      wx.showActionSheet({
        itemList: items.map((i) => i.label),
        success: (res) => {
          const it = items[res.tapIndex]
          if (!it) return
          this.triggerEvent('action', { type: it.type, book })
        },
        fail: (err) => {
          // 取消操作(cancel)不提示；其它失败(如超 6 项)给出兜底提示
          if (err && /cancel/.test(err.errMsg || '')) return
          wx.showToast({ title: '菜单打开失败', icon: 'none' })
        },
      })
    },
  },
})
