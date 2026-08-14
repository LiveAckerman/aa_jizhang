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
