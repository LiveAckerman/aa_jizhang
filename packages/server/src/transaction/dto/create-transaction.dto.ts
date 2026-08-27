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

  @IsInt()
  @Min(0)
  amount: number

  @IsOptional()
  @IsInt()
  weight?: number
}

export class CreateTransactionDto {
  @IsString()
  bookId: string

  /** 共享账 or 私密账 */
  @IsIn(['shared', 'private'], { message: '无效的账单类型' })
  type: TransactionType

  /** 金额（分） */
  @IsInt({ message: '金额必须为整数（单位分）' })
  @Min(1, { message: '金额必须大于 0' })
  amount: number

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

  /** 付款人（私密账固定为自己，可省略） */
  @IsOptional()
  @IsString()
  payerId?: string

  /** 分账方式（仅共享账） */
  @IsOptional()
  @IsIn(['average', 'ratio', 'shares', 'fixed'])
  splitMethod?: SplitMethod

  /** 参与人 id 列表（仅共享账，用于 average 均摊） */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[]

  /** 分账明细（ratio/shares/fixed 方式下传入） */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitDetailDto)
  splits?: SplitDetailDto[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[]

  /** 地点名称 */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  locationName?: string

  /** 详细地址 */
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

  /** 消费时间 ISO 字符串 */
  @IsOptional()
  @IsDateString()
  spentAt?: string

  /**
   * 原始货币代码（如 'USD'），默认 'CNY'。
   * 与 amount 关系：amount 始终是已折算成 CNY 的金额（分）；currency 非 CNY 时
   * 需前端同时传 originalAmount 原始金额（分）+ exchangeRate 快照汇率。
   */
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
