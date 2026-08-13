/**
 * 网络请求封装
 */
const app = getApp()

/**
 * 发起请求
 * @param {object} options { url, method, data, header }
 * @returns {Promise}
 */
function request({ url, method = 'GET', data = {}, header = {} }) {
  const baseUrl = getApp().globalData.apiBaseUrl
  const token = getApp().globalData.token

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
          // 登录态失效
          getApp().clearLoginState()
          wx.reLaunch({ url: '/pages/login/login' })
          reject(res)
        } else {
          wx.showToast({ title: `请求错误 ${statusCode}`, icon: 'none' })
          reject(res)
        }
      },
      fail(err) {
        wx.showToast({ title: '网络异常', icon: 'none' })
        reject(err)
      },
    })
  })
}

module.exports = { request }
