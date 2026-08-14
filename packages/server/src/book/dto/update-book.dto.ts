import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import type { BookScene } from '../book.entity'

const SCENES = ['travel', 'dinner', 'rent', 'activity', 'custom']

export class UpdateBookDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string

  @IsOptional()
  @IsIn(SCENES)
  scene?: BookScene

  @IsOptional()
  @IsString()
  @MaxLength(128)
  icon?: string

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cover?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string

  @IsOptional()
  @IsBoolean()
  archived?: boolean
}
