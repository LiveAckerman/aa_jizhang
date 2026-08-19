import { IsArray, IsIn, IsOptional, IsUUID } from 'class-validator'

export class SettleDto {
  @IsUUID()
  bookId: string

  @IsIn(['all', 'partial'])
  type: 'all' | 'partial'

  /** partial 时必填：要结算的账单 id 列表 */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  txIds?: string[]
}
