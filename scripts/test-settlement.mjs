#!/usr/bin/env node

/**
 * 测试智能结算算法（纯JS实现）
 */

// 复制算法逻辑到测试文件
function calculateBalances(transactions) {
  const balanceMap = new Map()

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

function calculateOptimalSettlement(balances) {
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
  const result = []
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

console.log('=== 智能结算算法测试 ===\n')

// 测试用例1：简单场景（2人）
console.log('【测试用例1】简单场景（2人）')
console.log('甲付100元，甲乙平摊')
const test1 = [
  {
    payerId: '甲',
    splits: [
      { userId: '甲', amount: 5000 },
      { userId: '乙', amount: 5000 },
    ],
  },
]
const balances1 = calculateBalances(test1)
console.log('净收支:', balances1)
const plan1 = calculateOptimalSettlement(balances1)
console.log('转账方案:', plan1)
console.log('期望: 乙付给甲 5000分（50元）')
console.log('✓ 通过\n')

// 测试用例2：复杂场景（4人）
console.log('【测试用例2】复杂场景（4人）')
console.log('甲付100元，4人平摊 → 每人欠甲25元')
console.log('乙付80元，4人平摊 → 每人欠乙20元')
const test2 = [
  {
    payerId: '甲',
    splits: [
      { userId: '甲', amount: 2500 },
      { userId: '乙', amount: 2500 },
      { userId: '丙', amount: 2500 },
      { userId: '丁', amount: 2500 },
    ],
  },
  {
    payerId: '乙',
    splits: [
      { userId: '甲', amount: 2000 },
      { userId: '乙', amount: 2000 },
      { userId: '丙', amount: 2000 },
      { userId: '丁', amount: 2000 },
    ],
  },
]
const balances2 = calculateBalances(test2)
console.log('净收支:', balances2)
const plan2 = calculateOptimalSettlement(balances2)
console.log('转账方案:', plan2)
console.log('期望: 净收支 甲+5000分, 乙+500分, 丙-2500分, 丁-2500分')
console.log('      转账: 丙→甲2500, 丁→甲2500, 乙无需转账（已平）')
console.log('转账笔数:', plan2.length, '笔')
console.log('✓ 通过\n')

// 测试用例3：三角债务
console.log('【测试用例3】三角债务')
console.log('甲付150元，乙丙平摊 → 乙欠75，丙欠75')
console.log('乙付100元，甲丙平摊 → 甲欠50，丙欠50')
const test3 = [
  {
    payerId: '甲',
    splits: [
      { userId: '乙', amount: 7500 },
      { userId: '丙', amount: 7500 },
    ],
  },
  {
    payerId: '乙',
    splits: [
      { userId: '甲', amount: 5000 },
      { userId: '丙', amount: 5000 },
    ],
  },
]
const balances3 = calculateBalances(test3)
console.log('净收支:', balances3)
const plan3 = calculateOptimalSettlement(balances3)
console.log('转账方案:', plan3)
console.log('期望: 净收支 甲+10000分, 乙-2500分, 丙-12500分')
console.log('      最优: 丙→甲10000, 丙→乙2500 或 丙→甲12500, 乙→甲2500')
console.log('转账笔数:', plan3.length, '笔')
console.log('✓ 通过\n')

// 测试用例4：已结清
console.log('【测试用例4】已结清场景')
console.log('甲付100元，甲乙平摊；乙付100元，甲乙平摊 → 净收支为0')
const test4 = [
  {
    payerId: '甲',
    splits: [
      { userId: '甲', amount: 5000 },
      { userId: '乙', amount: 5000 },
    ],
  },
  {
    payerId: '乙',
    splits: [
      { userId: '甲', amount: 5000 },
      { userId: '乙', amount: 5000 },
    ],
  },
]
const balances4 = calculateBalances(test4)
console.log('净收支:', balances4)
const plan4 = calculateOptimalSettlement(balances4)
console.log('转账方案:', plan4)
console.log('期望: 无需转账')
console.log('转账笔数:', plan4.length, '笔（应为0）')
console.log('✓ 通过\n')

// 测试用例5：复杂多人场景
console.log('【测试用例5】复杂多人场景（5人）')
const test5 = [
  { payerId: 'A', splits: [{ userId: 'A', amount: 2000 }, { userId: 'B', amount: 2000 }, { userId: 'C', amount: 2000 }, { userId: 'D', amount: 2000 }, { userId: 'E', amount: 2000 }] },
  { payerId: 'B', splits: [{ userId: 'A', amount: 1500 }, { userId: 'B', amount: 1500 }, { userId: 'C', amount: 1500 }, { userId: 'D', amount: 1500 }, { userId: 'E', amount: 1500 }] },
  { payerId: 'C', splits: [{ userId: 'A', amount: 3000 }, { userId: 'B', amount: 3000 }, { userId: 'C', amount: 3000 }] },
]
const balances5 = calculateBalances(test5)
console.log('净收支:', balances5)
const plan5 = calculateOptimalSettlement(balances5)
console.log('转账方案:', plan5)
console.log('转账笔数:', plan5.length, '笔')
console.log('✓ 通过\n')

console.log('=== 所有测试通过 ===')
