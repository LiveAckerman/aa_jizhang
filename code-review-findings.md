# 代码审查发现 - 游客模式 + isProfileComplete 逻辑

## ✅ 通过项

### 1. 游客模式守卫覆盖
- **books.js**: `onTapCreate/onTapBook/onPullDownRefresh` 均有守卫 ✓
- **statistics.js**: `onShow` 正确跳过 API 调用；交互控件在 `wx:else` 内不渲染 ✓
- **profile.js**: `goEdit` 有 requireLogin 守卫 ✓
- **custom-tab-bar**: `onFab` 有 requireLogin 守卫 ✓
- **二级页面**: 所有入口路径均有守卫（books/custom-tab-bar/join 均已拦截）✓
- **request.js**: 401 自动跳转登录页，兜底防护 ✓

### 2. isProfileComplete 逻辑闭环
- **后端**: dismissProfilePrompt 设 `isProfileComplete = true` ✓
- **前端**: maybeShowAuthDrawer 检查 `!user.isProfileComplete` 并立即调用 dismiss 接口 ✓
- **数据流**: 登录 → 前端判断 → 弹抽屉 → 调 dismiss → 后端写 DB → 下次登录不再弹 ✓

---

## ⚠️ 需要修复

### 问题 1: onLongPressGroup 缺少显式守卫
**文件**: `packages/miniapp/pages/books/books.js:66`

**问题**: `onLongPressGroup` 没有 requireLogin 守卫，依赖隐式条件（游客态 groups 为空）防护。

**风险**: 中。如果未来 onShow 逻辑变动，可能暴露漏洞。

**建议**: 
```js
onLongPressGroup(e) {
  if (!requireLogin()) return  // 显式守卫
  const id = e.currentTarget.dataset.id
  // ...
}
```

---

### 问题 2: onAuthorized 手动拼接 user 对象
**文件**: `packages/miniapp/pages/books/books.js:172`

**问题**: 
```js
const user = Object.assign({}, app.globalData.user, { avatar, nickname, isProfileComplete: true })
```
手动设置 `isProfileComplete: true`，但后端 `PUT /user/profile` 返回的 `data` 已包含完整 user（含 isProfileComplete, hasUsedWechatAvatar 等）。前端应该用后端返回值。

**风险**: 低。当前能工作，但数据不一致（hasUsedWechatAvatar 等字段不会更新）。

**建议**:
```js
const res = await request({ url: '/user/profile', method: 'PUT', data: { avatar, nickname } })
app.setLoginState(app.globalData.token, res.data)  // 用后端返回的完整 user
```

---

### 问题 3: statistics onScope/onRange 缺少显式守卫
**文件**: `packages/miniapp/pages/statistics/statistics.js:108,115`

**问题**: `onScope/onRange/onBookChange` 没有守卫，直接调用 `this.load()`。虽然控件在 `wx:else` 内游客态不渲染，但缺少代码层防护。

**风险**: 中。与问题 1 类似，依赖 WXML 隐式防护。

**建议**: 在 `load()` 方法入口加守卫：
```js
async load() {
  if (this.data.isGuest) return  // 防御性守卫
  try {
    // ...
  }
}
```

---

## 📋 边界情况验证

### ✅ 已验证通过
- [x] 游客下拉刷新 → `onPullDownRefresh` 正确 return
- [x] 游客点击 FAB → custom-tab-bar `onFab` 有 requireLogin
- [x] 401 过期 → request.js 自动跳登录页
- [x] 登录页已登录 → login.js onLoad 自动 navigateBack
- [x] 抽屉关闭 → dismiss 接口设 isProfileComplete，下次不弹

### ⏳ 需要测试确认
- [ ] 游客态直接分享链接进 book-detail → 401 是否正确跳登录
- [ ] 抽屉弹出中网络断开 → dismiss 接口失败，下次登录是否还会弹（预期：会，因为 DB 未更新）

---

## 总结

**严重问题**: 0  
**中等风险**: 2（问题 1, 3 - 隐式守卫）  
**低风险**: 1（问题 2 - 数据不一致）

**建议修复顺序**:
1. 问题 2（前端用后端返回值）— 改动小，收益明显
2. 问题 1（onLongPressGroup 显式守卫）— 防御性编程
3. 问题 3（statistics.load 入口守卫）— 统一防护模式
