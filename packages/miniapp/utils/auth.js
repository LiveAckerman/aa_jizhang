/**
 * 登录守卫工具
 *
 * 微信审核要求：用户可先浏览体验功能，不能一进入就强制登录/授权。
 * 因此：
 *  - tab 页（账本 / 统计 / 我的）游客可进入，展示空状态引导；
 *  - 需要账号的动作（新建/加入账本、记账、进入账本详情等）在触发时才引导登录；
 *  - login 页用 navigateTo 打开（可返回），登录成功后回到原页面刷新。
 */
/** 是否已登录 */
function isLoggedIn() {
  // 在函数内取 app，避免模块加载早于 App() 实例化时 getApp() 为 undefined
  return getApp().isLoggedIn()
}

/**
 * 需要登录才能继续的动作守卫。
 * 已登录：返回 true，调用方继续执行动作。
 * 未登录：弹出登录页（可返回），返回 false，调用方直接 return。
 *
 * @param {object} [options]
 * @param {string} [options.title] 引导文案（展示在登录提示里，可选）
 * @param {string} [options.redirect] 登录成功后希望跳转的页面（含参数），
 *        用于扫码/分享等需要落到特定页的场景；普通场景留空，登录页会自动返回上一页。
 * @returns {boolean} 是否已登录（true 表示可继续）
 */
// 防重入标记：wx.navigateTo 是异步的，真机上一次点击可能触发两次 tap，
// 在首个 navigateTo 完成前，栈顶还不是 login 页，仅靠 getCurrentPages 判断不够，
// 故用短时标记拦住第二次跳转，避免登录页被压栈两次。
let navigatingToLogin = false

function requireLogin(options = {}) {
  if (isLoggedIn()) return true

  // 已在跳转中 / 栈顶已是登录页：直接吞掉，避免重复 navigateTo
  const pages = getCurrentPages()
  const top = pages[pages.length - 1]
  if (navigatingToLogin || (top && top.route === 'pages/login/login')) {
    return false
  }

  const query = []
  if (options.redirect) {
    query.push('redirect=' + encodeURIComponent(options.redirect))
  }
  const suffix = query.length ? '?' + query.join('&') : ''

  navigatingToLogin = true
  wx.navigateTo({
    url: '/pages/login/login' + suffix,
    complete: () => {
      // 跳转完成（成功或失败）后解除标记；留一点缓冲防抖
      setTimeout(() => { navigatingToLogin = false }, 300)
    },
  })
  return false
}

module.exports = { isLoggedIn, requireLogin }
