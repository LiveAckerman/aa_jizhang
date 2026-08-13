import { IsString, IsOptional, MaxLength } from 'class-validator'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '昵称最多20个字符' })
  nickname?: string

  @IsOptional()
  @IsString()
  avatar?: string
}
