/**
 * 账本 / 记账 相关常量
 * 图标统一使用 @vant/weapp 的 van-icon 字体图标名（严禁 emoji）
 */

// 场景模板
const SCENES = [
  { key: 'travel', name: '旅行', icon: 'guide-o' },
  { key: 'dinner', name: '聚餐', icon: 'goods-collect-o' },
  { key: 'rent', name: '合租', icon: 'hotel-o' },
  { key: 'activity', name: '活动', icon: 'flag-o' },
  { key: 'custom', name: '自定义', icon: 'edit' },
]

// 记账分类（图标为 van-icon 名）
const CATEGORIES = [
  { key: 'food', name: '餐饮', icon: 'goods-collect-o' },
  { key: 'transport', name: '交通', icon: 'logistics' },
  { key: 'hotel', name: '住宿', icon: 'hotel-o' },
  { key: 'ticket', name: '门票', icon: 'coupon-o' },
  { key: 'shopping', name: '购物', icon: 'shopping-cart-o' },
  { key: 'entertainment', name: '娱乐', icon: 'music-o' },
  { key: 'drink', name: '饮品', icon: 'cash-back-record' },
  { key: 'medical', name: '医疗', icon: 'like-o' },
  { key: 'other', name: '其他', icon: 'apps-o' },
]

// 分账方式
const SPLIT_METHODS = [
  { key: 'average', name: '平均分摊' },
  { key: 'ratio', name: '按比例' },
  { key: 'shares', name: '按份额' },
  { key: 'fixed', name: '指定金额' },
]

const CATEGORY_MAP = {}
CATEGORIES.forEach((c) => (CATEGORY_MAP[c.key] = c))

const SCENE_MAP = {}
SCENES.forEach((s) => (SCENE_MAP[s.key] = s))

/** 场景对应的分享卡片图（微信 onShareAppMessage.imageUrl，5:4 会自动裁） */
const SCENE_SHARE_IMAGES = {
  travel: 'https://cdn.ljw44.com/images/2026-08/share-travel.png',
  dinner: 'https://cdn.ljw44.com/images/2026-08/share-dinner.png',
  rent: 'https://cdn.ljw44.com/images/2026-08/share-rent.png',
  activity: 'https://cdn.ljw44.com/images/2026-08/share-activity.png',
  custom: 'https://cdn.ljw44.com/images/2026-08/share-custom.png',
}

/** 按场景取分享图；未匹配则 fallback 到 custom */
function shareImageForScene(scene) {
  return SCENE_SHARE_IMAGES[scene] || SCENE_SHARE_IMAGES.custom
}

module.exports = {
  SCENES,
  CATEGORIES,
  SPLIT_METHODS,
  CATEGORY_MAP,
  SCENE_MAP,
  SCENE_SHARE_IMAGES,
  shareImageForScene,
}
