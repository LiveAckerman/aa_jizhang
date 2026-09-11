import React, { useMemo } from 'react'
import { Box, Text, ValueGroup } from '@adminjs/design-system'
import { flat, useTranslation } from 'adminjs'
import type { BasePropertyProps } from 'adminjs'

type Split = { userId?: unknown; nickname?: unknown; amount?: unknown; weight?: unknown }

type ParsedSplits = { kind: 'empty' | 'valid' | 'invalid'; splits: Split[] }

const parseSplits = (value: unknown): ParsedSplits => {
  if (value === null || value === undefined) return { kind: 'empty', splits: [] }
  if (Array.isArray(value))
    return {
      kind: 'valid',
      splits: value.filter((item): item is Split => !!item && typeof item === 'object'),
    }
  if (typeof value !== 'string') return { kind: 'invalid', splits: [] }
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? {
          kind: 'valid',
          splits: parsed.filter((item): item is Split => !!item && typeof item === 'object'),
        }
      : { kind: 'invalid', splits: [] }
  } catch {
    return { kind: 'invalid', splits: [] }
  }
}

const cny = (amount: unknown): string =>
  typeof amount === 'number' && Number.isFinite(amount)
    ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount / 100)
    : '金额缺失'

const SplitsProperty = ({ property, record, where }: BasePropertyProps) => {
  const { translateProperty } = useTranslation()
  const value = flat.get(record?.params ?? {}, property.path)
  const parsed = useMemo(() => parseSplits(value), [value])
  const splits = parsed.splits
  const type = flat.get(record?.params ?? {}, 'type')
  const method = flat.get(record?.params ?? {}, 'splitMethod')
  const totalWeight =
    splits?.reduce(
      (sum, split) => sum + (typeof split.weight === 'number' ? split.weight : 0),
      0,
    ) ?? 0
  const content =
    parsed.kind === 'invalid' ? (
      <Text fontSize="sm" color="grey60">
        分摊明细格式异常
      </Text>
    ) : !splits.length ? (
      <Text fontSize="sm" color="grey60">
        {type === 'private' ? '私密账不参与分摊' : '暂无分摊明细'}
      </Text>
    ) : (
      <Box>
        {splits.map((split, index) => {
          const userId =
            typeof split.userId === 'string' && split.userId ? split.userId : '成员 ID 缺失'
          const nickname = typeof split.nickname === 'string' ? split.nickname.trim() : ''
          const displayName = nickname || (userId === '成员 ID 缺失' ? userId : `用户 ${userId}`)
          const weight =
            typeof split.weight === 'number' && Number.isFinite(split.weight) ? split.weight : null
          const weightLabel =
            method === 'shares' && weight !== null
              ? ` · 份额 ${weight}`
              : method === 'ratio' && weight !== null
                ? ` · 比例权重 ${weight}${totalWeight > 0 ? `（${((weight / totalWeight) * 100).toFixed(1)}%）` : ''}`
                : ''
          return (
            <Box
              key={`${userId}-${index}`}
              py="sm"
              style={{ borderBottom: '1px solid var(--colors-grey20, #e0e0e0)' }}
            >
              {userId === '成员 ID 缺失' ? (
                <Text fontSize="sm">{displayName}</Text>
              ) : (
                <a href={`/admin/resources/users/records/${encodeURIComponent(userId)}/show`}>
                  <Text fontSize="sm">{displayName}</Text>
                </a>
              )}
              <Text fontSize="sm" color="grey60">
                承担 {cny(split.amount)}
                {weightLabel}
              </Text>
            </Box>
          )
        })}
      </Box>
    )
  return where === 'show' ? (
    <ValueGroup label={translateProperty(property.label, property.resourceId)}>
      {content}
    </ValueGroup>
  ) : (
    content
  )
}

export default SplitsProperty
