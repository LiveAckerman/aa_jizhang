import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { UserService } from './user.service'
import { UpdateProfileDto } from './dto/update-profile.dto'

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取当前用户信息
   * GET /api/user/profile
   */
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    const userInfo = await this.userService.findById(user.userId)
    return {
      code: 200,
      message: 'ok',
      data: {
        id: userInfo.id,
        openid: userInfo.openid,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        createdAt: userInfo.createdAt,
        updatedAt: userInfo.updatedAt,
      },
    }
  }

  /**
   * 更新用户信息
   * PUT /api/user/profile
   */
  @Put('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
  ) {
    const updatedUser = await this.userService.updateProfile(user.userId, dto)
    return {
      code: 200,
      message: '更新成功',
      data: {
        id: updatedUser.id,
        openid: updatedUser.openid,
        nickname: updatedUser.nickname,
        avatar: updatedUser.avatar,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    }
  }
}
