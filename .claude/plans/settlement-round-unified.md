# 结算体系统一：轮次容器 + 按人两两净额

## 核心架构（已与用户确认）
把结算统一成一套：**轮次(SettlementRound)作容器，轮次内按人两两净额展示/结算**。
- 每次「全部结算」「部分结算」都建一个轮次，把选中账单锁进轮次（`Transaction.settledRoundId`）
- 账单一旦入轮次，后续结算/选择都不再出现（可同时存在多个进行中轮次）
- settle-detail 页统一承载：全部账单模式（未入轮次的）、某轮次模式（回显该轮账单）
- 结算落在份额粒度（`TxShareSettlement`），归属到轮次
- 轮次内所有份额结清 → 轮次自动完成
- 删轮次 = 释放该轮所有账单 + 删除该轮份额结算记录

## 确认的规则
1. 轮次完成时机：**自动**（份额全清即 completed）
2. 删轮次：**释放账单**（清空 settledRoundId，删除本轮 TxShareSettlement）
3. 全部结算范围：**与我相关的未入轮次账单**
4. settle-select 列表：**只列未入轮次且与我相关**
5. 结算记录状态：**两态（进行中/已完成）**，删除即消失（不保留已取消历史）
6. 轮次内仍**按人逐个结清**

## 数据模型改动

### TxShareSettlement 加 roundId
`tx-share-settlement.entity.ts` 加：
- `roundId: string | null`（该份额结清属于哪个轮次；全部账单模式下为 null）
索引 (bookId, roundId)。

### SettlementRound 已够用
现有字段够用（id/bookId/createdBy/type/txCount/totalAmount/transferPlans/createdAt）。
- `transferPlans` 快照本轮按人净额方案（撤销/展示用），可选填
- 需要「进行中/已完成」状态：不加字段，由「本轮所有份额是否结清」动态判定（listRounds 时计算）

### Transaction.personSettledAt
现有逻辑：全账单模式下某账单所有份额结清 → 置 personSettledAt。
轮次模式下账单已被 settledRoundId 锁定，不再依赖 personSettledAt。保留现逻辑不动。

## 后端改动（settlement.service.ts + controller）

### 1. byPerson 支持 roundId 参数
`byPerson(bookId, userId, roundId?)`：
- roundId 为空（全部账单模式）：账单 = 未入轮次(`settledRoundId IS NULL`)且未整笔结清，份额集合取 `roundId IS NULL` 的 TxShareSettlement
- roundId 有值（轮次模式）：账单 = `settledRoundId = roundId`，份额集合取该 roundId 的 TxShareSettlement
- 其余两两净额逻辑不变
- 返回额外带 `roundId`、`roundStatus`（active/completed）

### 2. settlePerson 支持 roundId
`settlePerson(bookId, userId, otherUserId, roundId?)`：
- 结清份额时写入 `roundId`
- 账单范围按 roundId 过滤（同上）
- 结清后：若轮次内所有份额已清 → 轮次视为完成（无需改字段，动态判定）

### 3. 撤回按人结算（新增或复用）
`revertPerson(bookId, userId, otherUserId, roundId?)`：删除我与对方在该范围的 TxShareSettlement 记录，使其恢复待结算。
（settle-detail 已结算的卡片不消失、可撤回 → 需要展示"已结清"的对，并给撤回按钮）
→ byPerson 需同时返回**已结清的对**（settled: true 标记），前端渲染撤回按钮。

### 4. 新建轮次（部分/全部）
沿用现有 `settle(userId, dto)` 但改造：
- 不再用最优路径算法生成 transferPlans + pending Settlement 记录
- 只做：建轮次 + 把选中账单 `settledRoundId = round.id`
- 全部：`与我相关的未入轮次账单`；部分：dto.txIds
- transferPlans 快照可存按人净额（可选，用于列表展示金额概览）
- 事务 + 悲观锁防并发（现有已具备）

### 5. 轮次列表 & 进行中检测
- `listRounds(bookId, userId)`：返回所有轮次 + 每轮状态(active/completed) + 概览（人数/金额）
- `getActiveRounds(bookId)`：返回进行中轮次列表（部分结算前弹窗用）
- `revertRound(roundId)`：现有已实现（释放账单+删 Settlement），改成同时删 TxShareSettlement

### 6. controller 路由
- `GET /settlements/by-person?bookId=&roundId=`（roundId 可选）
- `POST /settlements/settle-person { bookId, otherUserId, roundId? }`
- `POST /settlements/revert-person { bookId, otherUserId, roundId? }`
- `POST /settlements/settle`（建轮次，全部/部分）—— 改造现有
- `GET /settlements/rounds?bookId=` —— 改造现有（带状态）
- `POST /settlements/rounds/:id/revert` —— 现有，补删 TxShareSettlement

## 前端改动

### 1. settle-detail 页
- onLoad 接收 `roundId`（可选）；有则轮次模式，无则全部账单模式
- byPerson/settlePerson 调用带上 roundId
- **已结算的对不消失**：byPerson 返回已结清对，渲染成"已结清"卡片 + 撤回按钮；未结清的渲染"已结算"按钮
- 轮次模式：标题显示"轮次结算"，可能隐藏 tab 或标注

### 2. settle-select 页（部分结算选账单）
- 列表过滤：`未入轮次(settledRoundId 空) 且 与我相关`（加 personSettledAt 判断）
- 底部按钮文案改「前去结算」
- 点击「前去结算」→ 调 settle（建 partial 轮次）→ 跳 settle-detail?roundId=xxx

### 3. 部分结算入口（book-detail）
- 点「部分结算」前，先查 getActiveRounds
  - 有进行中轮次 → 弹窗列出，用户可：a) 继续开新一轮（进 settle-select）；b) 删除某进行中轮次（释放账单）；c) 点某轮次进 settle-detail?roundId
  - 无 → 直接进 settle-select

### 4. 全部结算（book-detail）
- 点「全部结算」→ 调 settle（建 all 轮次，锁与我相关未入轮次账单）→ 跳 settle-detail?roundId=xxx
- 无可结算账单则提示

### 5. book-detail 快捷操作栏（图一）
- **隐藏「统计」按钮**（注释保留）
- 新增「结算记录」按钮 → 跳新页面 settle-rounds

### 6. 新页面 settle-rounds（结算记录）
- 列出所有轮次：进行中 / 已完成，显示类型(全部/部分)、账单数、金额、时间、状态
- 点某轮次 → 跳 settle-detail?roundId=xxx（回显该轮，可结算/撤回）
- 骨架屏

## 待办清单
1. 后端：TxShareSettlement 加 roundId + app.module 已注册无需改
2. 后端：byPerson / settlePerson 加 roundId；新增 revertPerson
3. 后端：改造 settle（建轮次不走最优路径）；listRounds 带状态；revertRound 删份额
4. 后端：getActiveRounds 接口
5. 前端 api.js：补 roundId 参数 + revertPerson + getActiveRounds
6. 前端 settle-detail：roundId 模式 + 已结清卡片+撤回
7. 前端 settle-select：过滤 + 前去结算建轮次跳转
8. 前端 book-detail：部分结算弹窗、全部结算建轮次、隐藏统计、加结算记录入口
9. 前端 settle-rounds 新页面 + app.json 注册
10. 后端编译验证；小程序端用户自测

## 风险/注意
- 旧的最优路径算法（calculateOptimalSettlement）、逐笔转账确认（confirmTransfer 等）在统一后**不再使用**，保留代码但入口废弃
- 数据库：TxShareSettlement 加列走 synchronize 自动加；生产需 migration
- 多轮次并存：账单靠 settledRoundId 唯一归属，天然隔离
