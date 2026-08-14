import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { BookGroup } from './book-group.entity'
import { BookMember } from './book-member.entity'

@Injectable()
export class BookGroupService {
  constructor(
    @InjectRepository(BookGroup)
    private readonly groupRepo: Repository<BookGroup>,
    @InjectRepository(BookMember)
    private readonly memberRepo: Repository<BookMember>,
  ) {}

  /** 懒创建：确保用户有一个默认分组，返回它 */
  async ensureDefaultGroup(userId: string): Promise<BookGroup> {
    let g = await this.groupRepo.findOne({ where: { userId, isDefault: true } })
    if (!g) {
      g = await this.groupRepo.save(
        this.groupRepo.create({
          userId,
          name: '默认分组',
          isDefault: true,
          sortOrder: 0,
        }),
      )
    }
    return g
  }

  /** 我的分组列表（默认分组永远排第一） */
  async listMine(userId: string) {
    await this.ensureDefaultGroup(userId)
    const groups = await this.groupRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', sortOrder: 'ASC', createdAt: 'ASC' },
    })
    // 附带每个分组下的账本数（用 book_members 统计）
    const result = await Promise.all(
      groups.map(async (g) => {
        const bookCount = g.isDefault
          ? await this.memberRepo
              .createQueryBuilder('m')
              .where('m.userId = :userId', { userId })
              .andWhere("(m.groupId = :gid OR m.groupId = '' OR m.groupId IS NULL)", { gid: g.id })
              .getCount()
          : await this.memberRepo.count({ where: { userId, groupId: g.id } })
        return { ...g, bookCount }
      }),
    )
    return result
  }

  async create(userId: string, name: string) {
    const trimmed = (name || '').trim()
    if (!trimmed) throw new BadRequestException('分组名称不能为空')
    const g = this.groupRepo.create({
      userId,
      name: trimmed,
      isDefault: false,
      sortOrder: 100,
    })
    return this.groupRepo.save(g)
  }

  async rename(userId: string, id: string, name: string) {
    const g = await this.groupRepo.findOne({ where: { id } })
    if (!g) throw new NotFoundException('分组不存在')
    if (g.userId !== userId) throw new ForbiddenException('无权修改')
    if (g.isDefault) throw new BadRequestException('默认分组不能改名')
    const trimmed = (name || '').trim()
    if (!trimmed) throw new BadRequestException('分组名称不能为空')
    g.name = trimmed
    return this.groupRepo.save(g)
  }

  async remove(userId: string, id: string) {
    const g = await this.groupRepo.findOne({ where: { id } })
    if (!g) throw new NotFoundException('分组不存在')
    if (g.userId !== userId) throw new ForbiddenException('无权删除')
    if (g.isDefault) throw new BadRequestException('默认分组不能删除')
    // 旗下账本回落到默认分组（清空 groupId 即可）
    await this.memberRepo.update({ userId, groupId: g.id }, { groupId: '' })
    await this.groupRepo.delete({ id })
    return { deleted: true }
  }

  /** 设置某个账本在我视角的分组（groupId 为空表示回到默认分组） */
  async assignBookToGroup(userId: string, bookId: string, groupId: string) {
    const member = await this.memberRepo.findOne({ where: { bookId, userId } })
    if (!member) throw new ForbiddenException('你不是该账本成员')
    if (groupId) {
      const g = await this.groupRepo.findOne({ where: { id: groupId } })
      if (!g || g.userId !== userId) throw new NotFoundException('分组不存在')
      if (g.isDefault) groupId = '' // 归到默认分组等价于清空
    }
    member.groupId = groupId
    await this.memberRepo.save(member)
    return { groupId: member.groupId }
  }
}
