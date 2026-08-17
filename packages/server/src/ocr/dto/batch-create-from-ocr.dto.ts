import { IsNotEmpty, IsString, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class TransactionItemDto {
  @IsString()
  @IsNotEmpty()
  bookId: string

  @IsString()
  type: 'shared' | 'private'

  @IsNotEmpty()
  amount: number

  @IsString()
  category: string

  @IsString()
  note: string

  @IsString()
  spentAt: string
}

export class BatchCreateFromOcrDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionItemDto)
  transactions: TransactionItemDto[]
}
