/**
 * 轻量访问采集：每次 App.onShow 上报一次。
 * 不使用通用 request()，因此失败、401 或网络超时都不会影响用户界面或登录态。
 */
const VISITOR_ID_KEY = 'analyticsVisitorId'
const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

let cachedVisitorId = null
let visitorIdPromise = null

function bytesToUuid(randomValues) {
  try {
    const bytes = new Uint8Array(randomValues)
    if (bytes.length !== 16) return null
    // RFC 4122 v4 UUID；仅依赖小程序的安全随机数接口。
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  } catch {
    return null
  }
}

/** wx.getRandomValues 是异步回调 API，随机字节位于 success.res.randomValues。 */
function randomId() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.getRandomValues !== 'function') {
      resolve(null)
      return
    }

    try {
      wx.getRandomValues({
        length: 16,
        success(res) {
          resolve(bytesToUuid(res && res.randomValues))
        },
        fail() {
          resolve(null)
        },
      })
    } catch {
      resolve(null)
    }
  })
}

function readStoredVisitorId() {
  try {
    const existing = wx.getStorageSync(VISITOR_ID_KEY)
    return typeof existing === 'string' && VISITOR_ID_PATTERN.test(existing) ? existing : null
  } catch {
    return null
  }
}

/** 并发 onShow 共享同一次初始化，避免生成并覆盖不同的安装标识。 */
function visitorId() {
  if (cachedVisitorId) return Promise.resolve(cachedVisitorId)
  if (visitorIdPromise) return visitorIdPromise

  const pending = (async () => {
    const existing = readStoredVisitorId()
    if (existing) {
      cachedVisitorId = existing
      return existing
    }

    const id = await randomId()
    if (!id) return null

    const value = `v_${id.replace(/-/g, '')}`
    cachedVisitorId = value
    try {
      wx.setStorageSync(VISITOR_ID_KEY, value)
    } catch {
      // 当前进程仍复用内存中的标识；存储失败不影响小程序业务。
    }
    return value
  })().catch(() => null)
  visitorIdPromise = pending
  pending.then(() => {
    if (visitorIdPromise === pending) visitorIdPromise = null
  })

  return pending
}

function trackAppVisit(app) {
  if (typeof wx === 'undefined' || typeof wx.getRandomValues !== 'function') return false
  if (!app || !app.globalData || !app.globalData.apiBaseUrl) return false

  // onShow 不等待这条链；末尾 catch 保证同步异常和 Promise 异常均不会外溢。
  Promise.all([visitorId(), randomId()])
    .then(([id, eventId]) => {
      if (!id || !eventId || typeof wx.request !== 'function') return
      try {
        wx.request({
          url: `${app.globalData.apiBaseUrl}/analytics/app-visits`,
          method: 'POST',
          data: { eventId, visitorId: id },
          timeout: 5000,
          header: {
            'Content-Type': 'application/json',
            ...(app.globalData.token ? { Authorization: `Bearer ${app.globalData.token}` } : {}),
          },
          // 埋点请求没有 UI 副作用；失败不重试，避免离线时累积或阻塞业务。
          fail() {},
        })
      } catch {
        // 部分基础库会同步抛错；采集失败不能影响 onShow。
      }
    })
    .catch(() => {})

  return true
}

module.exports = { randomId, trackAppVisit, visitorId }
