import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator'

export class CreateSettlementDto {
  @IsString()
  @IsNotEmpty()
  bookId: string

  @IsString()
  @IsNotEmpty()
  fromUserId: string

  @IsString()
  @IsNotEmpty()
  toUserId: string

  @IsNumber()
  @Min(1)
  amount: number
}
