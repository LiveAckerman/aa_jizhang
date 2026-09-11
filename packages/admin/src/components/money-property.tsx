import React from 'react'
import { Text, ValueGroup } from '@adminjs/design-system'
import { useTranslation } from 'adminjs'
import type { BasePropertyProps } from 'adminjs'

const formatters = new Map<string, Intl.NumberFormat>()

const formatterFor = (currency: string): Intl.NumberFormat => {
  const existing = formatters.get(currency)
  if (existing) return existing
  const formatter = new Intl.NumberFormat('zh-CN', { style: 'currency', currency })
  formatters.set(currency, formatter)
  return formatter
}

/** Formats a database integer in minor units as a major-unit currency amount. */
export const formatCurrencyFromMinorUnits = (value: unknown, currency = 'CNY'): string => {
  const cents =
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  const normalizedCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'CNY'
  return Number.isFinite(cents) ? formatterFor(normalizedCurrency).format(cents / 100) : '金额缺失'
}

const MoneyProperty = ({ property, record, where }: BasePropertyProps) => {
  const { translateProperty } = useTranslation()
  const currency =
    property.path === 'originalAmount' && typeof record?.params?.currency === 'string'
      ? record.params.currency.toUpperCase()
      : 'CNY'
  const content = (
    <Text>{formatCurrencyFromMinorUnits(record?.params?.[property.path], currency)}</Text>
  )

  return where === 'show' ? (
    <ValueGroup label={translateProperty(property.label, property.resourceId)}>
      {content}
    </ValueGroup>
  ) : (
    content
  )
}

export default MoneyProperty
