# 出发AA记账 - Apple Design System UI设计文档

## 项目信息

**产品名称：** 出发AA记账 / DepartureAA  
**设计版本：** v2.0 - Apple Design Language  
**目标平台：** iOS / Android 移动应用  
**设计基准：** iPhone 14 Pro (393x852)

---

## 设计理念

**核心概念：** Apple Human Interface Guidelines + Glassmorphism

参考 iOS 系统级设计语言，打造精致、优雅、现代的记账体验。使用磨砂玻璃材质（Frosted Glass）、流动的动画和精准的排版，让每一次记账都成为一种享受。

**关键词：**
- 🍎 Apple-like
- 💎 Glassmorphism（玻璃拟态）
- ✨ Vibrancy（活力）
- 🌊 Fluid Transitions（流动过渡）
- 🎯 Clarity（清晰）
- 📐 Precision（精准）

**设计原则（Apple HIG）：**
1. **Clarity** - 清晰易懂，内容优先
2. **Deference** - 界面服务于内容
3. **Depth** - 通过层级和动效表达空间感

---

## 配色方案（iOS System Colors）

### 核心色彩：iOS Semantic Colors

**Light Mode（浅色模式）：**
```
Label Colors:
- Primary Label:     rgba(0, 0, 0, 1.0)      #000000 - 主要文字
- Secondary Label:   rgba(60, 60, 67, 0.6)  #3C3C43 - 次要文字  
- Tertiary Label:    rgba(60, 60, 67, 0.3)  #3C3C43 - 辅助文字

Background Colors:
- System Background:      #FFFFFF - 主背景
- Secondary Background:   #F2F2F7 - 次级背景
- Tertiary Background:    #FFFFFF - 卡片背景

Grouped Background:
- Grouped Background:           #F2F2F7 - 分组背景
- Secondary Grouped Background: #FFFFFF - 分组内卡片
- Tertiary Grouped Background:  #F2F2F7 - 分组内次级

Separator Colors:
- Separator:    rgba(60, 60, 67, 0.29) - 分割线
- Opaque Sep:   rgba(198, 198, 200, 1) - 不透明分割线
```

**Dark Mode（深色模式）：**
```
Label Colors:
- Primary Label:     rgba(255, 255, 255, 1.0)  #FFFFFF
- Secondary Label:   rgba(235, 235, 245, 0.6)  #EBEBF5
- Tertiary Label:    rgba(235, 235, 245, 0.3)  #EBEBF5

Background Colors:
- System Background:      #000000
- Secondary Background:   #1C1C1E
- Tertiary Background:    #2C2C2E

Grouped Background:
- Grouped Background:           #000000
- Secondary Grouped Background: #1C1C1E
- Tertiary Grouped Background:  #2C2C2E

Separator Colors:
- Separator:    rgba(84, 84, 88, 0.65)
- Opaque Sep:   rgba(56, 56, 58, 1)
```

### 系统色彩（System Colors）

**Tint Colors（主题色选择）：**
```
推荐使用 iOS 系统蓝色作为主题色：
- System Blue:    #007AFF (浅色模式)
- System Blue:    #0A84FF (深色模式)

备选（如需差异化）：
- System Teal:    #5AC8FA / #64D2FF  - 青色（推荐）
- System Indigo:  #5856D6 / #5E5CE6  - 靛蓝色
- System Purple:  #AF52DE / #BF5AF2  - 紫色
```

**功能色：**
```
- System Green:   #34C759 / #32D74B  - 收入、成功
- System Red:     #FF3B30 / #FF453A  - 支出、删除、警告
- System Orange:  #FF9500 / #FF9F0A  - 提醒、待处理
- System Yellow:  #FFCC00 / #FFD60A  - 警告、标记
- System Gray:    #8E8E93 / #8E8E93  - 禁用、占位符
```

### 品牌色方案建议

**方案A：系统蓝（推荐，最Apple）**
```
主色：System Blue #007AFF
支出：System Red #FF3B30  
收入：System Green #34C759
背景：System Background + Grouped Background
```

**方案B：青色（有差异化）**
```
主色：System Teal #5AC8FA
支出：System Orange #FF9500
收入：System Green #34C759
背景：System Background + Grouped Background
```

**方案C：暖色系**
```
主色：System Orange #FF9500
支出：System Red #FF3B30
收入：System Green #34C759
背景：System Background + Grouped Background
```

---

## 磨砂玻璃材质系统（Glassmorphism）

### Material Hierarchy（材质层级）

**Level 1: Thin Material（薄材质）**
```css
/* 用于：浮动元素、Alert、ActionSheet */
background: rgba(242, 242, 247, 0.7);  /* Light */
background: rgba(28, 28, 30, 0.7);     /* Dark */
backdrop-filter: blur(20px) saturate(180%);
border: 0.5px solid rgba(255, 255, 255, 0.15);
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
```

**Level 2: Regular Material（标准材质）**
```css
/* 用于：主要卡片、List、GroupedList */
background: rgba(255, 255, 255, 0.8);  /* Light */
background: rgba(28, 28, 30, 0.8);     /* Dark */
backdrop-filter: blur(30px) saturate(180%);
border: 0.5px solid rgba(255, 255, 255, 0.2);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
```

**Level 3: Thick Material（厚材质）**
```css
/* 用于：模态弹窗、全屏遮罩 */
background: rgba(255, 255, 255, 0.95); /* Light */
background: rgba(28, 28, 30, 0.95);    /* Dark */
backdrop-filter: blur(40px) saturate(200%);
border: 0.5px solid rgba(255, 255, 255, 0.25);
box-shadow: 0 12px 48px rgba(0, 0, 0, 0.16);
```

**Vibrancy Effects（活力效果）**
```css
/* iOS 风格的 Vibrancy Label */
.vibrancy-label {
  color: #000000;
  mix-blend-mode: plus-lighter;  /* 浅色模式 */
}

.vibrancy-label-dark {
  color: #FFFFFF;
  mix-blend-mode: plus-darker;   /* 深色模式 */
}
```

---

## 排版系统（San Francisco Font）

### 字体家族
```
iOS: SF Pro Text / SF Pro Display
Android: SF Pro Text（如有授权）/ Roboto
Fallback: -apple-system, system-ui, sans-serif
```

### 文字样式（iOS Text Styles）

**Large Title（超大标题）**
```
尺寸: 34pt (34px)
字重: Regular (400) / Bold (700)
行高: 41pt
用途: 页面主标题
```

**Title 1（一级标题）**
```
尺寸: 28pt
字重: Regular (400) / Bold (700)
行高: 34pt
用途: 导航栏标题、分组标题
```

**Title 2（二级标题）**
```
尺寸: 22pt
字重: Regular (400) / Bold (700)
行高: 28pt
用途: 卡片标题
```

**Title 3（三级标题）**
```
尺寸: 20pt
字重: Regular (400) / Semibold (600)
行高: 25pt
用途: 列表标题、小节标题
```

**Body（正文）**
```
尺寸: 17pt
字重: Regular (400)
行高: 22pt
用途: 正文、列表内容
```

**Callout（强调文本）**
```
尺寸: 16pt
字重: Regular (400)
行高: 21pt
用途: 次要正文
```

**Subheadline（副标题）**
```
尺寸: 15pt
字重: Regular (400)
行高: 20pt
用途: 列表副标题
```

**Footnote（脚注）**
```
尺寸: 13pt
字重: Regular (400)
行高: 18pt
用途: 说明文字、时间戳
```

**Caption 1（说明文字1）**
```
尺寸: 12pt
字重: Regular (400)
行高: 16pt
用途: 图片说明、小标签
```

**Caption 2（说明文字2）**
```
尺寸: 11pt
字重: Regular (400)
行高: 13pt
用途: 最小说明文字
```

### 金额数字样式
```
尺寸: 48pt / 36pt / 28pt (根据重要性)
字重: Semibold (600)
字体: SF Pro Display (数字专用)
Letter Spacing: -0.5pt (紧凑)
Tabular Numbers: 启用（等宽数字）
```

---

## 圆角系统（Corner Radius）

**iOS 标准圆角：**
```
- Continuous Corner (连续曲率圆角):
  iOS 特有的平滑曲线，比普通圆角更自然

Small:     10pt  - 按钮、小卡片、输入框
Medium:    13pt  - 标准卡片
Large:     20pt  - 大卡片、模态弹窗
Extra Large: 39pt - 全屏卡片、底部抽屉
```

**实现方式（CSS）：**
```css
/* 标准圆角 */
border-radius: 13px;

/* 连续曲率圆角（需要CSS Houdini或图片） */
/* 暂时用标准圆角代替，视觉差异不大 */
```

---

## 间距系统（Spacing）

**iOS 标准间距（基于4pt网格）：**
```
4pt   - 最小间距（图标与文字）
8pt   - 紧凑间距（组内元素）
12pt  - 标准间距（列表项内容）
16pt  - 舒适间距（卡片内边距）
20pt  - 分组间距
24pt  - 区块间距
32pt  - 大区块间距
44pt  - 导航栏高度、最小触摸热区
```

**安全区域（Safe Area）：**
```
顶部: 44pt (导航栏) + 状态栏高度
底部: 34pt (Home Indicator) + 49pt (Tab Bar)
左右: 0pt (全面屏无边距，内容左右留16pt)
```

---

## 核心组件设计

### 1. Navigation Bar（导航栏）

**规格：**
```
高度: 44pt (标准) / 96pt (Large Title)
背景: Thin Material（磨砂）
标题: Title 1 / Large Title
按钮: SF Symbols 图标 + System Blue
分割线: Separator (0.5pt)
```

**样式：**
```css
.navbar {
  height: 44pt;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.29);
}

.navbar-title {
  font-size: 17pt;
  font-weight: 600;
  color: #000000;
}

.navbar-large-title {
  font-size: 34pt;
  font-weight: 700;
  padding: 16pt;
  color: #000000;
}
```

---

### 2. Tab Bar（底部标签栏）

**规格：**
```
高度: 49pt + 34pt (Home Indicator)
背景: Thin Material
图标: SF Symbols (24pt)
文字: Caption 2 (10pt)
选中色: System Blue / Tint Color
```

**样式：**
```css
.tabbar {
  height: 83pt;  /* 49pt + 34pt */
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border-top: 0.5px solid rgba(60, 60, 67, 0.29);
  padding-bottom: 34pt;  /* Home Indicator */
}

.tabbar-item {
  width: 25%;
  text-align: center;
}

.tabbar-icon {
  font-size: 24pt;
  color: #8E8E93;  /* 未选中 */
  margin-bottom: 2pt;
}

.tabbar-icon.active {
  color: #007AFF;  /* System Blue */
}

.tabbar-label {
  font-size: 10pt;
  color: #8E8E93;
}

.tabbar-label.active {
  color: #007AFF;
}
```

---

### 3. List（列表）

**iOS风格列表：**

**Inset Grouped List（圆角分组列表 - 推荐）**
```css
/* 分组容器 */
.list-section {
  background: transparent;
  padding: 20pt 16pt;
}

/* 分组标题 */
.list-header {
  font-size: 13pt;
  font-weight: 400;
  color: rgba(60, 60, 67, 0.6);
  text-transform: uppercase;
  letter-spacing: -0.08pt;
  padding: 0 16pt 8pt;
}

/* 列表容器（磨砂卡片） */
.list-container {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(30px) saturate(180%);
  border-radius: 13pt;
  overflow: hidden;
}

/* 列表项 */
.list-item {
  height: 44pt;  /* 最小触摸热区 */
  padding: 0 16pt;
  display: flex;
  align-items: center;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.29);
}

.list-item:last-child {
  border-bottom: none;
}

/* 列表项内容 */
.list-item-content {
  flex: 1;
}

.list-item-title {
  font-size: 17pt;
  color: #000000;
}

.list-item-subtitle {
  font-size: 15pt;
  color: rgba(60, 60, 67, 0.6);
  margin-top: 2pt;
}

/* 列表项右侧 */
.list-item-accessory {
  color: #8E8E93;
  margin-left: 8pt;
}

/* Chevron 右箭头 */
.list-item-chevron {
  color: rgba(60, 60, 67, 0.3);
  font-size: 13pt;
}
```

---

### 4. Card（卡片）

**账本卡片（Glassmorphism）：**
```css
.book-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(30px) saturate(180%);
  border-radius: 20pt;
  padding: 20pt;
  margin: 0 16pt 16pt;
  border: 0.5px solid rgba(255, 255, 255, 0.2);
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 8px 32px rgba(0, 0, 0, 0.08);
}

/* 点击态 */
.book-card:active {
  transform: scale(0.98);
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.02),
    0 4px 16px rgba(0, 0, 0, 0.06);
  transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

/* 卡片头部 */
.book-card-header {
  display: flex;
  align-items: center;
  margin-bottom: 16pt;
}

.book-card-icon {
  font-size: 40pt;
  margin-right: 12pt;
}

.book-card-title {
  font-size: 22pt;
  font-weight: 600;
  color: #000000;
}

/* 卡片内容 */
.book-card-amount {
  font-size: 28pt;
  font-weight: 600;
  color: #000000;
  font-feature-settings: 'tnum';  /* 等宽数字 */
}

.book-card-label {
  font-size: 13pt;
  color: rgba(60, 60, 67, 0.6);
  margin-bottom: 4pt;
}
```

---

### 5. Button（按钮）

**Primary Button（主要按钮）：**
```css
.button-primary {
  height: 50pt;
  background: #007AFF;  /* System Blue */
  border-radius: 13pt;
  font-size: 17pt;
  font-weight: 600;
  color: #FFFFFF;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
}

.button-primary:active {
  background: #0051D5;  /* 深10% */
  transform: scale(0.98);
}
```

**Secondary Button（次要按钮）：**
```css
.button-secondary {
  height: 50pt;
  background: rgba(0, 122, 255, 0.15);  /* 15%透明度 */
  border-radius: 13pt;
  font-size: 17pt;
  font-weight: 600;
  color: #007AFF;
  border: none;
}

.button-secondary:active {
  background: rgba(0, 122, 255, 0.25);
}
```

**Tinted Button（有色按钮）：**
```css
.button-tinted {
  height: 44pt;
  background: transparent;
  border-radius: 10pt;
  font-size: 17pt;
  font-weight: 600;
  color: #007AFF;
  border: none;
}

.button-tinted:active {
  background: rgba(0, 122, 255, 0.1);
}
```

**Floating Action Button（悬浮按钮）：**
```css
.button-fab {
  width: 56pt;
  height: 56pt;
  background: #007AFF;
  border-radius: 28pt;  /* 完全圆形 */
  box-shadow: 
    0 2px 8px rgba(0, 122, 255, 0.3),
    0 8px 24px rgba(0, 122, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.button-fab-icon {
  color: #FFFFFF;
  font-size: 24pt;
}

.button-fab:active {
  transform: scale(0.95);
}
```

---

### 6. Input Field（输入框）

**标准输入框：**
```css
.input-field {
  height: 44pt;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border: 0.5px solid rgba(60, 60, 67, 0.29);
  border-radius: 10pt;
  padding: 0 16pt;
  font-size: 17pt;
  color: #000000;
}

.input-field::placeholder {
  color: rgba(60, 60, 67, 0.3);
}

.input-field:focus {
  border-color: #007AFF;
  border-width: 1.5px;
  outline: none;
}

/* 错误状态 */
.input-field.error {
  border-color: #FF3B30;
}
```

**金额输入框：**
```css
.amount-input {
  background: rgba(242, 242, 247, 0.6);
  backdrop-filter: blur(20px);
  border-radius: 20pt;
  padding: 24pt;
  text-align: center;
}

.amount-input-value {
  font-size: 48pt;
  font-weight: 600;
  color: #000000;
  font-feature-settings: 'tnum';
  letter-spacing: -0.5pt;
}

.amount-input-currency {
  font-size: 32pt;
  font-weight: 500;
  color: rgba(60, 60, 67, 0.6);
  margin-right: 4pt;
}
```

---

### 7. Segmented Control（分段控制器）

**共享/私密切换器：**
```css
.segmented-control {
  height: 32pt;
  background: rgba(0, 0, 0, 0.06);  /* 浅灰底 */
  border-radius: 9pt;
  padding: 2pt;
  display: flex;
}

.segmented-segment {
  flex: 1;
  height: 28pt;
  border-radius: 7pt;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13pt;
  font-weight: 400;
  color: #000000;
  transition: all 0.25s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.segmented-segment.active {
  background: #FFFFFF;
  font-weight: 600;
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.06);
}
```

---

### 8. Avatar Group（头像组）

```css
.avatar-group {
  display: flex;
  align-items: center;
  height: 32pt;
}

.avatar {
  width: 32pt;
  height: 32pt;
  border-radius: 16pt;
  border: 2px solid #FFFFFF;
  margin-left: -8pt;  /* 重叠 */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.avatar:first-child {
  margin-left: 0;
}

.avatar-more {
  width: 32pt;
  height: 32pt;
  border-radius: 16pt;
  background: rgba(0, 122, 255, 0.15);
  border: 2px solid #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12pt;
  font-weight: 600;
  color: #007AFF;
  margin-left: -8pt;
}
```

---

### 9. Modal / Sheet（模态弹窗）

**Bottom Sheet（底部抽屉）：**
```css
.sheet-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
}

.sheet-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(40px) saturate(200%);
  border-top-left-radius: 39pt;
  border-top-right-radius: 39pt;
  padding: 0 0 34pt;  /* Home Indicator */
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.2);
}

.sheet-handle {
  width: 36pt;
  height: 5pt;
  background: rgba(60, 60, 67, 0.3);
  border-radius: 2.5pt;
  margin: 8pt auto 20pt;
}
```

---

## 图标系统（SF Symbols）

**使用 SF Symbols 风格图标：**
```
尺寸:
- Small:    20pt (常规图标)
- Medium:   24pt (Tab Bar)
- Large:    28pt (导航栏)

粗细:
- Ultralight / Thin / Light / Regular / Medium / Semibold / Bold / Heavy / Black

渲染模式:
- Monochrome (单色)
- Hierarchical (层级)
- Palette (多色)
- Multicolor (全彩)
```

**常用图标：**
```
账本: book.fill
记账: plus.circle.fill
统计: chart.bar.fill
我的: person.fill
搜索: magnifyingglass
设置: gearshape.fill
删除: trash.fill
编辑: pencil
分享: square.and.arrow.up
照相机: camera.fill
共享: person.2.fill
私密: lock.fill
```

---

## 动画与过渡

### iOS 标准动画曲线

**Ease In Out（标准曲线）：**
```css
transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
```

**Ease Out（页面出现）：**
```css
transition: all 0.35s cubic-bezier(0.0, 0.0, 0.2, 1);
```

**Ease In（页面消失）：**
```css
transition: all 0.25s cubic-bezier(0.4, 0.0, 1, 1);
```

**Spring Animation（弹簧动画）：**
```css
transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
```

### 动画时长

```
- 快速反馈: 150ms - 200ms (按钮点击)
- 标准过渡: 250ms - 300ms (页面切换)
- 复杂动画: 400ms - 500ms (展开/收起)
```

### 页面转场

**Push (向右推入)：**
```css
/* 新页面从右侧滑入 */
@keyframes push-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
```

**Modal Present（模态弹出）：**
```css
/* 从底部向上弹出 */
@keyframes modal-present {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
```

---

## 触觉反馈（Haptic Feedback）

**使用场景：**
```javascript
// 轻量反馈 - 按钮点击
wx.vibrateShort({ type: 'light' })

// 中等反馈 - 成功操作
wx.vibrateShort({ type: 'medium' })

// 重量反馈 - 删除、错误
wx.vibrateShort({ type: 'heavy' })

// 选择反馈 - 滚动选择器
wx.vibrateShort({ type: 'light' })
```

---

## 页面布局示例

### 1. 账本列表页

```
┌─────────────────────────────────────┐
│ [Large Title Navigation]            │
│ 出发AA记账                           │ ← 34pt Large Title
│                                     │
│ [搜索框]                             │ ← 磨砂输入框
│                                     │
│ [分组标题] 进行中                    │ ← 13pt Secondary Label
│                                     │
│ ┌───────────────────────────────┐  │
│ │ [磨砂卡片]                    │  │ ← Regular Material
│ │ 🏖️ 北京旅游                   │  │
│ │ [头像组] 👤👤👤+2              │  │
│ │                               │  │
│ │ ¥3,450                        │  │ ← 28pt Semibold
│ │ 共享支出                       │  │ ← 13pt Secondary
│ └───────────────────────────────┘  │
│                                     │
│ [分组标题] 已结算                    │
│ ...                                 │
│                                     │
├─────────────────────────────────────┤
│ [Tab Bar - 磨砂]                    │
│ 📖    💰    👥    ➕               │
│ 账本  统计  我的  记账               │
└─────────────────────────────────────┘
```

---

### 2. 记账页面

```
┌─────────────────────────────────────┐
│ [Navigation Bar]                    │
│ ← 取消      记一笔      保存 ✓      │
├─────────────────────────────────────┤
│                                     │
│ [Segmented Control]                 │
│ ┌─────────────┬─────────────┐      │
│ │ 👥 共享账   │ 🔒 私密账   │      │ ← iOS 分段控制器
│ └─────────────┴─────────────┘      │
│                                     │
│ [金额输入 - 磨砂卡片]                │
│ ┌───────────────────────────────┐  │
│ │                               │  │
│ │       ¥ 0.00                  │  │ ← 48pt Display
│ │                               │  │
│ └───────────────────────────────┘  │
│                                     │
│ [分类选择 - 网格]                    │
│ 🍜餐饮  🚗交通  🏨住宿  🎬娱乐      │
│                                     │
│ [Inset Grouped List]                │
│ ┌───────────────────────────────┐  │
│ │ 分账方式    平均分摊        >  │  │
│ ├───────────────────────────────┤  │
│ │ 参与人员    [头像组]        >  │  │
│ ├───────────────────────────────┤  │
│ │ 付款人      张三            >  │  │
│ ├───────────────────────────────┤  │
│ │ 位置        西湖·杭州    ⊗  >  │  │ ← 自动定位/地图选点，可清除
│ └───────────────────────────────┘  │
│                                     │
│ [备注 + 图片凭证]                    │
│ ┌───────────────────────────────┐  │
│ │ 备注输入框…                    │  │
│ │ [＋拍照/相册]  [img] [img]     │  │ ← 拍照或相册，支持多张
│ └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

---

## 深色模式（Dark Mode）

**自动适配：**
```css
/* 使用 CSS 变量自动切换 */
:root {
  --color-bg: #FFFFFF;
  --color-card: rgba(255, 255, 255, 0.8);
  --color-text: #000000;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #000000;
    --color-card: rgba(28, 28, 30, 0.8);
    --color-text: #FFFFFF;
  }
}

.page {
  background: var(--color-bg);
  color: var(--color-text);
}

.card {
  background: var(--color-card);
}
```

---

## 可访问性（Accessibility）

**遵循 iOS 可访问性标准：**

1. **最小触摸热区：** 44pt × 44pt
2. **颜色对比度：** 
   - 正文文字：最小 4.5:1
   - 大文字（≥18pt）：最小 3:1
3. **Dynamic Type：** 支持系统字体大小调整
4. **VoiceOver：** 所有交互元素有明确标签
5. **Reduce Motion：** 尊重用户的动画偏好设置

---

## 设计交付规范

### Figma / Sketch 文件结构
```
出发AA记账 - Apple Design
├── 📁 Design System
│   ├── Colors (iOS System Colors)
│   ├── Typography (SF Pro)
│   ├── Components
│   └── Icons (SF Symbols)
│
├── 📁 Light Mode
│   ├── 01-账本列表
│   ├── 02-账本详情
│   ├── 03-记账页面
│   ├── 04-统计页面
│   └── 05-我的页面
│
└── 📁 Dark Mode
    └── (对应 Light Mode 的深色版本)
```

### 切图规范
```
尺寸: @2x, @3x
格式: PNG (图片) / PDF (图标)
命名: icon_name@2x.png
```

---

## 开发注意事项

### 微信小程序实现 iOS 效果的关键

**1. 启用 Skyline 渲染引擎**
```json
{
  "renderer": "skyline",
  "rendererOptions": {
    "skyline": {
      "defaultDisplayBlock": true
    }
  }
}
```

**2. 使用 backdrop-filter**
```css
/* 仅 Skyline 支持 */
.glass {
  backdrop-filter: blur(30px) saturate(180%);
}
```

**3. 使用 SF Pro 字体（如有授权）**
```css
@font-face {
  font-family: 'SF Pro Text';
  src: url('path/to/SFProText-Regular.otf');
}
```

**4. 原生组件替换**
```xml
<!-- 使用原生 scroll-view -->
<scroll-view 
  scroll-y
  show-scrollbar="{{false}}"
  enhanced="{{true}}"
  bounces="{{true}}">
</scroll-view>
```

---

## 参考资源

**Apple Human Interface Guidelines:**
- https://developer.apple.com/design/human-interface-guidelines/

**iOS Design Resources:**
- SF Symbols: https://developer.apple.com/sf-symbols/
- SF Pro Font: https://developer.apple.com/fonts/

**Glassmorphism:**
- https://glassmorphism.com/

---

**文档版本：** v2.0 - Apple Design Language  
**最后更新：** 2026-08-13  
**设计师：** [待填写]
