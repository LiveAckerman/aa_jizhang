/**
 * 小程序环境配置
 *
 * 注意：小程序端不能放 appsecret 等敏感信息，
 * 这里只放后端接口地址等公开配置。
 */

// 后端全局前缀为 /api（见 server main.ts setGlobalPrefix），baseURL 需带上

// 开发环境后端地址（本地调试时在开发者工具中关闭「校验合法域名」）
// const DEV_API = 'http://10.0.10.40:9080/api'
//const DEV_API = 'http://192.168.101.5:9080/api'
  const DEV_API = 'https://aafz.lijiwang.top/api'

// 生产环境后端地址（需为已备案 HTTPS 域名，并加入小程序 request 合法域名白名单）
const PROD_API = 'https://aafz.lijiwang.top/api'

// 读取运行环境：develop（开发者工具）/ trial（体验版）/ release（正式版）
// 兜底一律返回 'release'：取值异常/为空时当成线上，绝不 fallback 到本地 IP，
// 否则审核环境（拿不到 develop 之外的确定值时）会误连本地 DEV_API 导致
// request:fail url not in domain list。
function readEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null
    const env = accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion
    return env || 'release'
  } catch (e) {
    return 'release'
  }
}

const envVersion = readEnvVersion()

// 白名单式：只有明确在开发者工具（develop）才用本地后端；
// 体验版/正式版/审核/任何未知情况一律走线上 HTTPS 域名。
const API_BASE_URL = envVersion === 'develop' ? DEV_API : PROD_API

module.exports = {
  API_BASE_URL,
  envVersion,
  APP_VERSION: '1.0.0',
}
