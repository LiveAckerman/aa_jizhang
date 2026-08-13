import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from './user.entity'
import { UpdateProfileDto } from './dto/update-profile.dto'

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 根据ID查找用户
   */
  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    return user
  }

  /**
   * 根据openid查找用户
   */
  async findByOpenid(openid: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { openid } })
  }

  /**
   * 更新用户信息
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(userId)

    if (dto.nickname !== undefined) {
      user.nickname = dto.nickname
    }

    if (dto.avatar !== undefined) {
      user.avatar = dto.avatar
    }

    // 标记信息已完善
    user.isProfileComplete = true

    await this.userRepo.save(user)
    return user
  }

  /**
   * 生成默认昵称
   */
  generateDefaultNickname(): string {
    const random = Math.floor(Math.random() * 10000)
    return `用户${random}`
  }

  /**
   * 生成默认头像URL
   */
  generateDefaultAvatar(): string {
    // 使用颜色数组随机选择
    const colors = ['FF6B9D', '4097a9', '5B8CFF', 'FFB84D', '4ECDC4']
    const randomColor = colors[Math.floor(Math.random() * colors.length)]

    // 返回占位符头像URL（可以改成你自己的CDN地址）
    return `https://ui-avatars.com/api/?name=U&background=${randomColor}&color=fff&size=200`
  }
}
