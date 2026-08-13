# nav-bar 通用顶部栏组件

自适应状态栏高度 + 胶囊按钮对齐的自定义导航栏，用于二级页面（带返回）和一级页面（自定义标题栏）。

## 前置条件

页面 `json` 需设为自定义导航并引入组件：

```json
{
  "navigationStyle": "custom",
  "usingComponents": {
    "nav-bar": "/components/nav-bar/nav-bar"
  }
}
```

## 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | String | '' | 标题文字 |
| showBack | Boolean | true | 是否显示返回按钮 |
| background | String | transparent | 背景色，如 `#ffffff` |
| color | String | #2f4159 | 标题与返回图标颜色 |
| fallbackUrl | String | '' | 无历史栈时返回的兜底页（tabBar 页会用 reLaunch） |
| fixed | Boolean | true | 是否固定顶部（会自动撑开占位） |

## 事件

| 事件 | 说明 |
|------|------|
| bind:back | 点击返回时触发 |
| bind:ready | 组件挂载后返回 `{ totalHeight }`，供页面精确留白 |

## 用法示例

### 二级页面（带返回）
```html
<nav-bar title="账本详情" fallback-url="/pages/books/books"></nav-bar>
```

### 带右侧操作（右插槽）
```html
<nav-bar title="账本详情">
  <view slot="right" bindtap="onMore">
    <van-icon name="ellipsis" size="22px" />
  </view>
</nav-bar>
```

### 一级页面（无返回，自定义左插槽）
```html
<nav-bar show-back="{{false}}" title="账本">
  <view slot="left"><!-- logo 或其他 --></view>
</nav-bar>
```

## 说明

- 返回逻辑：有历史栈用 `navigateBack`，无栈且设了 `fallbackUrl` 用 `reLaunch`
- 右侧操作用 `slot="right"`，左侧自定义用 `slot="left"`（showBack=false 时生效）
- 图标依赖 `@vant/weapp` 的 van-icon，已在组件 json 内引入
