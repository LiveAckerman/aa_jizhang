/**
 * 品牌配色常量（与 UI 设计文档保持一致）
 */
export const BRAND_COLORS = {
  /** 主色 - 高级蓝绿 */
  primary: '#4097a9',
  /** 辅助色 - 温暖米色 */
  secondary: '#f4dfcc',
  /** 强调色 - 珊瑚粉橙 */
  accent: '#fa9583',
  /** 深色 - 深海军蓝，用于文字 */
  dark: '#2f4159',
  /** 微信品牌绿 */
  wechatGreen: '#07C160',
} as const

/** 功能色 */
export const FUNCTIONAL_COLORS = {
  /** 支出 */
  expense: '#fa9583',
  /** 收入 */
  income: '#4097a9',
  /** 成功 */
  success: '#34C759',
  /** 警告 */
  warning: '#FF9500',
  /** 错误 */
  error: '#FF3B30',
} as const
