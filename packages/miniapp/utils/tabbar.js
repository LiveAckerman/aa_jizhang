/**
 * 设置自定义 tabBar 的选中态（带组件未就绪重试）
 *
 * 背景：
 * 1. 开启 lazyCodeLoading 后，onShow 时 tabBar 组件实例可能尚未就绪，
 *    getTabBar() 返回 null，需重试兜底。
 * 2. 自定义 tabBar 每个页面是独立实例，跨页面切换时 pill 起点会错乱，
 *    故调用组件的 setActive()，由其用「上一个位置→当前位置」演出正确滑动。
 *
 * @param {object} page  页面实例（this）
 * @param {number} index 目标 tab 下标
 * @param {number} retry 剩余重试次数
 */
function setTabBarSelected(page, index, retry = 8) {
  if (typeof page.getTabBar !== 'function') return

  const tabBar = page.getTabBar()
  if (tabBar && typeof tabBar.setActive === 'function') {
    tabBar.setActive(index)
    // 定位完成后，把「上一个位置」更新为当前，供下次切换用
    const app = getApp()
    app.globalData.tabPrevSelected = index
    app.globalData.tabSelected = index
    return
  }

  if (retry > 0) {
    setTimeout(() => setTabBarSelected(page, index, retry - 1), 40)
  }
}

module.exports = { setTabBarSelected }
