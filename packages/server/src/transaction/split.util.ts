import { BadRequestException } from '@nestjs/common'
import type { SplitDetail, SplitMethod } from './transaction.entity'

/**
 * 计算分账明细
 * @param method    分账方式
 * @param amount    总金额（分）
 * @param participantIds  参与人（average 使用）
 * @param splits    手动明细（ratio/shares/fixed 使用）
 */
export function computeSplits(
  method: SplitMethod,
  amount: number,
  participantIds?: string[],
  splits?: SplitDetail[],
): SplitDetail[] {
  switch (method) {
    case 'average':
      return splitAverage(amount, participantIds)
    case 'ratio':
      return splitByWeight(amount, splits) // weight 为百分比
    case 'shares':
      return splitByWeight(amount, splits) // weight 为份数
    case 'fixed':
      return validateFixed(amount, splits)
    default:
      throw new BadRequestException('未知的分账方式')
  }
}

/** 平均分摊，余数分给前几个人，保证总和精确 */
function splitAverage(amount: number, participantIds?: string[]): SplitDetail[] {
  if (!participantIds || participantIds.length === 0) {
    throw new BadRequestException('平均分摊需要指定参与人')
  }
  const n = participantIds.length
  const base = Math.floor(amount / n)
  let remainder = amount - base * n
  return participantIds.map((userId) => {
    const extra = remainder > 0 ? 1 : 0
    remainder -= extra
    return { userId, amount: base + extra }
  })
}

/** 按权重（比例/份数）分摊，余数补给最后一人 */
function splitByWeight(amount: number, splits?: SplitDetail[]): SplitDetail[] {
  if (!splits || splits.length === 0) {
    throw new BadRequestException('该分账方式需要提供每人的权重')
  }
  const totalWeight = splits.reduce((sum, s) => sum + (s.weight || 0), 0)
  if (totalWeight <= 0) {
    throw new BadRequestException('权重总和必须大于 0')
  }
  let allocated = 0
  const result = splits.map((s, idx) => {
    let amt: number
    if (idx === splits.length - 1) {
      amt = amount - allocated // 最后一人补齐余数
    } else {
      amt = Math.floor((amount * (s.weight || 0)) / totalWeight)
      allocated += amt
    }
    return { userId: s.userId, amount: amt, weight: s.weight }
  })
  return result
}

/** 指定金额，校验总和等于总金额 */
function validateFixed(amount: number, splits?: SplitDetail[]): SplitDetail[] {
  if (!splits || splits.length === 0) {
    throw new BadRequestException('指定金额分账需要提供每人金额')
  }
  const sum = splits.reduce((s, item) => s + item.amount, 0)
  if (sum !== amount) {
    throw new BadRequestException(`分账金额总和(${sum})与账单金额(${amount})不一致`)
  }
  return splits.map((s) => ({ userId: s.userId, amount: s.amount }))
}
