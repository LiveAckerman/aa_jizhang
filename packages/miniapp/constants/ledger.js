/**
 * 账本 / 记账 相关常量
 * 图标统一使用 @vant/weapp 的 van-icon 字体图标名（严禁 emoji）
 */

// 场景模板（custom 固定放最后，选中后可自定义名称）
const SCENES = [
  { key: 'travel', name: '旅行', icon: 'guide-o' },
  { key: 'dinner', name: '聚餐', icon: 'goods-collect-o' },
  { key: 'rent', name: '合租', icon: 'hotel-o' },
  { key: 'activity', name: '活动', icon: 'flag-o' },
  { key: 'party', name: '团建', icon: 'friends-o' },
  { key: 'club', name: '社团', icon: 'cluster-o' },
  { key: 'family', name: '家庭', icon: 'home-o' },
  { key: 'wedding', name: '份子钱', icon: 'gift-o' },
  { key: 'custom', name: '自定义', icon: 'edit' },
]

// 记账分类（图标为 van-icon 名）
const CATEGORIES = [
  { key: 'food', name: '餐饮', icon: 'goods-collect-o' },
  { key: 'takeout', name: '外卖', icon: 'bag-o' },
  { key: 'transport', name: '交通', icon: 'logistics' },
  { key: 'hotel', name: '住宿', icon: 'hotel-o' },
  { key: 'ticket', name: '门票', icon: 'coupon-o' },
  { key: 'shopping', name: '购物', icon: 'shopping-cart-o' },
  { key: 'entertainment', name: '娱乐', icon: 'music-o' },
  // 饮品用自定义 SVG（vant 无杯子图标）：svgIcon=蓝色版路径，svgIconActive=白色版（选中态）
  { key: 'drink', name: '饮品', icon: 'hot-o', svgIcon: '/assets/icons/drink.svg', svgIconActive: '/assets/icons/drink-white.svg' },
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

// 支付方式
const PAYMENT_METHODS = [
  { key: 'wechat', name: '微信', icon: 'wechat' },
  { key: 'alipay', name: '支付宝', icon: 'alipay' },
  { key: 'credit', name: '信用卡', icon: 'credit-pay' },
  { key: 'huabei', name: '花呗', icon: 'balance-pay' },
  { key: 'bankcard', name: '银行卡', icon: 'gold-coin-o' },
  { key: 'cash', name: '现金', icon: 'cash-back-record' },
  { key: 'other', name: '其他', icon: 'more-o' },
]

const CATEGORY_MAP = {}
CATEGORIES.forEach((c) => (CATEGORY_MAP[c.key] = c))

const SCENE_MAP = {}
SCENES.forEach((s) => (SCENE_MAP[s.key] = s))

/** 场景对应的分享卡片图（微信 onShareAppMessage.imageUrl，5:4 会自动裁） */
// 分享封面图用 jpg（微信 onShareAppMessage 的 imageUrl 仅保证支持 png/jpg，
// webp 概率性抓取失败导致分享卡片空白）
const SCENE_SHARE_IMAGES = {
  travel: 'https://cdn.ljw44.com/images/2026-08/share-travel.jpg',
  dinner: 'https://cdn.ljw44.com/images/2026-08/share-dinner.jpg',
  rent: 'https://cdn.ljw44.com/images/2026-08/share-rent.jpg',
  activity: 'https://cdn.ljw44.com/images/2026-08/share-activity.jpg',
  custom: 'https://cdn.ljw44.com/images/2026-08/share-custom.jpg',
}

/** 按场景取分享图；未匹配则 fallback 到 custom */
function shareImageForScene(scene) {
  return SCENE_SHARE_IMAGES[scene] || SCENE_SHARE_IMAGES.custom
}

/** 催收提醒分享卡片图（待收款「提醒 TA」用；jpg 保证微信抓取兼容） */
const COLLECTION_REMINDER_IMAGE = 'https://cdn.ljw44.com/images/2026-09/share-collection-reminder-generic.jpg'

module.exports = {
  SCENES,
  CATEGORIES,
  SPLIT_METHODS,
  PAYMENT_METHODS,
  CATEGORY_MAP,
  SCENE_MAP,
  SCENE_SHARE_IMAGES,
  shareImageForScene,
  COLLECTION_REMINDER_IMAGE,
}
