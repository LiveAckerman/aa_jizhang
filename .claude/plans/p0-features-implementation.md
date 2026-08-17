# P0功能实现计划

## 目标
完成3个P0优先级功能，使产品达到基本可用状态：
1. **智能结算闭环** — 核心差异化功能
2. **非平均分账的前端输入界面** — 完善分账体验
3. **成员移除的前端入口** — 完善成员管理

---

## 功能1：智能结算闭环

### 现状分析
- ✅ 后端已有分账计算逻辑（`split.util.ts`）
- ✅ Transaction实体已有完整的splits字段
- ❌ 缺少结算计算算法（最小化转账次数）
- ❌ 缺少结算状态存储
- ❌ 缺少前端结算页面

### 实现方案

#### 后端部分

**1. 创建Settlement实体** (`packages/server/src/settlement/`)
```typescript
// settlement.entity.ts
@Entity('settlements')
class Settlement {
  id: string
  bookId: string
  fromUserId: string  // 付款方
  toUserId: string    // 收款方
  amount: number      // 金额（分）
  status: 'pending' | 'completed'  // 待结算 | 已完成
  completedAt?: Date
  createdAt: Date
}
```

**2. 创建结算算法** (`packages/server/src/settlement/settlement.algorithm.ts`)
- 实现贪心算法：计算每人净收支（应收-应付）
- 使用产品设计文档附录A的算法：
  - 分离债权人（应收>0）和债务人（应付<0）
  - 按金额降序排序
  - 贪心匹配，最小化转账笔数

**3. 创建SettlementService**
- `calculate(bookId)` — 计算账本当前结算方案，返回转账清单（不持久化）
- `settle(bookId, fromUserId, toUserId, amount)` — 创建结算记录
- `complete(settlementId, userId)` — 标记结算完成
- `list(bookId)` — 查询账本结算记录

**4. 创建SettlementController**
```
GET  /api/settlements/calculate?bookId=xxx  计算结算方案
POST /api/settlements                       创建结算记录
PATCH /api/settlements/:id/complete         标记已完成
GET  /api/settlements?bookId=xxx            结算记录列表
```

#### 前端部分

**1. 创建结算页面** (`packages/miniapp/pages/settlement/`)
- 从账本详情页「结算」按钮进入
- 展示结算方案：
  - 每人净收支汇总（付出多少、应收多少）
  - 最优转账方案（谁付给谁多少）
  - 总共需要X笔转账
- 操作：
  - 标记某笔已完成（弹窗确认）
  - 全部完成后显示庆祝动画

**2. 更新账本详情页**
- 快捷操作区增加「结算」按钮
- 若有待结算金额，显示红点提示

**3. 统计页增强**
- 添加「结算状态」卡片
  - 我应收金额（来自谁）
  - 我应付金额（给谁）
  - 点击进入结算页

---

## 功能2：非平均分账的前端输入界面

### 现状分析
- ✅ 后端已支持ratio/shares/fixed三种分账方式（`split.util.ts`）
- ✅ 记账页已有splitMethod选择器
- ❌ 选择ratio/shares/fixed后，缺少逐成员输入weight/amount的界面
- ❌ 当前实现：前端硬编码weight=1或平均分fixed

### 实现方案

#### 前端实现 (`packages/miniapp/pages/add-transaction/`)

**1. 增加分账明细弹窗**
- 点击「分账方式」后，若选择非average方式，弹出「分账明细」弹窗
- 弹窗内容：
  - **按比例（ratio）**：每人输入百分比（总和需=100%）
    - 显示：成员头像+昵称+百分比输入框
    - 实时校验：总和是否=100%，底部显示校验提示
  - **按份额（shares）**：每人输入份数
    - 显示：成员头像+昵称+份数输入框（默认1）
    - 自动计算：每份=总额÷总份数，显示每人实际金额
  - **指定金额（fixed）**：每人输入金额
    - 显示：成员头像+昵称+金额输入框
    - 实时校验：总和是否=总额，底部显示差额提示
- 底部按钮：「确定」/「取消」

**2. 数据结构调整**
```javascript
data: {
  splitMethod: 'average',
  splitDetails: [],  // 新增：存储每人的weight或amount
  // splitDetails格式示例：
  // ratio:  [{userId: 'xxx', weight: 30}, {userId: 'yyy', weight: 70}]
  // shares: [{userId: 'xxx', weight: 2}, {userId: 'yyy', weight: 1}]
  // fixed:  [{userId: 'xxx', amount: 5000}, {userId: 'yyy', amount: 3000}]
}
```

**3. 交互流程**
```
用户点击「按比例分摊」
  ↓
打开分账明细弹窗
  ↓
用户为每人输入百分比（如：甲30%、乙70%）
  ↓
实时校验总和=100%，若不满足则底部提示「总和需为100%」
  ↓
点击「确定」，关闭弹窗，保存到splitDetails
  ↓
保存账单时，将splitDetails传给后端payload.splits
```

**4. UI设计**
- 弹窗使用毛玻璃效果（与现有风格一致）
- 输入框：圆角、浅色边框、数字键盘
- 校验提示：底部红色小字或绿色对勾

---

## 功能3：成员移除的前端入口

### 现状分析
- ✅ 后端已有移除成员接口：`DELETE /api/books/:id/members/:userId`
- ✅ 后端逻辑完整：仅owner可移除，不能移除自己
- ❌ 前端缺少操作入口

### 实现方案

#### 方案选择
两种方案任选其一（建议方案1，与现有流程一致）：

**方案1：账本详情页 → 成员头像长按**
- 在账本详情页，成员头像支持长按
- 长按后弹出操作菜单（仅owner可见）：
  - 查看成员信息
  - 移除成员（红色）
- 点击「移除成员」弹窗二次确认
- 确认后调用删除接口，刷新页面

**方案2：新建成员管理页**
- 账本详情页右上角菜单增加「成员管理」
- 进入成员管理页，显示成员列表：
  - 头像+昵称+角色标签
  - owner成员显示「创建者」标签
  - 普通成员显示滑动删除按钮（仅owner可见）
- 左滑成员项，显示「移除」按钮

#### 选定方案1实现细节

**1. 修改账本详情页** (`packages/miniapp/pages/book-detail/`)
```javascript
// book-detail.js 增加方法
onLongPressMember(e) {
  const { userid } = e.currentTarget.dataset
  if (!this.data.isOwner) return  // 非owner不可操作
  if (userid === this.data.myUserId) return  // 不能移除自己
  
  const member = this.data.members.find(m => m.userId === userid)
  wx.showActionSheet({
    itemList: ['查看信息', '移除成员'],
    itemColor: ['#2f4159', '#fa9583'],
    success: (res) => {
      if (res.tapIndex === 1) {
        this.confirmRemoveMember(member)
      }
    }
  })
}

confirmRemoveMember(member) {
  wx.showModal({
    title: '移除成员',
    content: `确定将「${member.nickname}」移出账本吗？该成员的账单记录将保留。`,
    confirmColor: '#fa9583',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await api.removeMember(this.data.id, member.userId)
        wx.showToast({ title: '已移除', icon: 'success' })
        this.loadAll()  // 刷新页面
      } catch (e) {
        wx.showToast({ title: e.message || '操作失败', icon: 'none' })
      }
    }
  })
}
```

**2. 修改WXML**
```xml
<!-- book-detail.wxml -->
<image
  wx:for="{{members}}"
  wx:key="userId"
  class="member-avatar"
  src="{{item.avatar}}"
  mode="aspectFill"
  data-userid="{{item.userId}}"
  bindlongpress="onLongPressMember"
/>
```

**3. 增加API方法** (`packages/miniapp/utils/api.js`)
```javascript
function removeMember(bookId, userId) {
  return request(`/books/${bookId}/members/${userId}`, { method: 'DELETE' })
}
```

---

## 实现顺序

### 阶段1：智能结算算法（后端）
1. 创建Settlement实体和migration
2. 实现结算算法（settlement.algorithm.ts）
3. 创建SettlementService和Controller
4. 测试：编写测试脚本验证算法正确性

### 阶段2：结算页面（前端）
1. 创建结算页面UI和交互
2. 对接后端结算接口
3. 更新账本详情页增加结算入口
4. 更新统计页增加结算状态卡片

### 阶段3：分账输入界面（前端）
1. 创建分账明细弹窗组件
2. 实现ratio/shares/fixed三种输入模式
3. 添加实时校验逻辑
4. 对接保存流程

### 阶段4：成员移除（前端）
1. 添加成员长按事件
2. 实现移除确认流程
3. 对接后端删除接口
4. 测试owner/member权限

---

## 技术细节

### 数据库迁移
需要创建settlements表（PostgreSQL）：
```sql
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  status VARCHAR(16) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_settlements_book ON settlements(book_id);
CREATE INDEX idx_settlements_status ON settlements(status);
```

### 算法伪代码
```typescript
function calculateSettlement(bookId: string) {
  // 1. 拉取账本所有共享账单
  const txs = await txRepo.find({ bookId, type: 'shared' })
  
  // 2. 计算每人净收支
  const balance = new Map<userId, number>()
  for (const tx of txs) {
    // 付款人：+amount
    balance[tx.payerId] += tx.amount
    // 参与人：-splits.amount
    for (const split of tx.splits) {
      balance[split.userId] -= split.amount
    }
  }
  
  // 3. 分离债权人和债务人
  const creditors = []  // {userId, amount}，amount>0
  const debtors = []    // {userId, amount}，amount<0
  for (const [userId, amt] of balance) {
    if (amt > 0) creditors.push({userId, amount: amt})
    else if (amt < 0) debtors.push({userId, amount: -amt})
  }
  
  // 4. 贪心匹配
  creditors.sort((a,b) => b.amount - a.amount)
  debtors.sort((a,b) => b.amount - a.amount)
  
  const result = []
  let i = 0, j = 0
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i]
    const debtor = debtors[j]
    const transfer = Math.min(creditor.amount, debtor.amount)
    
    result.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: transfer
    })
    
    creditor.amount -= transfer
    debtor.amount -= transfer
    if (creditor.amount === 0) i++
    if (debtor.amount === 0) j++
  }
  
  return result
}
```

### 前端校验规则
- **按比例**：总和必须=100%，误差±0.01%可接受（浮点精度）
- **按份额**：份数必须>0，整数或小数均可
- **指定金额**：总和必须=总金额（精确到分）

---

## 测试计划

### 智能结算算法测试
```javascript
// scripts/test-settlement.mjs
测试用例1：简单场景（2人）
  甲付100，乙参与 → 乙付给甲50
  
测试用例2：复杂场景（4人）
  甲付100，4人平摊 → 每人欠甲25
  乙付80，4人平摊 → 每人欠乙20
  净收支：甲+50，乙+5，丙-25，丁-25
  最优方案：丙付给甲25，丁付给甲25，乙无需转账

测试用例3：已结算部分
  创建结算记录，标记完成后，重新计算应排除已结算金额
```

### 前端交互测试
- 分账明细输入各种边界情况（负数、小数、总和不对等）
- 成员移除权限（owner/member/移除自己）
- 结算流程完整性（计算→确认→标记完成）

---

## 风险与注意事项

1. **结算记录与账单一致性**
   - 账单修改/删除后，已有结算记录可能失效
   - 方案：结算页面实时计算，不依赖历史结算记录
   - 或：账单变更后清空待结算记录，提示用户重新结算

2. **浮点精度问题**
   - 按比例分账时，百分比相加可能不精确等于100%
   - 方案：前端允许±0.01%误差，后端按权重计算时最后一人补齐余数

3. **并发结算冲突**
   - 多人同时标记结算状态
   - 方案：使用乐观锁或数据库约束防止重复结算

4. **数据库迁移**
   - 当前`synchronize: true`自动建表
   - 生产环境需禁用并使用migration
   - 方案：先验证开发环境，再编写migration脚本

---

## 完成标准

### 功能1：智能结算
- ✅ 后端计算接口返回正确的最优转账方案
- ✅ 前端结算页面展示清晰（净收支+转账清单）
- ✅ 可标记某笔已完成，状态持久化
- ✅ 账本详情页显示待结算提示

### 功能2：分账输入
- ✅ 三种分账方式均有输入界面
- ✅ 实时校验，总和不对时禁止保存
- ✅ 保存后splits数据正确传递到后端
- ✅ 编辑时正确回填已有splits

### 功能3：成员移除
- ✅ Owner可长按成员头像移除
- ✅ 非owner不显示移除选项
- ✅ 不能移除自己，提示清晰
- ✅ 移除后页面自动刷新

---

## 预估工作量

- **智能结算闭环**：后端2-3小时，前端3-4小时，测试1小时 = 6-8小时
- **分账输入界面**：前端4-5小时，测试1小时 = 5-6小时
- **成员移除入口**：前端1-2小时，测试0.5小时 = 1.5-2.5小时

**总计：12.5-16.5小时**（约2个工作日）
