import { IsString, IsOptional, MaxLength } from 'class-validator'

export class UpdateWechatProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: '昵称最多64个字符' })
  nickname?: string

  @IsOptional()
  @IsString()
  avatar?: string
}
