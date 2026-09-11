import React from 'react'
import { Avatar, Box, Text, ValueGroup } from '@adminjs/design-system'
import { useTranslation } from 'adminjs'
import type { BasePropertyProps } from 'adminjs'
import ImageLightbox from './image-lightbox.js'

type UserParams = {
  id?: unknown
  nickname?: unknown
  avatar?: unknown
}

const asText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value)

const safeAvatarUrl = (value: unknown): string | undefined => {
  const candidate = asText(value)
  if (!candidate) return undefined
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const initials = (nickname: string): string => {
  const value = nickname.trim()
  return value ? (Array.from(value)[0] ?? '?') : '?'
}

const stopRowPointer = (event: React.PointerEvent<HTMLButtonElement>): void => {
  event.preventDefault()
  event.stopPropagation()
}

const UserProperty = ({ property, record, where }: BasePropertyProps) => {
  const { translateProperty } = useTranslation()
  const userId = asText(record?.params?.[property.path])
  const populated = record?.populated?.[property.path]
  const user = (populated?.params ?? {}) as UserParams
  const nickname =
    asText(user.nickname) || asText(populated?.title) || (userId ? '未设置昵称' : '—')
  const avatar = safeAvatarUrl(user.avatar)
  const missingUser = Boolean(userId) && !populated
  const compact = where === 'list'

  const content = (
    <ImageLightbox urls={avatar ? [avatar] : []} label={`${nickname}头像`}>
      {(open) => (
        <Box
          display="flex"
          alignItems="center"
          style={{ gap: 8, minWidth: 0 }}
          title={missingUser ? '关联用户不存在' : undefined}
        >
          <button
            type="button"
            onPointerDown={stopRowPointer}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              open()
            }}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={`查看${nickname}头像`}
            style={{
              display: 'block',
              padding: 0,
              border: 0,
              borderRadius: '50%',
              background: 'transparent',
              cursor: avatar ? 'zoom-in' : 'default',
              lineHeight: 0,
            }}
            disabled={!avatar}
          >
            <Avatar
              src={avatar}
              alt={`${nickname}头像`}
              style={{
                width: compact ? 28 : 36,
                height: compact ? 28 : 36,
                fontSize: compact ? 12 : 16,
              }}
            >
              {initials(nickname)}
            </Avatar>
          </button>
          <Box style={{ minWidth: 0 }}>
            <Text
              fontSize={compact ? 'sm' : undefined}
              style={{
                display: 'block',
                maxWidth: compact ? 180 : 320,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {nickname}
            </Text>
            {missingUser && (
              <Text
                fontSize="xs"
                color="grey60"
                style={{
                  display: 'block',
                  maxWidth: compact ? 180 : 320,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                用户不存在
              </Text>
            )}
          </Box>
        </Box>
      )}
    </ImageLightbox>
  )

  return where === 'show' ? (
    <ValueGroup label={translateProperty(property.label, property.resourceId)}>
      {content}
    </ValueGroup>
  ) : (
    content
  )
}

export default UserProperty
