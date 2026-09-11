import React, { useMemo, useState } from 'react'
import { Box, Text, ValueGroup } from '@adminjs/design-system'
import { flat, useTranslation } from 'adminjs'
import type { BasePropertyProps } from 'adminjs'
import ImageLightbox from './image-lightbox.js'

const parseUrls = (value: unknown): string[] => {
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      parsed = value
    }
  }
  const values = Array.isArray(parsed) ? parsed : [parsed]
  return values.flatMap((entry) => {
    if (typeof entry !== 'string') return []
    try {
      const url = new URL(entry)
      return url.protocol === 'https:' || url.protocol === 'http:' ? [url.toString()] : []
    } catch {
      return []
    }
  })
}

const stopRowPointer = (event: React.PointerEvent<HTMLButtonElement>): void => {
  event.preventDefault()
  event.stopPropagation()
}

const ImagePreview = ({
  url,
  label,
  compact,
  open,
}: {
  url: string
  label: string
  compact: boolean
  open: () => void
}) => {
  const [failed, setFailed] = useState(false)
  if (failed)
    return (
      <Text fontSize="sm" color="grey60">
        图片不可用
      </Text>
    )
  return (
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
      aria-label={`查看${label}原图`}
      style={{
        display: 'block',
        padding: 0,
        border: 0,
        background: 'transparent',
        cursor: 'zoom-in',
        lineHeight: 0,
      }}
    >
      <img
        src={url}
        alt={label}
        onError={() => setFailed(true)}
        style={{
          display: 'block',
          width: compact ? 40 : 96,
          height: compact ? 40 : 96,
          objectFit: 'cover',
          borderRadius: 4,
        }}
      />
    </button>
  )
}

const MediaProperty = ({ property, record, where }: BasePropertyProps) => {
  const { translateProperty } = useTranslation()
  const urls = useMemo(
    () => parseUrls(flat.get(record?.params ?? {}, property.path)),
    [property.path, record?.params],
  )
  const compact = where === 'list'
  const label = property.label || '图片'
  const displayed = compact ? urls.slice(0, 1) : urls
  const content = !urls.length ? (
    <Text fontSize="sm" color="grey60">
      暂无图片
    </Text>
  ) : (
    <ImageLightbox urls={urls} label={label}>
      {(open) => (
        <Box display="flex" flexWrap="wrap" style={{ gap: 8 }}>
          {displayed.map((url, index) => (
            <ImagePreview
              key={`${url}-${index}`}
              url={url}
              label={label}
              compact={compact}
              open={() => open(index)}
            />
          ))}
          {compact && urls.length > 1 && (
            <Text fontSize="sm" color="grey60">
              +{urls.length - 1}
            </Text>
          )}
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

export default MediaProperty
