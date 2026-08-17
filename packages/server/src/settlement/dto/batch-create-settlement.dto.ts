import { IsArray, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { CreateSettlementDto } from './create-settlement.dto'

class SettlementItem {
  @IsUUID()
  @IsNotEmpty()
  fromUserId: string

  @IsUUID()
  @IsNotEmpty()
  toUserId: string

  @IsNotEmpty()
  amount: number
}

export class BatchCreateSettlementDto {
  @IsUUID()
  @IsNotEmpty()
  bookId: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettlementItem)
  settlements: SettlementItem[]
}
