import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, LessThan } from 'typeorm'
import { ShareToken, ShareTokenConfig } from './share-token.entity'

@Injectable()
export class ShareTokenService {
  constructor(
    @InjectRepository(ShareToken)
    private readonly tokenRepo: Repository<ShareToken>,
  ) {}

  /**
   * 创建分享令牌
   * @param bookId 账本 ID
   * @param config 分享配置
   * @returns 新创建的令牌
   */
  async create(bookId: string, config: ShareTokenConfig): Promise<ShareToken> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 天后过期

    const token = this.tokenRepo.create({
      bookId,
      config,
      expiresAt,
    })

    return await this.tokenRepo.save(token)
  }

  /**
   * 验证令牌是否有效
   * @param tokenId 令牌 ID
   * @returns 令牌信息
   * @throws NotFoundException 令牌不存在或已过期
   */
  async verify(tokenId: string): Promise<ShareToken> {
    const token = await this.tokenRepo.findOne({ where: { id: tokenId } })

    if (!token) {
      throw new NotFoundException('分享链接不存在')
    }

    if (new Date() > token.expiresAt) {
      throw new NotFoundException('分享链接已过期')
    }

    return token
  }

  /**
   * 清理过期令牌（定时任务调用）
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.tokenRepo.delete({
      expiresAt: LessThan(new Date()),
    })
    return result.affected || 0
  }
}
