/**
 * 智能结算算法：最小化转账次数
 * 使用贪心算法计算最优转账方案
 */

export interface UserBalance {
  userId: string
  balance: number // 正数=应收，负数=应付
}

export interface TransferPlan {
  fromUserId: string // 付款方
  toUserId: string // 收款方
  amount: number // 金额（分）
}

/**
 * 计算最优结算方案
 * @param balances 每人的净收支（正数=应收，负数=应付）
 * @returns 最优转账方案（最少转账次数）
 */
export function calculateOptimalSettlement(
  balances: UserBalance[],
): TransferPlan[] {
  // 过滤掉余额为0的用户
  const nonZero = balances.filter((b) => Math.abs(b.balance) > 0)
  if (nonZero.length === 0) return []

  // 分离债权人（应收>0）和债务人（应付<0）
  const creditors = nonZero
    .filter((b) => b.balance > 0)
    .map((b) => ({ userId: b.userId, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount) // 降序

  const debtors = nonZero
    .filter((b) => b.balance < 0)
    .map((b) => ({ userId: b.userId, amount: -b.balance }))
    .sort((a, b) => b.amount - a.amount) // 降序

  // 贪心匹配
  const result: TransferPlan[] = []
  let i = 0
  let j = 0

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i]
    const debtor = debtors[j]

    // 取最小值进行匹配
    const transferAmount = Math.min(creditor.amount, debtor.amount)

    result.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amount: transferAmount,
    })

    // 更新余额
    creditor.amount -= transferAmount
    debtor.amount -= transferAmount

    // 余额为0则移到下一个
    if (creditor.amount === 0) i++
    if (debtor.amount === 0) j++
  }

  return result
}

/**
 * 从交易记录计算每人的净收支
 * @param transactions 交易记录数组
 * @returns 每人的净收支
 */
export function calculateBalances(
  transactions: Array<{
    payerId: string
    splits: Array<{ userId: string; amount: number }>
  }>,
): UserBalance[] {
  const balanceMap = new Map<string, number>()

  for (const tx of transactions) {
    // 付款人：增加金额（应收）
    const payerBalance = balanceMap.get(tx.payerId) || 0
    balanceMap.set(tx.payerId, payerBalance + tx.splits.reduce((sum, s) => sum + s.amount, 0))

    // 参与人：减少金额（应付）
    for (const split of tx.splits) {
      const participantBalance = balanceMap.get(split.userId) || 0
      balanceMap.set(split.userId, participantBalance - split.amount)
    }
  }

  return Array.from(balanceMap.entries()).map(([userId, balance]) => ({
    userId,
    balance,
  }))
}
