/**
 * 通用卡片堆叠组件（iOS 通知式）
 * 折叠态：分隔线 + 顶部完整卡片(slot="top") + 错落影子卡 + 底部提示条
 * 展开态：分隔线 + 标题栏(标题 + 折叠icon) + 完整列表(slot="list")，带淡入下滑动画
 *
 * 属性：
 *   count    - 总条数（驱动影子卡数量：>1 显示 1 张，>2 显示 2 张）
 *   title    - 展开态标题栏文案，如「已结算账本」
 *   hintText - 折叠态底部提示文案，如「共 4 笔已结算，点击展开」
 */
Component({
  options: {
    multipleSlots: true, // 启用具名 slot（top / list），否则内容不渲染
    addGlobalClass: true, // 全局样式（glass-card 等）作用到 slot 内容
  },

  properties: {
    count: { type: Number, value: 0 },
    title: { type: String, value: '' },
    hintText: { type: String, value: '点击展开' },
  },

  data: {
    expanded: false,
  },

  methods: {
    onToggle() {
      this.setData({ expanded: !this.data.expanded })
    },
  },
})
