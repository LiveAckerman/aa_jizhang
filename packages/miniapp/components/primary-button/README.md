# primary-button 通用主按钮组件

统一封装的主按钮组件，解决微信小程序原生 button 点击变白、样式不一致、loading 状态处理等问题。

## 特性

- 三种类型：`primary`（橙色）/ `secondary`（蓝色）/ `outline`（描边）
- 内置 loading 状态和 CSS spinner
- 点击态使用 opacity，不会变白
- 支持 `open-type`（分享、获取头像等）
- 自动处理 disabled 状态

## 使用

### 1. 在页面 json 中引入

```json
{
  "usingComponents": {
    "primary-button": "/components/primary-button/primary-button"
  }
}
```

### 2. 基础用法

```html
<primary-button text="保存" bind:tap="onSave" />
```

### 3. 带 loading 状态

```html
<primary-button
  text="保存"
  loading-text="保存中..."
  loading="{{saving}}"
  bind:tap="onSave"
/>
```

对应的 JS：

```javascript
async onSave() {
  if (this.data.saving) return
  this.setData({ saving: true })
  wx.showLoading({ title: '保存中...', mask: true })
  try {
    await api.doSomething()
    wx.hideLoading()
    wx.showToast({ title: '已保存', icon: 'success' })
  } catch (e) {
    wx.hideLoading()
    this.setData({ saving: false })
    wx.showToast({ title: e.message, icon: 'none' })
  }
}
```

### 4. 不同类型

```html
<!-- 主按钮（橙色） -->
<primary-button type="primary" text="保存" bind:tap="onSave" />

<!-- 次按钮（蓝色） -->
<primary-button type="secondary" text="预览" bind:tap="onPreview" />

<!-- 描边按钮 -->
<primary-button type="outline" text="取消" bind:tap="onCancel" />
```

### 5. 分享按钮

```html
<primary-button
  text="分享给微信好友"
  open-type="share"
/>
```

### 6. 自定义外边距等

在页面 wxss 中通过 `custom-class` 添加：

```html
<primary-button
  text="保存"
  custom-class="my-btn"
  bind:tap="onSave"
/>
```

```css
.my-btn {
  margin-top: 32rpx;
}
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|-------|------|
| text | String | '确定' | 按钮文字 |
| loading | Boolean | false | 是否加载中 |
| loadingText | String | '加载中...' | loading 时显示的文字 |
| disabled | Boolean | false | 是否禁用 |
| type | String | 'primary' | 类型：primary / secondary / outline |
| openType | String | '' | 微信 button 的 open-type |
| customClass | String | '' | 额外的自定义 class |

## 事件

| 事件 | 说明 |
|------|------|
| tap | 点击（loading/disabled 时不触发） |
| getuserinfo | 对应 open-type="getUserInfo" |
| getphonenumber | 对应 open-type="getPhoneNumber" |
| chooseavatar | 对应 open-type="chooseAvatar" |
