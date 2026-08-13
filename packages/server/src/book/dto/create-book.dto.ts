import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import type { BookScene } from '../book.entity'

const SCENES = ['travel', 'dinner', 'rent', 'activity', 'custom']

export class CreateBookDto {
  @IsString()
  @MinLength(1, { message: '账本名称不能为空' })
  @MaxLength(64, { message: '账本名称过长' })
  name: string

  @IsOptional()
  @IsIn(SCENES, { message: '无效的场景类型' })
  scene?: BookScene

  @IsOptional()
  @IsString()
  @MaxLength(128)
  icon?: string
}
