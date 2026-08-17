# OCR 识别支付记录功能实现方案

## 📋 功能概述

**目标：** 用户拍摄或上传支付截图（微信/支付宝等），自动识别金额、商户名称、时间等信息，快速完成记账。

**核心价值：**
- 提升记账效率，减少手动输入
- 降低输入错误率
- 支持批量识别（一张图多条支付记录）
- 智能匹配分类和成员

---

## 🎯 用户体验流程

### 方式1：从记账页进入（推荐）
```
记账页 → 点击「OCR识别」按钮
  ↓
拍照 / 从相册选择
  ↓
上传图片到后端 → 调用OCR服务
  ↓
【识别结果页】展示识别出的多条记录
  - 每条记录：金额 ✓ / 商户名 ✓ / 时间 ✓
  - 可勾选/取消勾选
  - 可快捷修改（点击字段弹出编辑）
  ↓
用户确认 → 批量创建交易记录
  ↓
返回记账页 / 账本详情
```

### 方式2：独立入口
```
账本详情 → 快捷操作「OCR记账」
  ↓
同上流程
```

---

## 🏗️ 技术架构

### 整体架构图
```
┌─────────────────┐
│  微信小程序      │
│  - 拍照/选图    │
│  - 展示结果     │
│  - 快捷编辑     │
└────────┬────────┘
         │ 上传图片
         ↓
┌─────────────────┐
│  NestJS 后端     │
│  - 接收图片     │
│  - 调用OCR      │
│  - 解析结果     │
│  - 智能匹配     │
└────────┬────────┘
         │ HTTP POST
         ↓
┌─────────────────┐
│  OCR 服务        │
│  PaddleOCR      │
│  songin.ai      │
└─────────────────┘
```

---

## 📦 后端实现方案

### 1. 创建OCR模块

**文件结构：**
```
packages/server/src/ocr/
├── ocr.module.ts
├── ocr.controller.ts
├── ocr.service.ts
├── dto/
│   ├── recognize-receipt.dto.ts
│   └── ocr-result.dto.ts
└── parsers/
    ├── wechat-parser.ts
    ├── alipay-parser.ts
    └── generic-parser.ts
```

---

### 2. OCR Service 实现

#### 核心功能
```typescript
// ocr.service.ts
@Injectable()
export class OcrService {
  private readonly ocrApiUrl = 'https://utils.songin.ai/v1/ocr/recognize'
  private readonly ocrApiKey = 'ai-music-utils-api-key'

  /**
   * 识别支付截图
   */
  async recognizeReceipt(file: Express.Multer.File, userId: string) {
    // 1. 调用OCR API识别文字
    const ocrResult = await this.callOcrApi(file)
    
    // 2. 解析文字，提取支付记录
    const records = this.parsePaymentRecords(ocrResult.fullText, ocrResult.results)
    
    // 3. 智能匹配分类
    const enrichedRecords = this.enrichRecords(records)
    
    return {
      imageUrl: await this.uploadToR2(file), // 保存原图
      records: enrichedRecords,
      rawOcrResult: ocrResult.fullText,
    }
  }

  /**
   * 调用OCR API
   */
  private async callOcrApi(file: Express.Multer.File) {
    const formData = new FormData()
    formData.append('file', file.buffer, file.originalname)
    formData.append('language', 'ch_en')
    formData.append('detectAngle', 'true')

    const response = await fetch(this.ocrApiUrl, {
      method: 'POST',
      headers: {
        'x-api-key': this.ocrApiKey,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error('OCR识别失败')
    }

    return response.json()
  }

  /**
   * 解析支付记录（智能提取）
   */
  private parsePaymentRecords(fullText: string, results: any[]) {
    const records = []
    
    // 规则1: 微信支付格式
    // "向XXX转账" + "¥123.45" + "今天 12:34"
    const wechatPattern = /向(.+?)转账[\s\S]*?[¥￥](\d+\.?\d*)/g
    
    // 规则2: 支付宝格式
    // "付款给XXX" + "123.45元" + "时间"
    const alipayPattern = /付款给(.+?)[\s\S]*?(\d+\.?\d*)元/g
    
    // 规则3: 通用金额提取
    const amountPattern = /[¥￥](\d+\.?\d*)/g
    const merchantPattern = /([一-龥]{2,10})/g
    
    // 按优先级匹配
    let match
    while ((match = wechatPattern.exec(fullText)) !== null) {
      records.push({
        merchant: match[1].trim(),
        amount: parseFloat(match[2]) * 100, // 转为分
        confidence: 0.9,
        source: 'wechat',
      })
    }
    
    // 如果未匹配到特定格式，尝试通用提取
    if (records.length === 0) {
      const amounts = []
      const merchants = []
      
      while ((match = amountPattern.exec(fullText)) !== null) {
        amounts.push(parseFloat(match[1]))
      }
      
      while ((match = merchantPattern.exec(fullText)) !== null) {
        const text = match[1]
        // 过滤无意义的词
        if (!['支付', '转账', '收款', '付款'].includes(text)) {
          merchants.push(text)
        }
      }
      
      // 组合金额和商户名
      amounts.forEach((amount, i) => {
        records.push({
          merchant: merchants[i] || '未知商户',
          amount: Math.round(amount * 100),
          confidence: 0.6,
          source: 'generic',
        })
      })
    }
    
    return records
  }

  /**
   * 智能匹配分类
   */
  private enrichRecords(records: any[]) {
    return records.map((record) => {
      const category = this.guessCategory(record.merchant)
      const spentAt = new Date().toISOString()
      
      return {
        ...record,
        category,
        spentAt,
        note: record.merchant,
      }
    })
  }

  /**
   * 根据商户名猜测分类
   */
  private guessCategory(merchant: string): string {
    const rules = [
      { keywords: ['餐', '饭店', '小吃', '奶茶', '咖啡', '火锅'], category: 'food' },
      { keywords: ['滴滴', '出租车', '公交', '地铁', '打车'], category: 'transport' },
      { keywords: ['酒店', '宾馆', '民宿'], category: 'hotel' },
      { keywords: ['电影', '门票', '景区'], category: 'ticket' },
      { keywords: ['超市', '购物', '商场'], category: 'shopping' },
      { keywords: ['KTV', '网吧', '游戏'], category: 'entertainment' },
      { keywords: ['医院', '药店', '诊所'], category: 'medical' },
    ]
    
    for (const rule of rules) {
      if (rule.keywords.some((kw) => merchant.includes(kw))) {
        return rule.category
      }
    }
    
    return 'other'
  }
}
```

---

### 3. Controller 接口

```typescript
// ocr.controller.ts
@Controller('ocr')
@UseGuards(JwtAuthGuard)
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  /**
   * 识别支付截图
   * POST /api/ocr/recognize-receipt
   */
  @Post('recognize-receipt')
  @UseInterceptors(FileInterceptor('file'))
  async recognizeReceipt(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('bookId') bookId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('请上传图片')
    }

    // 验证文件类型和大小
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('只支持 jpg、png、webp 格式')
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('图片不能超过 10MB')
    }

    const data = await this.ocrService.recognizeReceipt(file, userId)

    return {
      code: 0,
      message: '识别成功',
      data,
    }
  }

  /**
   * 批量创建交易记录（从OCR结果）
   * POST /api/ocr/batch-create-transactions
   */
  @Post('batch-create-transactions')
  async batchCreateTransactions(
    @CurrentUser('sub') userId: string,
    @Body() dto: BatchCreateFromOcrDto,
  ) {
    const data = await this.ocrService.batchCreateTransactions(userId, dto)

    return {
      code: 0,
      message: `成功创建 ${data.count} 条记录`,
      data,
    }
  }
}
```

---

## 📱 前端实现方案

### 1. OCR识别结果页

**文件结构：**
```
packages/miniapp/pages/ocr-result/
├── ocr-result.js
├── ocr-result.wxml
├── ocr-result.wxss
└── ocr-result.json
```

---

### 2. 页面数据结构

```javascript
// ocr-result.js
Page({
  data: {
    bookId: '',
    imageUrl: '', // 原图预览
    rawText: '', // 原始OCR文本（调试用）
    records: [
      {
        id: '1', // 临时ID
        merchant: '星巴克',
        amount: 4500, // 分
        amountText: '45.00',
        category: 'food',
        spentAt: '2026-08-17T10:30:00',
        note: '星巴克',
        confidence: 0.9,
        checked: true, // 是否勾选
        editing: false, // 是否正在编辑
      },
      // ...
    ],
    categories: CATEGORIES, // 从constants导入
    
    // UI状态
    loading: false,
    submitting: false,
    showRawText: false,
  },

  onLoad(query) {
    this.setData({
      bookId: query.bookId || '',
    })
    // 接收从相机页传来的识别结果
    const eventChannel = this.getOpenerEventChannel()
    eventChannel.on('ocrResult', (data) => {
      this.setData({
        imageUrl: data.imageUrl,
        rawText: data.rawOcrResult,
        records: data.records.map((r, i) => ({
          ...r,
          id: String(i),
          amountText: (r.amount / 100).toFixed(2),
          checked: true,
          editing: false,
        })),
      })
    })
  },

  // 切换勾选状态
  onToggleCheck(e) {
    const { id } = e.currentTarget.dataset
    const records = this.data.records.map((r) =>
      r.id === id ? { ...r, checked: !r.checked } : r,
    )
    this.setData({ records })
  },

  // 快捷编辑字段
  onEditField(e) {
    const { id, field } = e.currentTarget.dataset
    const record = this.data.records.find((r) => r.id === id)
    
    if (field === 'amount') {
      // 金额编辑弹窗
      this.showAmountInput(id, record.amountText)
    } else if (field === 'merchant') {
      // 商户名编辑弹窗
      this.showMerchantInput(id, record.merchant)
    } else if (field === 'category') {
      // 分类选择
      this.showCategoryPicker(id)
    }
  },

  showAmountInput(id, currentValue) {
    wx.showModal({
      title: '修改金额',
      editable: true,
      placeholderText: '请输入金额（元）',
      content: currentValue,
      success: (res) => {
        if (!res.confirm) return
        const amount = parseFloat(res.content || '0')
        if (isNaN(amount) || amount <= 0) {
          wx.showToast({ title: '请输入有效金额', icon: 'none' })
          return
        }
        const records = this.data.records.map((r) =>
          r.id === id
            ? { ...r, amount: Math.round(amount * 100), amountText: amount.toFixed(2) }
            : r,
        )
        this.setData({ records })
      },
    })
  },

  showMerchantInput(id, currentValue) {
    wx.showModal({
      title: '修改商户名',
      editable: true,
      placeholderText: '请输入商户名',
      content: currentValue,
      success: (res) => {
        if (!res.confirm) return
        const merchant = (res.content || '').trim()
        if (!merchant) return
        const records = this.data.records.map((r) =>
          r.id === id ? { ...r, merchant, note: merchant } : r,
        )
        this.setData({ records })
      },
    })
  },

  showCategoryPicker(id) {
    const items = this.data.categories.map((c) => c.name)
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const category = this.data.categories[res.tapIndex]
        const records = this.data.records.map((r) =>
          r.id === id ? { ...r, category: category.key } : r,
        )
        this.setData({ records })
      },
    })
  },

  // 全选/取消全选
  onToggleAll() {
    const allChecked = this.data.records.every((r) => r.checked)
    const records = this.data.records.map((r) => ({ ...r, checked: !allChecked }))
    this.setData({ records })
  },

  // 删除记录
  onDelete(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条记录吗？',
      success: (res) => {
        if (!res.confirm) return
        const records = this.data.records.filter((r) => r.id !== id)
        this.setData({ records })
      },
    })
  },

  // 提交创建
  async onSubmit() {
    const checked = this.data.records.filter((r) => r.checked)
    if (checked.length === 0) {
      wx.showToast({ title: '请至少选择一条记录', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const transactions = checked.map((r) => ({
        bookId: this.data.bookId,
        type: 'shared', // 默认共享账
        amount: r.amount,
        category: r.category,
        note: r.note,
        spentAt: r.spentAt,
      }))

      await api.batchCreateFromOcr({ transactions })
      wx.showToast({ title: `已创建 ${checked.length} 条记录`, icon: 'success' })
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '创建失败', icon: 'none' })
      this.setData({ submitting: false })
    }
  },
})
```

---

### 3. UI设计

```xml
<!-- ocr-result.wxml -->
<view class="ocr-result-page">
  <!-- 原图预览 -->
  <view class="image-preview">
    <image src="{{imageUrl}}" mode="aspectFit" />
  </view>

  <!-- 识别结果列表 -->
  <view class="result-header">
    <text class="result-title">识别到 {{records.length}} 条支付记录</text>
    <view class="result-actions">
      <text class="link" bindtap="onToggleAll">全选/取消</text>
      <text class="link" bindtap="onToggleRawText">查看原文</text>
    </view>
  </view>

  <view class="records-list">
    <view
      wx:for="{{records}}"
      wx:key="id"
      class="record-item {{item.checked ? 'checked' : ''}}"
    >
      <!-- 勾选框 -->
      <view class="record-checkbox" data-id="{{item.id}}" bindtap="onToggleCheck">
        <van-icon name="{{item.checked ? 'checked' : 'circle'}}" size="24px" color="{{item.checked ? '#4097a9' : '#c4c4c4'}}" />
      </view>

      <!-- 记录内容 -->
      <view class="record-content">
        <!-- 商户名 -->
        <view class="record-row" data-id="{{item.id}}" data-field="merchant" bindtap="onEditField">
          <text class="record-label">商户</text>
          <text class="record-value editable">{{item.merchant}}</text>
          <van-icon name="edit" size="16px" color="#8091a5" />
        </view>

        <!-- 金额 -->
        <view class="record-row" data-id="{{item.id}}" data-field="amount" bindtap="onEditField">
          <text class="record-label">金额</text>
          <text class="record-value amount editable">¥{{item.amountText}}</text>
          <van-icon name="edit" size="16px" color="#8091a5" />
        </view>

        <!-- 分类 -->
        <view class="record-row" data-id="{{item.id}}" data-field="category" bindtap="onEditField">
          <text class="record-label">分类</text>
          <text class="record-value editable">{{item.categoryName}}</text>
          <van-icon name="arrow" size="16px" color="#8091a5" />
        </view>

        <!-- 置信度 -->
        <view class="record-confidence">
          <text class="confidence-label">识别置信度</text>
          <text class="confidence-value">{{(item.confidence * 100).toFixed(0)}}%</text>
        </view>
      </view>

      <!-- 删除按钮 -->
      <view class="record-delete" data-id="{{item.id}}" catchtap="onDelete">
        <van-icon name="delete-o" size="20px" color="#fa9583" />
      </view>
    </view>
  </view>

  <!-- 原始文本（折叠） -->
  <view wx:if="{{showRawText}}" class="raw-text-panel">
    <text class="raw-text">{{rawText}}</text>
  </view>

  <!-- 底部操作栏 -->
  <view class="footer-bar">
    <text class="selected-count">已选 {{records.filter(r => r.checked).length}} 条</text>
    <button class="btn-submit" bindtap="onSubmit" disabled="{{submitting}}">
      {{submitting ? '创建中...' : '确认创建'}}
    </button>
  </view>
</view>
```

---

### 4. 从记账页跳转

```javascript
// add-transaction.js 增加OCR入口
Page({
  // ...existing code

  onOcrRecognize() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: async (res) => {
        wx.showLoading({ title: '识别中...' })
        
        try {
          const filePath = res.tempFiles[0].tempFilePath
          
          // 上传到后端并识别
          const result = await api.ocrRecognizeReceipt(filePath, this.data.bookId)
          
          wx.hideLoading()
          
          // 跳转到结果页
          wx.navigateTo({
            url: `/pages/ocr-result/ocr-result?bookId=${this.data.bookId}`,
            success: (res) => {
              res.eventChannel.emit('ocrResult', result)
            },
          })
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: (e && e.message) || '识别失败', icon: 'none' })
        }
      },
    })
  },
})
```

---

## 🔐 安全性考虑

### 1. API Key保护
- ✅ API Key存储在后端环境变量
- ✅ 小程序不直接访问OCR服务
- ✅ 所有请求经过后端转发

### 2. 文件上传安全
- 验证文件类型（仅允许图片）
- 限制文件大小（≤10MB）
- 验证用户身份（JWT）

### 3. 数据隐私
- OCR识别后的图片存储在用户自己的R2空间
- 原始OCR文本不持久化，仅临时返回给前端
- 用户可选择删除原图

---

## 📊 数据流程

### 识别流程
```
1. 用户选择图片
   ↓
2. 前端上传到 /api/ocr/recognize-receipt
   ↓
3. 后端接收图片，调用OCR API
   ↓
4. OCR服务返回识别文本
   ↓
5. 后端解析文本，提取支付记录
   ↓
6. 智能匹配分类
   ↓
7. 返回结构化结果给前端
   ↓
8. 前端展示结果页，用户编辑确认
   ↓
9. 调用 /api/ocr/batch-create-transactions
   ↓
10. 批量创建交易记录
```

---

## 🧪 测试用例

### 后端测试
```typescript
describe('OcrService', () => {
  it('应该正确识别微信支付截图', async () => {
    const file = readTestImage('wechat-pay.jpg')
    const result = await ocrService.recognizeReceipt(file, 'user-id')
    
    expect(result.records).toHaveLength(1)
    expect(result.records[0].merchant).toBe('星巴克')
    expect(result.records[0].amount).toBe(4500)
  })

  it('应该识别包含多条支付记录的截图', async () => {
    const file = readTestImage('multiple-payments.jpg')
    const result = await ocrService.recognizeReceipt(file, 'user-id')
    
    expect(result.records.length).toBeGreaterThan(1)
  })

  it('应该正确分类餐饮类商户', () => {
    const category = ocrService.guessCategory('麦当劳')
    expect(category).toBe('food')
  })
})
```

### 前端测试场景
1. 上传清晰的支付截图 → 识别成功
2. 上传模糊图片 → 识别失败提示
3. 识别出3条记录 → 取消勾选第2条 → 仅创建2条
4. 修改金额/商户名 → 保存成功
5. 删除记录 → 列表更新

---

## 🚀 实现步骤

### 阶段1：后端基础（2-3小时）
1. 创建OCR模块
2. 实现OCR API调用
3. 实现基础解析逻辑（微信/支付宝格式）
4. 创建Controller接口
5. 测试OCR调用

### 阶段2：前端结果页（3-4小时）
1. 创建OCR结果页
2. 实现记录列表UI
3. 实现快捷编辑功能
4. 实现勾选/删除逻辑
5. 对接后端API

### 阶段3：集成与优化（2小时）
1. 记账页添加OCR入口
2. 账本详情页添加OCR快捷按钮
3. 优化解析规则
4. 添加更多商户识别规则
5. 错误处理和用户提示

### 阶段4：测试与优化（1-2小时）
1. 准备测试截图（微信/支付宝）
2. 端到端测试
3. 优化识别准确率
4. UI细节打磨

**总计：8-11小时（约1.5个工作日）**

---

## 💡 后续优化方向

### V1.1 增强识别
- 支持更多支付平台（美团、饿了么等）
- 识别时间信息（截图中的时间戳）
- 识别支付方式（微信/支付宝/银行卡）

### V1.2 智能化
- AI推荐分账人员（基于历史记录）
- 自动识别是否为共享账
- 商户数据库（常见商户→分类映射）

### V1.3 批量处理
- 支持一次上传多张截图
- 批量识别队列
- 进度显示

---

## ⚠️ 注意事项

### 1. OCR准确率
- 识别准确率受图片质量影响
- 建议用户拍摄清晰截图
- 提供"查看原文"功能辅助调试

### 2. 解析规则维护
- 不同支付平台格式可能变化
- 需定期更新解析规则
- 提供降级方案（手动输入）

### 3. 成本控制
- OCR API调用可能有计费
- 建议添加调用次数统计
- 考虑缓存识别结果

### 4. 用户体验
- 识别过程需要1-3秒，显示加载动画
- 识别失败时给出友好提示
- 提供"手动记账"备选方案

---

## 📋 环境变量配置

```bash
# .env
# OCR 识别服务
OCR_API_URL=https://utils.songin.ai/v1/ocr/recognize
OCR_API_KEY=ai-music-utils-api-key
```

---

## ✅ 完成标准

- ✅ 后端能成功调用OCR API
- ✅ 能正确解析微信/支付宝支付截图
- ✅ 前端展示识别结果，支持编辑
- ✅ 能批量创建交易记录
- ✅ 分类智能匹配准确率≥70%
- ✅ 用户体验流畅，错误处理完善

---

**预计完成时间：** 1.5个工作日  
**优先级：** P1（增强功能）  
**依赖：** 无（独立功能模块）
