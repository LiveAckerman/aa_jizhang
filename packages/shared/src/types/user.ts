/**
 * 用户相关类型定义
 */

/** 用户信息 */
export interface User {
  /** 用户唯一 ID */
  id: string
  /** 微信 openid */
  openid: string
  /** 微信 unionid（如已绑定开放平台） */
  unionid?: string
  /** 昵称 */
  nickname: string
  /** 头像 URL */
  avatar: string
  /** 创建时间（ISO 字符串） */
  createdAt: string
  /** 更新时间（ISO 字符串） */
  updatedAt: string
}

/** 登录方式 */
export type LoginProvider = 'wechat' | 'email'
