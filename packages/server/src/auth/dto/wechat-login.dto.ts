import { IsNotEmpty, IsString } from 'class-validator'

export class WechatLoginDto {
  /** 小程序 wx.login 获取的临时 code */
  @IsString()
  @IsNotEmpty({ message: 'code 不能为空' })
  code: string
}
