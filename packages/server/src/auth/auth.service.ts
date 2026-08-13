import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../user/user.entity'
import { WechatService } from './wechat.service'
import { UserService } from '../user/user.service'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly wechatService: WechatService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  /**
   * 微信登录：code → openid → 查找或创建用户 → 签发 token
   */
  async wechatLogin(code: string) {
    // 1. 换取 openid
    const { openid, unionid } = await this.wechatService.code2session(code)

    // 2. 查找或创建用户
    let user = await this.userRepo.findOne({ where: { openid } })
    let isNewUser = false

    if (!user) {
      isNewUser = true
      user = this.userRepo.create({
        openid,
        unionid,
        nickname: this.userService.generateDefaultNickname(),
        avatar: this.userService.generateDefaultAvatar(),
        isProfileComplete: false,
      })
      await this.userRepo.save(user)
    }

    // 3. 签发 JWT
    const token = await this.jwtService.signAsync({
      sub: user.id,
      openid: user.openid,
    })

    return {
      token,
      isNewUser: isNewUser || !user.isProfileComplete,
      user: {
        id: user.id,
        openid: user.openid,
        unionid: user.unionid,
        nickname: user.nickname,
        avatar: user.avatar,
        isProfileComplete: user.isProfileComplete,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    }
  }
}
