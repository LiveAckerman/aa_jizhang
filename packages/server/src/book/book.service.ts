import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomBytes } from 'crypto'
import { Book } from './book.entity'
import { BookMember } from './book-member.entity'
import { CreateBookDto } from './dto/create-book.dto'
import { UpdateBookDto } from './dto/update-book.dto'

@Injectable()
export class BookService {
  constructor(
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
    @InjectRepository(BookMember)
    private readonly memberRepo: Repository<BookMember>,
  ) {}

  /** 生成 8 位邀请码 */
  private genInviteCode(): string {
    return randomBytes(6).toString('base64url').slice(0, 8).toUpperCase()
  }

  /** 创建账本，并把创建者加为 owner 成员 */
  async create(userId: string, dto: CreateBookDto) {
    const book = this.bookRepo.create({
      name: dto.name,
      scene: dto.scene || 'custom',
      icon: dto.icon || '',
      ownerId: userId,
      inviteCode: this.genInviteCode(),
    })
    await this.bookRepo.save(book)

    await this.memberRepo.save(
      this.memberRepo.create({
        bookId: book.id,
        userId,
        role: 'owner',
      }),
    )

    return book
  }

  /** 我参与的所有账本 */
  async listMyBooks(userId: string) {
    const members = await this.memberRepo.find({ where: { userId } })
    const bookIds = members.map((m) => m.bookId)
    if (bookIds.length === 0) return []

    const books = await this.bookRepo.find({
      where: bookIds.map((id) => ({ id })),
      order: { createdAt: 'DESC' },
    })

    // 附带每个账本的成员数
    const result = await Promise.all(
      books.map(async (book) => {
        const memberCount = await this.memberRepo.count({ where: { bookId: book.id } })
        return { ...book, memberCount }
      }),
    )
    return result
  }

  /** 校验用户是否为账本成员，返回成员记录 */
  async assertMember(bookId: string, userId: string): Promise<BookMember> {
    const member = await this.memberRepo.findOne({ where: { bookId, userId } })
    if (!member) {
      throw new ForbiddenException('你不是该账本成员')
    }
    return member
  }

  /** 账本详情（含成员列表） */
  async detail(bookId: string, userId: string) {
    await this.assertMember(bookId, userId)
    const book = await this.bookRepo.findOne({ where: { id: bookId } })
    if (!book) throw new NotFoundException('账本不存在')

    const members = await this.memberRepo.find({ where: { bookId } })
    return { ...book, members }
  }

  /** 更新账本（仅 owner） */
  async update(bookId: string, userId: string, dto: UpdateBookDto) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } })
    if (!book) throw new NotFoundException('账本不存在')
    if (book.ownerId !== userId) {
      throw new ForbiddenException('只有创建者可以修改账本')
    }
    Object.assign(book, dto)
    await this.bookRepo.save(book)
    return book
  }

  /** 删除账本（仅 owner） */
  async remove(bookId: string, userId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } })
    if (!book) throw new NotFoundException('账本不存在')
    if (book.ownerId !== userId) {
      throw new ForbiddenException('只有创建者可以删除账本')
    }
    await this.memberRepo.delete({ bookId })
    await this.bookRepo.delete({ id: bookId })
    return { deleted: true }
  }

  /** 通过邀请码加入账本 */
  async joinByCode(userId: string, inviteCode: string, displayName?: string) {
    const book = await this.bookRepo.findOne({ where: { inviteCode } })
    if (!book) throw new NotFoundException('邀请码无效')

    const existing = await this.memberRepo.findOne({
      where: { bookId: book.id, userId },
    })
    if (existing) return book // 已是成员，幂等返回

    await this.memberRepo.save(
      this.memberRepo.create({
        bookId: book.id,
        userId,
        displayName: displayName || '',
        role: 'member',
      }),
    )
    return book
  }
}
