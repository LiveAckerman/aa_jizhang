/**
 * 认证相关类型定义
 */
import type { User } from './user'

/** 微信登录请求体：小程序 wx.login 拿到的 code */
export interface WechatLoginRequest {
  code: string
}

/** 登录响应：签发的 token + 用户信息 */
export interface LoginResponse {
  /** JWT token */
  token: string
  /** 用户信息 */
  user: User
}

/** 统一 API 响应包装 */
export interface ApiResponse<T = unknown> {
  /** 业务状态码，0 表示成功 */
  code: number
  /** 提示信息 */
  message: string
  /** 数据 */
  data: T | null
}
