import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { randomBytes } from 'crypto'
import { Book } from './book.entity'
import { BookMember } from './book-member.entity'
import { BookGroup } from './book-group.entity'
import { User } from '../user/user.entity'
import { Transaction } from '../transaction/transaction.entity'
import { TransactionLog } from '../transaction/transaction-log.entity'
import { CreateBookDto } from './dto/create-book.dto'
import { UpdateBookDto } from './dto/update-book.dto'

/** 默认场景封面（CDN） */
const SCENE_COVERS: Record<string, string> = {
  travel: 'https://cdn.ljw44.com/assets/covers/cover-travel.webp',
  dinner: 'https://cdn.ljw44.com/assets/covers/cover-dinner.webp',
  rent: 'https://cdn.ljw44.com/assets/covers/cover-rent.webp',
  activity: 'https://cdn.ljw44.com/assets/covers/cover-activity.webp',
  custom: 'https://cdn.ljw44.com/assets/covers/cover-custom.webp',
}

@Injectable()
export class BookService {
  constructor(
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
    @InjectRepository(BookMember)
    private readonly memberRepo: Repository<BookMember>,
    @InjectRepository(BookGroup)
    private readonly groupRepo: Repository<BookGroup>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(TransactionLog)
    private readonly logRepo: Repository<TransactionLog>,
  ) {}

  /** 生成 8 位邀请码 */
  private genInviteCode(): string {
    return randomBytes(6).toString('base64url').slice(0, 8).toUpperCase()
  }

  /** 计算封面：优先自定义封面，否则按场景取默认 */
  private resolveCover(book: Book): string {
    return book.cover || SCENE_COVERS[book.scene] || SCENE_COVERS.custom
  }

  /** 创建账本，并把创建者加为 owner 成员 */
  async create(userId: string, dto: CreateBookDto) {
    const book = this.bookRepo.create({
      name: dto.name,
      scene: dto.scene || 'custom',
      sceneName: dto.scene === 'custom' ? (dto.sceneName || '').slice(0, 32) : '',
      icon: dto.icon || '',
      cover: dto.cover || '',
      description: dto.description || '',
      ownerId: userId,
      inviteCode: this.genInviteCode(),
    })
    await this.bookRepo.save(book)

    await this.memberRepo.save(
      this.memberRepo.create({ bookId: book.id, userId, role: 'owner' }),
    )

    return { ...book, coverUrl: this.resolveCover(book), memberCount: 1 }
  }

  /** 我参与的所有账本（可按分组筛选） */
  async listMyBooks(userId: string, groupId?: string) {
    const members = await this.memberRepo.find({ where: { userId } })
    if (members.length === 0) return []

    // 建立 bookId → myGroupId 的映射（成员在自己视角下的分组）
    const myGroupMap = new Map<string, string>()
    members.forEach((m) => myGroupMap.set(m.bookId, m.groupId || ''))

    // 按分组筛选：
    //   'all'        → 不筛，返回全部
    //   'default'    → 默认分组：空 groupId 或匹配默认分组 UUID
    //   <某个 UUID>  → 精确匹配该 UUID；若恰好是默认分组，也含空 groupId
    let filteredIds = members.map((m) => m.bookId)
    if (groupId && groupId !== 'all') {
      let isDefaultGroup = groupId === 'default'
      let defaultId: string | null = null
      if (isDefaultGroup) {
        const g = await this.groupRepo.findOne({ where: { userId, isDefault: true } })
        defaultId = g ? g.id : null
      } else {
        const g = await this.groupRepo.findOne({ where: { id: groupId } })
        if (g && g.userId === userId && g.isDefault) {
          isDefaultGroup = true
          defaultId = g.id
        }
      }
      if (isDefaultGroup) {
        filteredIds = members
          .filter((m) => !m.groupId || m.groupId === defaultId)
          .map((m) => m.bookId)
      } else {
        filteredIds = members.filter((m) => m.groupId === groupId).map((m) => m.bookId)
      }
    }
    if (filteredIds.length === 0) return []

    const books = await this.bookRepo.find({
      where: { id: In(filteredIds) },
      order: { createdAt: 'DESC' },
    })

    // 批量取成员，附带每个账本的成员数与头像
    const allMembers = await this.memberRepo.find({ where: { bookId: In(filteredIds) } })
    const userIds = [...new Set(allMembers.map((m) => m.userId))]
    const users = userIds.length
      ? await this.userRepo.find({ where: { id: In(userIds) } })
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))

    // 批量拉这些账本的所有账单，用于聚合金额
    const txs = await this.txRepo.find({ where: { bookId: In(filteredIds) } })
    // 每本累加：bookTotal（全成员共享总额）/ mySharedAmount（我在共享里的份额）/ myPrivateAmount（我的私密）
    const amountMap = new Map<string, { bookTotal: number; myShared: number; myPrivate: number }>()
    filteredIds.forEach((id) =>
      amountMap.set(id, { bookTotal: 0, myShared: 0, myPrivate: 0 }),
    )
    txs.forEach((t) => {
      const bucket = amountMap.get(t.bookId)
      if (!bucket) return
      if (t.type === 'shared') {
        // 公账仅统计「当前用户参与」的账单（与账本详情口径一致，每人看到的金额不同）
        const mine = (t.splits || []).find((s) => s.userId === userId)
        const involved = !!mine || t.payerId === userId
        if (!involved) return
        bucket.bookTotal += t.amount
        if (mine) bucket.myShared += mine.amount
      } else if (t.creatorId === userId) {
        bucket.myPrivate += t.amount
      }
    })

    return books.map((book) => {
      const bms = allMembers.filter((m) => m.bookId === book.id)
      const avatars = bms
        .map((m) => userMap.get(m.userId)?.avatar)
        .filter(Boolean)
        .slice(0, 5)
      const amt = amountMap.get(book.id) || { bookTotal: 0, myShared: 0, myPrivate: 0 }
      return {
        ...book,
        coverUrl: this.resolveCover(book),
        memberCount: bms.length,
        memberAvatars: avatars,
        myGroupId: myGroupMap.get(book.id) || '',
        // 金额（分）：账本共享总额、我的共享份额、我的私密、我的总支出（共享+私密）
        bookTotal: amt.bookTotal,
        mySharedAmount: amt.myShared,
        myPrivateAmount: amt.myPrivate,
        myTotalAmount: amt.myShared + amt.myPrivate,
      }
    })
  }

  /** 取原始账本实体（内部使用） */
  async getRaw(bookId: string): Promise<Book> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } })
    if (!book) throw new NotFoundException('账本不存在')
    return book
  }

  /** 取账本全部成员的 userId 列表 */
  async listMemberIds(bookId: string): Promise<string[]> {
    const members = await this.memberRepo.find({ where: { bookId } })
    return members.map((m) => m.userId)
  }

  /** 校验用户是否为账本成员，返回成员记录 */
  async assertMember(bookId: string, userId: string): Promise<BookMember> {
    const member = await this.memberRepo.findOne({ where: { bookId, userId } })
    if (!member) {
      throw new ForbiddenException('你不是该账本成员')
    }
    return member
  }

  /** 账本详情（含成员列表，成员附带昵称头像） */
  async detail(bookId: string, userId: string) {
    await this.assertMember(bookId, userId)
    const book = await this.bookRepo.findOne({ where: { id: bookId } })
    if (!book) throw new NotFoundException('账本不存在')

    const members = await this.enrichMembers(bookId)
    return { ...book, coverUrl: this.resolveCover(book), members }
  }

  /** 给成员记录附加用户昵称与头像 */
  private async enrichMembers(bookId: string) {
    const members = await this.memberRepo.find({ where: { bookId }, order: { joinedAt: 'ASC' } })
    const userIds = members.map((m) => m.userId)
    const users = userIds.length
      ? await this.userRepo.find({ where: { id: In(userIds) } })
      : []
    const userMap = new Map(users.map((u) => [u.id, u]))
    return members.map((m) => {
      const u = userMap.get(m.userId)
      return {
        ...m,
        nickname: m.displayName || u?.nickname || '成员',
        avatar: u?.avatar || '',
      }
    })
  }

  /** 更新账本（仅 owner） */
  async update(bookId: string, userId: string, dto: UpdateBookDto) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } })
    if (!book) throw new NotFoundException('账本不存在')
    if (book.ownerId !== userId) {
      throw new ForbiddenException('只有创建者可以修改账本')
    }
    Object.assign(book, dto)
    // 切到预设场景时清空自定义名，避免残留
    if (dto.scene && dto.scene !== 'custom') {
      book.sceneName = ''
    }
    await this.bookRepo.save(book)
    return { ...book, coverUrl: this.resolveCover(book) }
  }

  /** 删除账本（仅 owner）：级联清理账单、修改日志、成员 */
  async remove(bookId: string, userId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } })
    if (!book) throw new NotFoundException('账本不存在')
    if (book.ownerId !== userId) {
      throw new ForbiddenException('只有创建者可以删除账本')
    }
    // 顺序：先删依赖数据，最后删账本本身，避免留下孤儿记录
    await this.logRepo.delete({ bookId })
    await this.txRepo.delete({ bookId })
    await this.memberRepo.delete({ bookId })
    await this.bookRepo.delete({ id: bookId })
    return { deleted: true }
  }

  /** 通过邀请码查看账本信息（加入前预览，不加入） */
  async infoByCode(inviteCode: string, userId?: string) {
    const book = await this.bookRepo.findOne({ where: { inviteCode } })
    if (!book) throw new NotFoundException('邀请码无效')
    const memberCount = await this.memberRepo.count({ where: { bookId: book.id } })
    const owner = await this.userRepo.findOne({ where: { id: book.ownerId } })
    // 当前用户是否已是成员：前端据此直接进账本，无需再点「加入」
    let isMember = false
    if (userId) {
      const m = await this.memberRepo.findOne({ where: { bookId: book.id, userId } })
      isMember = !!m
    }
    return {
      id: book.id,
      name: book.name,
      scene: book.scene,
      sceneName: book.sceneName || '',
      coverUrl: this.resolveCover(book),
      memberCount,
      ownerName: owner?.nickname || '好友',
      isMember,
    }
  }

  /** 通过邀请码加入账本 */
  async joinByCode(userId: string, inviteCode: string, displayName?: string) {
    const book = await this.bookRepo.findOne({ where: { inviteCode } })
    if (!book) throw new NotFoundException('邀请码无效')

    const existing = await this.memberRepo.findOne({
      where: { bookId: book.id, userId },
    })
    if (!existing) {
      await this.memberRepo.save(
        this.memberRepo.create({
          bookId: book.id,
          userId,
          displayName: displayName || '',
          role: 'member',
        }),
      )
    }
    return { ...book, coverUrl: this.resolveCover(book) }
  }

  /** 移除成员（仅 owner，不能移除自己，需检查未结清债务） */
  async removeMember(bookId: string, ownerId: string, targetUserId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } })
    if (!book) throw new NotFoundException('账本不存在')
    if (book.ownerId !== ownerId) {
      throw new ForbiddenException('只有创建者可以移除成员')
    }
    if (targetUserId === ownerId) {
      throw new BadRequestException('不能移除创建者，请使用删除账本')
    }

    // 检查该成员是否有未结清的债务
    const txs = await this.txRepo.find({
      where: { bookId, type: 'shared' },
    })

    // 计算净收支
    const balanceMap = new Map<string, number>()
    for (const tx of txs) {
      // 付款人：应收
      const payerBalance = balanceMap.get(tx.payerId) || 0
      const totalAmount = (tx.splits || []).reduce((sum, s) => sum + s.amount, 0)
      balanceMap.set(tx.payerId, payerBalance + totalAmount)

      // 参与人：应付
      for (const split of tx.splits || []) {
        const participantBalance = balanceMap.get(split.userId) || 0
        balanceMap.set(split.userId, participantBalance - split.amount)
      }
    }

    const targetBalance = balanceMap.get(targetUserId) || 0
    if (Math.abs(targetBalance) > 0) {
      const amountYuan = (Math.abs(targetBalance) / 100).toFixed(2)
      const statusText = targetBalance > 0 ? '应收' : '应付'
      throw new BadRequestException(
        `该成员有 ${statusText} ¥${amountYuan} 未结清，请先完成结算后再移除`,
      )
    }

    await this.memberRepo.delete({ bookId, userId: targetUserId })
    return { removed: true }
  }

  /** 退出账本（成员本人，owner 不可退出，需转让或删除） */
  async leave(bookId: string, userId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } })
    if (!book) throw new NotFoundException('账本不存在')
    if (book.ownerId === userId) {
      throw new BadRequestException('创建者不能退出账本，请删除账本')
    }
    await this.assertMember(bookId, userId)
    await this.memberRepo.delete({ bookId, userId })
    return { left: true }
  }

  /**
   * 复制账本：复制设置（名称/场景/封面/描述），当前用户成为新账本的 owner。
   * - copyMembers=true 时，把原账本除自己以外的成员也加进来（角色一律 member）。
   * - 不复制账单流水。
   */
  async copy(userId: string, sourceBookId: string, name: string, copyMembers: boolean) {
    // 复制入口要求当前用户是原账本成员
    await this.assertMember(sourceBookId, userId)
    const source = await this.bookRepo.findOne({ where: { id: sourceBookId } })
    if (!source) throw new NotFoundException('账本不存在')

    const trimmed = (name || '').trim() || `复制 ${source.name}`
    const book = this.bookRepo.create({
      name: trimmed.slice(0, 64),
      scene: source.scene,
      icon: source.icon,
      cover: source.cover || '',
      description: source.description,
      ownerId: userId,
      inviteCode: this.genInviteCode(),
      archived: false,
    })
    await this.bookRepo.save(book)

    // 新账本的 owner = 当前用户
    await this.memberRepo.save(
      this.memberRepo.create({ bookId: book.id, userId, role: 'owner' }),
    )

    if (copyMembers) {
      const srcMembers = await this.memberRepo.find({ where: { bookId: sourceBookId } })
      const others = srcMembers.filter((m) => m.userId !== userId)
      if (others.length) {
        await this.memberRepo.save(
          others.map((m) =>
            this.memberRepo.create({
              bookId: book.id,
              userId: m.userId,
              displayName: m.displayName,
              role: 'member',
            }),
          ),
        )
      }
    }

    return {
      ...book,
      coverUrl: this.resolveCover(book),
      memberCount: copyMembers
        ? (await this.memberRepo.count({ where: { bookId: book.id } }))
        : 1,
    }
  }
}
