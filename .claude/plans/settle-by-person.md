# 按人结算明细页（待收款 / 待支付）

## 需求
点 book-detail 的「待支付/待收款」卡片 → 新页面，顶部 tab 切换待收款/待支付：
- **待收款**：显示我的头像昵称 + 列表（每个"需向我转账的人 + 净额"），可展开看构成明细，可点「已结算」
- **待支付**：列表（我需向谁付 + 净额），可展开明细，可点「已结算」

## 已确认的设计决策
1. **显示按两两净额抵扣**：我和张三之间，T1他欠我50、T2我欠他30 → 显示"张三需向我转¥20"，张三那边显示"向我待支付¥20"。
2. **结清落到账单份额**：点"已结算"时，把我和该人之间**两个方向所有相关账单份额**一次性标记结清。
3. **账单整体结清判定**：一笔账单所有参与人份额都结清后，该账单标记整体结清，从所有人列表消失。
4. **不管轮次结算**：进页面时过滤掉已被轮次结算的账单（settledRoundId 非空），只看"跟我有关联、我这边份额还没处理结算"的账单。

## 债务单元模型
一笔公账 T（付款人 P，splits 各份额）产生的债务单元 = 每个参与人 i（i≠P）欠 P 金额 `split[i].amount`。
结算追踪落在 `(transactionId, debtorUserId)` 粒度。

## 后端改动

### 1. 新实体 `TxShareSettlement`（表 tx_share_settlements）
`packages/server/src/settlement/tx-share-settlement.entity.ts`
- id (uuid)
- bookId (index)
- transactionId (index)
- debtorUserId — 欠款方（份额所属人）
- creditorUserId — 收款方（= tx.payerId，冗余便于查询）
- amount (int，该份额分)
- settledBy — 触发结算的用户
- createdAt
- 唯一约束 (transactionId, debtorUserId)

### 2. Transaction 加列 `personSettledAt`（timestamptz, nullable）
当一笔账单所有非付款人份额都进入 TxShareSettlement 时，置为 now，表示整体结清。
（synchronize:true 开发环境自动加列；生产另出 migration）

### 3. SettlementService 新增方法
- `byPerson(bookId, userId)`：
  1. 拉 shared 且 `settledRoundId IS NULL` 且 `personSettledAt IS NULL` 的账单
  2. 拉本账本所有 TxShareSettlement
  3. 遍历账单构造"活债务单元"（跳过已在 TxShareSettlement 的 (txId, debtor)）
  4. 按人两两净额：X欠我总额 − 我欠X总额 = net
     - net>0 → 待收款项（X 需转我 net）
     - net<0 → 待支付项（我需转 X |net|）
     - net==0 → 两边都不显示（无资金往来）
  5. 每对附 details：两方向所有活债务单元 [{txId, note, category, date, amount, direction: 'they_owe'|'i_owe', payerName}]
  6. 返回 { me:{avatar,nickname}, receivables:[...], payables:[...] }
- `settlePerson(bookId, userId, otherUserId)`：
  1. 找我与 otherUserId 之间所有活债务单元（两方向、未结算、账单未轮次结算）
  2. 事务内批量插 TxShareSettlement
  3. 对受影响账单，若其所有非付款人份额都已结清 → 置 personSettledAt=now
  4. 校验：otherUserId 是账本成员、与自己不同

### 4. Controller 新增
- `GET /settlements/by-person?bookId=`
- `POST /settlements/settle-person { bookId, otherUserId }`

### 5. settlement.module.ts
TypeOrmModule.forFeature 注册 TxShareSettlement。

### 6. book-detail 已结算判定（applyTxFilter）
`settled = settledRoundId 非空 || personSettledAt 非空`，未结算取反。使按人结清的账单也归入"已结算"区。

## 前端改动

### 1. 新页面 `pages/settle-detail/`（js/wxml/wxss/json）
- onLoad 接收 `bookId` + `tab`（receive/pay，决定初始 tab）
- 顶部两 tab：待收款 / 待支付
- 待收款：顶部我的头像昵称，下方列表；每项：对方头像昵称 + 净额 + 展开箭头 + 「已结算」按钮
- 展开：账单明细列表（图标/分类/备注/日期 + 方向文案 + 金额），底部"净额 ¥X"
- 待支付：同结构，文案改为"我需付给"
- 「已结算」二次确认 → 调 settlePerson → 刷新
- 加载用骨架屏（对齐项目风格）

### 2. app.json 注册 `pages/settle-detail/settle-detail`

### 3. book-detail 卡片可点击
- `.settle-stat-item pay` → 跳 settle-detail?tab=pay
- `.settle-stat-item receive` → 跳 settle-detail?tab=receive
- 传 bookId

### 4. utils/api.js 新增
- `settleByPerson(bookId)` → GET /settlements/by-person
- `settlePersonDebt(bookId, otherUserId)` → POST /settlements/settle-person

## 已知限制（写进代码注释）
1. 轮次结算(全部/部分)与按人结算混用同一账本时，round 计算不识别 TxShareSettlement，可能重复计算——不建议同一账本混用两种模式。
2. net==0 但底层份额未清的账户对，两个 tab 都不显示（无资金往来，罕见）。

## 验证
- 后端 `pnpm build` 通过
- 无法实机运行小程序，需用户在开发者工具验证跳转、tab、展开、结算刷新
