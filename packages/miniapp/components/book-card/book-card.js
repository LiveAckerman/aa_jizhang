/**
 * 通用账本卡片 book-card
 *
 * 账本列表(mode=list) 和 账本详情头图(mode=detail) 共用同一张封面叠加卡，
 * 显示统一信息：封面 + 名称 + 成员头像 + 公账合计(大字) + 我的支出(副行) + 日期 + 状态徽章。
 *
 * mode 只控制“差异交互”，不影响显示的信息：
 *   - list  : 整卡可点进详情；无分享/邀请/成员长按
 *   - detail: 有分享按钮、邀请+、成员长按移除；整卡不可点
 *
 * book 归一化对象字段：
 *   id, name, coverUrl, ownerId, archived, inviteCode   (后三者供内嵌 book-menu)
 *   members: [{ avatar, userId }]
 *   bookTotalText, myTotalText, mySharedText, myPrivateText, hasPrivate
 *   dateText, statusBadge(可选)
 */
Component({
  properties: {
    book: { type: Object, value: {} },
    mode: { type: String, value: 'list' }, // 'list' | 'detail'
    isOwner: { type: Boolean, value: false },
  },

  methods: {
    // 整卡点击：仅 list 模式抛 tap，交给页面 navigate 进详情
    onCardTap() {
      if (this.data.mode !== 'list') return
      this.triggerEvent('tap', { id: this.data.book.id })
    },

    // 透传 book-menu 的操作事件
    onAction(e) {
      this.triggerEvent('action', e.detail)
    },

    // 邀请（仅 detail）
    onInvite() {
      this.triggerEvent('invite')
    },

    // 成员长按移除（仅 detail）
    onMemberLongPress(e) {
      if (this.data.mode !== 'detail') return
      const { userid } = e.currentTarget.dataset
      this.triggerEvent('memberlongpress', { userid })
    },

    // 阻止右上角操作区点击冒泡到整卡
    noop() {},
  },
})
