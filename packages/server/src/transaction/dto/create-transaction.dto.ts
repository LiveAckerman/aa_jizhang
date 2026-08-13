import {
  IsArray,
  IsIn,
  IsInt,
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

  /** 消费时间 ISO 字符串 */
  @IsOptional()
  @IsDateString()
  spentAt?: string
}
