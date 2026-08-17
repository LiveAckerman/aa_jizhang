import { IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator'

export class CreateSettlementDto {
  @IsUUID()
  @IsNotEmpty()
  bookId: string

  @IsUUID()
  @IsNotEmpty()
  fromUserId: string

  @IsUUID()
  @IsNotEmpty()
  toUserId: string

  @IsNumber()
  @Min(1)
  amount: number
}
