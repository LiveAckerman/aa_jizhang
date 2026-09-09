import { IsString, IsUUID, Length, Matches } from 'class-validator'

export class CreateAppVisitDto {
  @IsUUID()
  eventId: string

  @IsString()
  @Length(16, 64)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'visitorId 只能包含字母、数字、下划线和连字符',
  })
  visitorId: string
}
