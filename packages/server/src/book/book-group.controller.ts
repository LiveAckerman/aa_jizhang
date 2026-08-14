import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { BookGroupService } from './book-group.service'

class GroupDto {
  @IsString()
  @MinLength(1, { message: '分组名称不能为空' })
  @MaxLength(32)
  name: string
}

class AssignGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(36)
  groupId?: string
}

@Controller()
@UseGuards(JwtAuthGuard)
export class BookGroupController {
  constructor(private readonly svc: BookGroupService) {}

  /** 我的分组列表 */
  @Get('book-groups')
  async list(@CurrentUser('sub') userId: string) {
    const data = await this.svc.listMine(userId)
    return { code: 0, message: 'ok', data }
  }

  /** 新建分组 */
  @Post('book-groups')
  async create(@CurrentUser('sub') userId: string, @Body() dto: GroupDto) {
    const data = await this.svc.create(userId, dto.name)
    return { code: 0, message: 'ok', data }
  }

  /** 分组改名 */
  @Patch('book-groups/:id')
  async rename(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: GroupDto,
  ) {
    const data = await this.svc.rename(userId, id, dto.name)
    return { code: 0, message: 'ok', data }
  }

  /** 删除分组 */
  @Delete('book-groups/:id')
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const data = await this.svc.remove(userId, id)
    return { code: 0, message: 'ok', data }
  }

  /** 设置账本在我视角的分组 */
  @Patch('books/:bookId/group')
  async assign(
    @CurrentUser('sub') userId: string,
    @Param('bookId') bookId: string,
    @Body() dto: AssignGroupDto,
  ) {
    const data = await this.svc.assignBookToGroup(userId, bookId, dto.groupId || '')
    return { code: 0, message: 'ok', data }
  }
}
