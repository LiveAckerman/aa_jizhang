/**
 * 法律文档内容（受限 HTML，供 rich-text 渲染）
 *
 * 说明：
 * - rich-text 不支持 class 样式，用内联 style 控制排版
 * - 后期如需云端配置，可将此文件内容迁移到 API 返回
 * - 更新内容时请同步修改 updatedAt
 */

const COMMON_STYLE = {
  h: 'font-size:30rpx;font-weight:600;color:#2f4159;margin:32rpx 0 16rpx;',
  p: 'font-size:26rpx;color:#4a5568;line-height:1.8;margin-bottom:16rpx;',
}

const terms = {
  title: '用户协议',
  version: '1.0.0',
  updatedAt: '2026-08-13',
  content: `
<p style="${COMMON_STYLE.p}">欢迎使用「出发AA记账」（以下简称"本应用"）。本协议是您与本应用之间就使用服务所订立的协议。请您在使用前仔细阅读本协议全部内容。</p>
<p style="${COMMON_STYLE.h}">一、服务内容</p>
<p style="${COMMON_STYLE.p}">本应用为您提供多人场景下的记账、分账、账目统计等服务。您可创建账本、邀请成员共同记账，并进行费用分摊结算。</p>
<p style="${COMMON_STYLE.h}">二、账号与使用</p>
<p style="${COMMON_STYLE.p}">1. 您通过微信授权登录本应用，应对账号下的所有操作负责。</p>
<p style="${COMMON_STYLE.p}">2. 您承诺以真实、合法的方式使用本应用，不得利用本应用从事违法违规活动。</p>
<p style="${COMMON_STYLE.p}">3. 您在账本中录入的数据由您自行负责，本应用仅提供记录与计算工具。</p>
<p style="${COMMON_STYLE.h}">三、数据与责任</p>
<p style="${COMMON_STYLE.p}">1. 本应用提供的分账计算结果仅供参考，实际结算以成员间约定为准。</p>
<p style="${COMMON_STYLE.p}">2. 因您自身操作导致的数据错误或纠纷，本应用不承担责任。</p>
<p style="${COMMON_STYLE.h}">四、协议变更</p>
<p style="${COMMON_STYLE.p}">本应用有权根据需要修改本协议，修改后的协议将在应用内公布。若您继续使用，即视为接受修改后的协议。</p>
<p style="${COMMON_STYLE.p}">如您对本协议有任何疑问，可通过应用内的反馈渠道与我们联系。</p>
`.trim(),
}

const privacy = {
  title: '隐私政策',
  version: '1.0.0',
  updatedAt: '2026-08-13',
  content: `
<p style="${COMMON_STYLE.p}">「出发AA记账」（以下简称"我们"）非常重视您的隐私保护。本政策说明我们如何收集、使用和保护您的个人信息。</p>
<p style="${COMMON_STYLE.h}">一、我们收集的信息</p>
<p style="${COMMON_STYLE.p}">1. 微信授权信息：登录时获取的微信 openid，用于识别您的账号。</p>
<p style="${COMMON_STYLE.p}">2. 您主动填写的信息：昵称、头像等个人资料。</p>
<p style="${COMMON_STYLE.p}">3. 记账数据：您在账本中录入的金额、备注、分类等内容。</p>
<p style="${COMMON_STYLE.h}">二、信息的使用</p>
<p style="${COMMON_STYLE.p}">1. 用于向您提供记账、分账、统计等核心功能。</p>
<p style="${COMMON_STYLE.p}">2. 用于账号识别、数据同步与安全保护。</p>
<p style="${COMMON_STYLE.p}">3. 我们不会将您的个人信息出售或提供给无关第三方。</p>
<p style="${COMMON_STYLE.h}">三、信息的保护</p>
<p style="${COMMON_STYLE.p}">1. 我们采用加密传输、访问控制等措施保护您的信息安全。</p>
<p style="${COMMON_STYLE.p}">2. 私密账目仅您本人可见，其他账本成员无法查看。</p>
<p style="${COMMON_STYLE.h}">四、您的权利</p>
<p style="${COMMON_STYLE.p}">您有权访问、更正、删除您的个人信息，也可注销账号。注销后我们将删除或匿名化您的相关数据。</p>
<p style="${COMMON_STYLE.p}">如您对本政策有任何疑问，可通过应用内的反馈渠道与我们联系。</p>
`.trim(),
}

const DOCUMENTS = { terms, privacy }

module.exports = { DOCUMENTS }
