import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
  IsDateString,
} from 'class-validator'
import { Type } from 'class-transformer'
import type { SplitMethod, TransactionType } from '../transaction.entity'

class SplitDetailDto {
  @IsString()
  userId: string

  // amount 可选：ratio/shares 方式下由后端按 weight 计算，前端只传 weight；
  // 仅 fixed（指定金额）方式需要传 amount（其总和校验在 computeSplits 里做）
  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number

  @IsOptional()
  @IsInt()
  weight?: number
}

/** 更新账单：所有字段可选，bookId 不可修改（服务层忽略） */
export class UpdateTransactionDto {
  @IsOptional()
  @IsIn(['shared', 'private'])
  type?: TransactionType

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number

  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string

  @IsOptional()
  @IsString()
  @MaxLength(16)
  paymentMethod?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string

  @IsOptional()
  @IsString()
  payerId?: string

  @IsOptional()
  @IsIn(['average', 'ratio', 'shares', 'fixed'])
  splitMethod?: SplitMethod

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitDetailDto)
  splits?: SplitDetailDto[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(128)
  locationName?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationAddress?: string

  @IsOptional()
  @IsNumber()
  latitude?: number

  @IsOptional()
  @IsNumber()
  longitude?: number

  @IsOptional()
  @IsDateString()
  spentAt?: string

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  originalAmount?: number

  @IsOptional()
  @IsNumber()
  exchangeRate?: number
}
