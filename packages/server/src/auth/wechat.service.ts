import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/** 微信 code2session 返回结构 */
interface Code2SessionResult {
  openid?: string
  session_key?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

@Injectable()
export class WechatService {
  constructor(private readonly config: ConfigService) {}

  /**
   * 用小程序 code 换取 openid / session_key
   * 文档: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html
   */
  async code2session(code: string): Promise<{ openid: string; unionid?: string }> {
    const appid = this.config.get<string>('WX_APPID')
    const secret = this.config.get<string>('WX_SECRET')

    const url =
      `https://api.weixin.qq.com/sns/jscode2session` +
      `?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`

    const resp = await fetch(url)
    const data = (await resp.json()) as Code2SessionResult

    if (data.errcode || !data.openid) {
      throw new InternalServerErrorException(
        `微信登录失败: ${data.errcode} ${data.errmsg || '未获取到 openid'}`,
      )
    }

    return { openid: data.openid, unionid: data.unionid }
  }

  private accessToken = ''
  private accessTokenExpireAt = 0

  /** 获取并缓存接口调用凭证 access_token */
  private async getAccessToken(): Promise<string> {
    const now = Date.now()
    if (this.accessToken && now < this.accessTokenExpireAt) {
      return this.accessToken
    }
    const appid = this.config.get<string>('WX_APPID')
    const secret = this.config.get<string>('WX_SECRET')
    const url =
      `https://api.weixin.qq.com/cgi-bin/token` +
      `?grant_type=client_credential&appid=${appid}&secret=${secret}`
    const resp = await fetch(url)
    const data = (await resp.json()) as {
      access_token?: string
      expires_in?: number
      errcode?: number
      errmsg?: string
    }
    if (!data.access_token) {
      throw new InternalServerErrorException(
        `获取 access_token 失败: ${data.errcode} ${data.errmsg || ''}`,
      )
    }
    this.accessToken = data.access_token
    // 提前 5 分钟过期，避免边界
    this.accessTokenExpireAt = now + ((data.expires_in || 7200) - 300) * 1000
    return this.accessToken
  }

  /**
   * 生成小程序码（wxacode.getUnlimited），返回 PNG Buffer。
   * @param scene 场景值（最长 32 字符），如 `c=INVITECODE`
   * @param page  扫码后进入的页面路径（不含前导斜杠），如 `pages/join/join`
   */
  async getUnlimitedQRCode(scene: string, page: string): Promise<Buffer> {
    const token = await this.getAccessToken()
    const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene, page, check_path: false, env_version: 'trial' }),
    })
    const contentType = resp.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      // 出错时微信返回 JSON
      const err = (await resp.json()) as { errcode?: number; errmsg?: string }
      throw new InternalServerErrorException(
        `生成小程序码失败: ${err.errcode} ${err.errmsg || ''}`,
      )
    }
    const arrayBuffer = await resp.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
}
