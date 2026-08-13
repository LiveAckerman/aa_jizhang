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
}
