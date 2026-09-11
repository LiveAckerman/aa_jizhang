import React, { useCallback, useMemo, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import type { ReactNode } from 'react'

type ImageLightboxProps = {
  urls: readonly string[]
  label: string
  children: (open: (index?: number) => void) => ReactNode
}

/**
 * Renders image triggers and keeps the lightbox in the same AdminJS page.
 * The trigger is a button so it is keyboard accessible and can stop AdminJS
 * row navigation from receiving the click.
 */
const ImageLightbox = ({ urls, label, children }: ImageLightboxProps) => {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const slides = useMemo(() => urls.map((src) => ({ src })), [urls])

  const openAt = useCallback(
    (nextIndex = 0) => {
      setIndex(Math.max(0, Math.min(nextIndex, Math.max(slides.length - 1, 0))))
      setOpen(true)
    },
    [slides.length],
  )

  if (!urls.length) return <>{children(openAt)}</>

  return (
    <>
      {children(openAt)}
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={index}
        slides={slides}
        labels={{
          Close: '关闭',
          Previous: '上一张',
          Next: '下一张',
          Slide: `${label}`,
          Carousel: `${label}轮播图`,
          Lightbox: `${label}预览`,
          'Photo gallery': `${label}图片集`,
          '{index} of {total}': '{index} / {total}',
        }}
      />
    </>
  )
}

export default ImageLightbox
