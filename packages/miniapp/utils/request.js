/**
 * 网络请求封装
 */
const app = getApp()

/**
 * 发起请求
 * @param {object} options { url, method, data, header, skipAuth }
 * @returns {Promise}
 */
function request({ url, method = 'GET', data = {}, header = {}, skipAuth = false }) {
  const baseURL = getApp().globalData.apiBaseUrl
  const token = getApp().globalData.token

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseURL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
        ...header,
      },
      success(res) {
        const { statusCode, data: body } = res
        if (statusCode >= 200 && statusCode < 300) {
          // 后端统一响应 { code, message, data }
          if (body && body.code === 0) {
            resolve(body.data)
          } else {
            wx.showToast({ title: (body && body.message) || '请求失败', icon: 'none' })
            reject(body)
          }
        } else if (statusCode === 401) {
          // 登录态失效：清除并回首页游客态（不强制停留登录页），
          // 再次触发需要账号的动作时会引导登录
          getApp().clearLoginState()
          wx.reLaunch({ url: '/pages/books/books' })
          // reject 出 body（含 message），保持与其它分支一致，调用方可读 err.message
          reject((body && typeof body === 'object') ? body : res)
        } else {
          // 后端异常统一响应体 { message, error, statusCode }（见 AllExceptionsFilter）
          // 优先展示后端 message，并 reject 出 body，让调用方能拿到具体错误文案
          const msg = (body && body.message) || `请求错误 ${statusCode}`
          wx.showToast({ title: msg, icon: 'none' })
          reject((body && typeof body === 'object') ? body : res)
        }
      },
      fail(err) {
        wx.showToast({ title: '网络异常', icon: 'none' })
        reject(err)
      },
    })
  })
}

/**
 * 获取baseURL（用于wx.uploadFile等场景）
 */
function getBaseURL() {
  return getApp().globalData.apiBaseUrl
}

module.exports = { request, getBaseURL }
