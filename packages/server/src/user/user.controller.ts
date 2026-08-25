import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { UserService } from './user.service'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { UpdateWechatProfileDto } from './dto/update-wechat-profile.dto'

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取当前用户信息
   * GET /api/user/profile
   */
  @Get('profile')
  async getProfile(@CurrentUser('sub') userId: string) {
    const userInfo = await this.userService.findById(userId)
    return {
      code: 0,
      message: 'ok',
      data: this.userService.toClientUser(userInfo),
    }
  }

  /**
   * 标记已处理头像昵称授权提示（关闭/跳过），之后不再弹
   * POST /api/user/profile-prompt/dismiss
   */
  @Post('profile-prompt/dismiss')
  async dismissProfilePrompt(@CurrentUser('sub') userId: string) {
    await this.userService.dismissProfilePrompt(userId)
    return { code: 0, message: 'ok', data: null }
  }

  /**
   * 更新用户信息
   * PUT /api/user/profile
   */
  @Put('profile')
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const updatedUser = await this.userService.updateProfile(userId, dto)
    return {
      code: 0,
      message: '更新成功',
      data: this.userService.toClientUser(updatedUser),
    }
  }

  /**
   * 通过微信授权更新用户信息
   * PUT /api/user/wechat-profile
   */
  @Put('wechat-profile')
  async updateWechatProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateWechatProfileDto,
  ) {
    const updatedUser = await this.userService.updateWechatProfile(userId, dto)
    return {
      code: 0,
      message: '授权成功',
      data: this.userService.toClientUser(updatedUser),
    }
  }
}
