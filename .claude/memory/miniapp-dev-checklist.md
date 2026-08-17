# 微信小程序开发检查清单

## 开发前（代码考古）

- [ ] 搜索类似功能的已有页面
- [ ] 查看utils目录的可复用工具
- [ ] 查看constants目录的共享常量
- [ ] 确认API是否已封装在api.js

## WXML编写规范

- [ ] 没有调用任何方法（.toFixed, .map, .filter, .split等）
- [ ] 没有使用箭头函数或复杂表达式
- [ ] 列表数据已在JS中预处理（格式化、过滤、排序）
- [ ] 条件判断使用简单变量或预计算的map
- [ ] 复杂文本拼接在JS中完成

## JS数据处理模式

### 金额显示
```javascript
// ✓ 正确：预格式化
amountText: (amount / 100).toFixed(2)

// ❌ 错误：WXML中调用
<text>{{amount.toFixed(2)}}</text>
```

### 列表过滤/判断
```javascript
// ✓ 正确：预计算
checkedCount: records.filter(r => r.checked).length,
checkedMap: records.reduce((m, r) => {
  if (r.checked) m[r.id] = true
  return m
}, {})

// ❌ 错误：WXML中过滤
<view>{{records.filter(r => r.checked).length}}</view>
```

### 百分比/小数
```javascript
// ✓ 正确：预计算
confidencePercent: Math.round(confidence * 100),
confidenceText: `${Math.round(confidence * 100)}%`

// ❌ 错误：WXML中计算
<text>{{(confidence * 100).toFixed(0)}}%</text>
```

## API调用规范

### 使用统一封装
```javascript
// ✓ 正确：使用api.js封装
const api = require('../../utils/api')
const result = await api.ocrRecognizeReceipt(filePath, bookId)

// ❌ 错误：直接写wx.request
wx.request({ url: 'xxx', ... })
```

### 文件上传
```javascript
// ✓ 正确：获取baseURL
const baseUrl = getApp().globalData.apiBaseUrl
// 或
const { getBaseURL } = require('../../utils/request')
const baseUrl = getBaseURL()

// ❌ 错误：未定义的变量
url: `${baseURL}/upload`
```

## 测试流程

- [ ] 创建页面后立即在微信开发者工具预览
- [ ] 每完成一个区块就刷新查看效果
- [ ] 使用console.log检查数据结构
- [ ] 测试边界情况（空列表、单项、多项）
- [ ] 测试真实API调用

## 代码复用检查

- [ ] 相同的格式化逻辑是否可以提取到utils
- [ ] 相同的样式是否可以复用class
- [ ] 相同的组件是否已有可复用的

## 提交前最终检查

- [ ] 控制台无错误和警告
- [ ] 所有功能点都已测试
- [ ] 代码风格与项目一致
- [ ] 删除所有console.log调试代码（或保留必要的）
- [ ] 变量命名清晰有意义
