import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { UpdateProfileDto } from '../user/dto/update-profile.dto'
import { UserService } from '../user/user.service'
import { CreateBookDto } from '../book/dto/create-book.dto'
import { UpdateBookDto } from '../book/dto/update-book.dto'
import { BookService } from '../book/book.service'
import { CreateTransactionDto } from '../transaction/dto/create-transaction.dto'
import { UpdateTransactionDto } from '../transaction/dto/update-transaction.dto'
import { TransactionService } from '../transaction/transaction.service'
import { AdminApiGuard, AdminApiRequest } from './admin-api.guard'
import { AdminService } from './admin.service'
import { IsUUID } from 'class-validator'

class AdminCreateBookDto extends CreateBookDto {
  @IsUUID('4', { message: '创建者用户 ID 无效' })
  ownerId: string
}

class AdminCreateTransactionDto extends CreateTransactionDto {
  @IsUUID('4', { message: '记录创建者用户 ID 无效' })
  creatorId: string
}

const ok = (data: unknown, message = 'ok') => ({
  code: 0,
  message,
  data,
})

@Controller('admin')
@UseGuards(AdminApiGuard)
export class AdminController {
  constructor(
    private readonly userService: UserService,
    private readonly bookService: BookService,
    private readonly transactionService: TransactionService,
    private readonly adminService: AdminService,
  ) {}

  @Patch('users/:id')
  async updateUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProfileDto,
    @Req() request: AdminApiRequest,
  ) {
    const user = await this.userService.updateProfile(id, dto)
    await this.adminService.audit({
      actor: request.adminActor,
      action: 'update',
      resource: 'users',
      resourceId: id,
      payload: { nickname: dto.nickname, avatar: dto.avatar },
    })
    return ok(this.userService.toClientUser(user), '用户资料已更新')
  }

  @Post('books')
  async createBook(
    @Body() dto: AdminCreateBookDto,
    @Req() request: AdminApiRequest,
  ) {
    const { ownerId, ...bookDto } = dto
    await this.userService.findById(ownerId)
    const book = await this.bookService.create(ownerId, bookDto)
    await this.adminService.audit({
      actor: request.adminActor,
      action: 'create',
      resource: 'books',
      resourceId: book.id,
      payload: { ownerId, ...bookDto },
    })
    return ok(book, '账本已创建')
  }

  @Patch('books/:id')
  async updateBook(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateBookDto,
    @Req() request: AdminApiRequest,
  ) {
    const book = await this.bookService.getRaw(id)
    const updated = await this.bookService.update(id, book.ownerId, dto)
    await this.adminService.audit({
      actor: request.adminActor,
      action: 'update',
      resource: 'books',
      resourceId: id,
      payload: { ...dto },
    })
    return ok(updated, '账本已更新')
  }

  @Delete('books/:id')
  async deleteBook(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AdminApiRequest,
  ) {
    const book = await this.bookService.getRaw(id)
    const result = await this.bookService.remove(id, book.ownerId)
    await this.adminService.audit({
      actor: request.adminActor,
      action: 'delete',
      resource: 'books',
      resourceId: id,
      payload: null,
    })
    return ok(result, '账本已删除')
  }

  @Post('transactions')
  async createTransaction(
    @Body() dto: AdminCreateTransactionDto,
    @Req() request: AdminApiRequest,
  ) {
    const { creatorId, ...transactionDto } = dto
    const transaction = await this.transactionService.create(
      creatorId,
      transactionDto,
    )
    await this.adminService.audit({
      actor: request.adminActor,
      action: 'create',
      resource: 'transactions',
      resourceId: transaction.id,
      payload: { creatorId, ...transactionDto },
    })
    return ok(transaction, '账单已创建')
  }

  @Patch('transactions/:id')
  async updateTransaction(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTransactionDto,
    @Req() request: AdminApiRequest,
  ) {
    const transaction = await this.transactionService.getRaw(id)
    const updated = await this.transactionService.update(
      id,
      transaction.creatorId,
      dto,
    )
    await this.adminService.audit({
      actor: request.adminActor,
      action: 'update',
      resource: 'transactions',
      resourceId: id,
      payload: { ...dto },
    })
    return ok(updated, '账单已更新')
  }

  @Delete('transactions/:id')
  async deleteTransaction(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AdminApiRequest,
  ) {
    const transaction = await this.transactionService.getRaw(id)
    const result = await this.transactionService.remove(
      id,
      transaction.creatorId,
    )
    await this.adminService.audit({
      actor: request.adminActor,
      action: 'delete',
      resource: 'transactions',
      resourceId: id,
      payload: null,
    })
    return ok(result, '账单已删除')
  }

  @Get('health')
  health() {
    return ok({ enabled: true })
  }
}
