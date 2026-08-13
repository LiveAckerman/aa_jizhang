# 登录页面 UI 设计方案（微信小程序）

## 📱 整体风格

**平台：** 微信小程序
**设计语言：** 现代磨砂玻璃风格（Glassmorphism）+ 微信设计规范

**核心特点：**
- 轻盈通透的毛玻璃卡片
- 柔和的渐变背景（青绿→珊瑚）
- 圆润的圆角设计
- 优雅的留白和间距
- 符合微信小程序官方设计规范
- 微信绿色主按钮，强化品牌认知

---

## 🎨 色彩方案

### 主色调
- **青绿色（Teal）**: `#4097a9` — 次要元素、装饰
- **珊瑚色（Coral）**: `#fa9583` — 次要按钮、提示信息
- **深海军蓝（Navy）**: `#2f4159` — 文字、图标
- **微信绿**: `#07C160` — 微信登录主按钮（符合微信规范）

### 背景色
- **主背景渐变**: 
  ```css
  background: linear-gradient(135deg, #E8F4F7 0%, #FFF5F2 100%);
  ```
- **卡片背景**: 
  ```css
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px); /* 微信小程序兼容 */
  ```

### 辅助色
- **成功**: `#4ECDC4`
- **错误**: `#FF6B9D`
- **灰色**: `#8E9AAF`
- **浅灰**: `#F5F7FA`

---

## 📐 布局结构

```
┌─────────────────────────┐
│                         │  ← 顶部留白 120rpx（适配状态栏）
│      [App Logo]         │  ← Logo 120x120rpx 圆角
│                         │
│         清账            │  ← 品牌名 48rpx
│    ClearLedger          │  ← 英文名 28rpx
│   轻松记账，明白花钱    │  ← Slogan 24rpx
│                         │
│  ┌───────────────────┐  │
│  │                   │  │
│  │  [毛玻璃登录卡片] │  │  ← 登录表单区域
│  │                   │  │
│  │  [微信图标]       │  │
│  │  微信快速登录     │  │  ← 主要登录方式（微信绿）
│  │                   │  │
│  │  ───── 或 ─────   │  │  ← 分割线
│  │                   │  │
│  │  [邮箱图标]       │  │
│  │  邮箱验证码登录   │  │  ← 备用登录方式
│  │                   │  │
│  └───────────────────┘  │
│                         │
│  登录即代表同意         │  ← 底部提示
│  《隐私政策》和《用户协议》│
│                         │
└─────────────────────────┘
```

---

## 🧩 组件设计（微信小程序规范）

### 1. Logo 区域
```
位置: 顶部居中，距顶部 120rpx（包含状态栏）
尺寸: 120x120rpx 圆角图标（20rpx 圆角）
下方文字: 
  - 品牌名"清账" 48rpx, 深海军蓝, 粗体
  - 英文名"ClearLedger" 28rpx, 灰色, 细体
  - Slogan"轻松记账，明白花钱" 24rpx, 灰色
```

### 2. 毛玻璃卡片
```css
宽度: 670rpx（左右留白 40rpx）
内边距: 60rpx 40rpx
圆角: 40rpx
背景: rgba(255, 255, 255, 0.85)
毛玻璃: backdrop-filter: blur(20px)
       -webkit-backdrop-filter: blur(20px)
阴影: box-shadow: 0 16rpx 64rpx rgba(47, 65, 89, 0.08)
边框: 2rpx solid rgba(255, 255, 255, 0.6)
```

### 3. 微信登录按钮（主按钮）
```css
宽度: 100%
高度: 96rpx
圆角: 48rpx（全圆角）
背景: #07C160（微信官方绿色）
文字: 32rpx, 白色, 居中, 粗体
图标: 微信图标 40x40rpx，左侧
阴影: 0 8rpx 24rpx rgba(7, 193, 96, 0.3)

按钮内容: [微信图标] 微信快速登录

悬停/点击效果:
  opacity: 0.9
  transform: scale(0.98)
```

### 4. 邮箱登录按钮（次要按钮）
```css
宽度: 100%
高度: 96rpx
圆角: 48rpx
背景: rgba(250, 149, 131, 0.1)
边框: 2rpx solid #fa9583
文字: 32rpx, 珊瑚色
图标: 邮箱图标 40x40rpx，左侧

按钮内容: [邮箱图标] 邮箱验证码登录

点击效果:
  背景: rgba(250, 149, 131, 0.15)
```

### 5. 分割线
```
"或" 文字居中，28rpx，灰色
左右两侧细线 1rpx
颜色: #E8E9EB
上下间距: 48rpx
```

---

## 📱 具体页面元素（微信小程序）

### 登录卡片内容（从上到下）

1. **标题**
   ```
   "欢迎使用清账"
   字体: 44rpx, 深海军蓝, 粗细 600
   位置: 卡片顶部，居中
   下方间距: 40rpx
   ```

2. **微信登录按钮**
   ```
   [微信图标 40rpx] 微信快速登录
   主按钮样式（微信绿 #07C160）
   使用 <button open-type="getUserInfo"> 触发授权
   ```

3. **分割线**
   ```
   ───────── 或 ─────────
   上下间距各 48rpx
   ```

4. **邮箱登录按钮**
   ```
   [邮箱图标 40rpx] 邮箱验证码登录
   次要按钮样式（珊瑚色边框）
   点击跳转到邮箱登录页
   ```

5. **底部提示**
   ```
   "登录即代表同意"
   《隐私政策》和《用户协议》
   字体: 24rpx, 灰色
   链接: 青绿色, 可点击跳转 web-view
   ```

---

## 🎭 交互动效（微信小程序实现）

### 按钮点击反馈
```javascript
// 使用 hover-class 实现
<button hover-class="button-hover" hover-stay-time="100">
  微信快速登录
</button>

// WXSS
.button-hover {
  opacity: 0.9;
  transform: scale(0.98);
}
```

### 页面加载动画
```javascript
// 使用 wx:if 和 animation
// 卡片从下往上渐显
page({
  data: {
    animationData: {}
  },
  onLoad() {
    const animation = wx.createAnimation({
      duration: 500,
      timingFunction: 'ease-out'
    })
    animation.translateY(0).opacity(1).step()
    this.setData({
      animationData: animation.export()
    })
  }
})
```

### 加载状态
```javascript
// 微信登录按钮点击后
<button loading="{{loading}}" disabled="{{loading}}">
  {{loading ? '登录中...' : '微信快速登录'}}
</button>
```

---

## 📊 响应式适配（微信小程序屏幕）

### 小屏幕（iPhone SE / 6/7/8：750rpx 宽）
```
卡片宽度: 670rpx（左右留白 40rpx）
内边距: 60rpx 40rpx
Logo: 120rpx
标题: 44rpx
按钮高度: 96rpx
```

### 大屏幕（iPhone 12/13/14：1170rpx 宽）
```
卡片最大宽度: 670rpx（保持不变，居中）
其他尺寸同上（使用 rpx 自动适配）
```

### 全面屏适配
```javascript
// 获取系统信息
const systemInfo = wx.getSystemInfoSync()
const statusBarHeight = systemInfo.statusBarHeight
const safeAreaBottom = systemInfo.screenHeight - systemInfo.safeArea.bottom

// 动态计算顶部间距
topPadding = statusBarHeight + 44 + 40  // 状态栏 + 导航栏 + 额外间距
```

---

## 🎯 可访问性（微信小程序规范）

1. **按钮对比度**: 微信绿 #07C160 与白色文字对比度 4.52:1（符合 WCAG AA）
2. **触摸区域**: 按钮高度 96rpx（约 48px），符合微信规范
3. **加载状态**: 使用 loading 属性显示加载动画
4. **错误提示**: 使用 wx.showToast 显示友好提示

---

## 🚀 微信小程序登录流程

### 1. 微信快速登录流程
```javascript
// Step 1: 获取用户授权
wx.getUserProfile({
  desc: '用于完善用户资料',
  success: (res) => {
    // Step 2: 获取 code
    wx.login({
      success: (loginRes) => {
        // Step 3: 发送到后端
        wx.request({
          url: 'https://your-api.com/auth/wechat',
          method: 'POST',
          data: {
            code: loginRes.code,
            userInfo: res.userInfo
          },
          success: (apiRes) => {
            // Step 4: 保存 token
            wx.setStorageSync('token', apiRes.data.token)
            // Step 5: 跳转到首页
            wx.switchTab({ url: '/pages/index/index' })
          }
        })
      }
    })
  },
  fail: (err) => {
    wx.showToast({
      title: '需要授权才能使用',
      icon: 'none'
    })
  }
})
```

### 2. 邮箱验证码登录流程
```javascript
// 点击邮箱登录按钮
handleEmailLogin() {
  wx.navigateTo({
    url: '/pages/login/email'  // 跳转到邮箱登录页
  })
}

// 邮箱登录页流程：
// 1. 输入邮箱
// 2. 点击"获取验证码"
// 3. 输入验证码
// 4. 点击"登录"
// 5. 后端验证，返回 token
// 6. 跳转到首页
```

---

## 🎨 UI 关键词总结（用于 AI 生图）

```
WeChat mini program login screen
Mobile vertical portrait 750x1334
Chinese interface with text "清账 ClearLedger"
Glassmorphism frosted glass centered card
Clean gradient background (teal #4097a9 to coral #fa9583)
Large green WeChat login button (#07C160) with WeChat icon
Secondary email login button with coral outline
Rounded corners 40rpx
App logo at top (120rpx)
Minimalist modern clean design
Chinese text "欢迎使用清账"
Soft shadows and premium feel
Mobile UI optimized spacing
```

---

## 📝 开发注意事项（微信小程序）

1. **使用 rpx 单位**：确保不同屏幕自动适配
2. **毛玻璃效果兼容性**：部分 Android 机型不支持 backdrop-filter，需提供降级方案
3. **安全区域**：使用 `<view class="safe-area-top">` 和 `<view class="safe-area-bottom">` 
4. **微信授权**：
   - 使用 `wx.getUserProfile` 替代已废弃的 `wx.getUserInfo`
   - 需要在 `app.json` 配置 `"permission"`
5. **网络请求**：
   - 域名需要在微信公众平台配置白名单
   - 必须使用 HTTPS
6. **Token 存储**：使用 `wx.setStorageSync` 本地存储
7. **错误处理**：使用 `wx.showToast` 而不是 `alert`
8. **Loading 状态**：使用 `wx.showLoading` 和 `wx.hideLoading`

### 示例代码结构
```
pages/
├─ login/
│  ├─ index.wxml      # 登录页面结构
│  ├─ index.wxss      # 登录页面样式
│  ├─ index.js        # 登录页面逻辑
│  └─ index.json      # 页面配置
└─ login/
   └─ email/          # 邮箱登录子页面
      ├─ index.wxml
      ├─ index.wxss
      ├─ index.js
      └─ index.json
```

---

## 🔐 隐私政策和用户协议

### 必须展示的内容
根据微信小程序规范和法律要求：

1. **用户协议**（web-view）
   - 服务条款
   - 使用规范
   - 账号管理
   - 免责声明

2. **隐私政策**（web-view）
   - 收集的信息类型
   - 信息使用方式
   - 信息存储和保护
   - 第三方服务（微信登录）
   - 用户权利

### 实现方式
```javascript
// 点击隐私政策
handlePrivacyClick() {
  wx.navigateTo({
    url: '/pages/webview/index?url=https://yoursite.com/privacy'
  })
}

// 点击用户协议
handleTermsClick() {
  wx.navigateTo({
    url: '/pages/webview/index?url=https://yoursite.com/terms'
  })
}
```

---

**生成时间**: 2026-08-13  
**版本**: v1.0 - 微信小程序版  
**适配平台**: 微信小程序（iOS / Android）
