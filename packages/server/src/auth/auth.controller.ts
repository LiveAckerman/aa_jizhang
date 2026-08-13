import { Body, Controller, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { WechatLoginDto } from './dto/wechat-login.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 微信小程序登录
   * POST /api/auth/wechat/login
   */
  @Post('wechat/login')
  async wechatLogin(@Body() dto: WechatLoginDto) {
    const data = await this.authService.wechatLogin(dto.code)
    return {
      code: 0,
      message: 'ok',
      data,
    }
  }
}
