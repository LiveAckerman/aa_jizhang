---
name: project-tech-decisions
description: 一起分账吧项目的核心技术决策与架构选型
metadata:
  type: project
---

一起分账吧（一起分账吧）多人记账应用的技术决策：

- **架构：** pnpm workspace monorepo，packages 下含 miniapp（微信原生小程序）、server（Nest.js 后端）、shared（共享代码）
- **前端：** 微信原生小程序（非 uni-app），后期可能扩展 App。小程序 appid: `wxcd442ce3374ec257`
- **后端：** 自建 Nest.js（用户明确不用微信云开发）。微信登录需服务端用 appid+appsecret 调 code2session 换 openid，再签发 JWT
- **登录方式：** 前期仅微信登录
- **UI 风格：** Apple 磨砂玻璃（Glassmorphism）+ iOS 设计语言
- **品牌色：** 主色 teal `#4097a9`、辅助米色 `#f4dfcc`、强调珊瑚 `#fa9583`、深蓝 `#2f4159`；微信绿 `#07C160`
- **Logo/品牌素材：** 定稿在 `static/images/logo/`——`logo-icon.png`（纯图标，多人围绕共享钱币）、`logo-card.png`（白色圆角卡片托底版，用于登录页）、`wordmark.png`（艺术字品牌名「一起分账吧」）。登录页用 logo-card + wordmark 组合。全部同步到 miniapp/assets/
- **核心功能：** 双账本模式（共享账 + 私密账），详见 [[project-tech-decisions]] 相关文档 docs/

**Why:** 用户前期只做微信小程序，后期可能有 App；重视动画和 Apple 质感；不想用云开发。
**How to apply:** 素材统一用 generate-asset skill 生成并传 R2；严禁 emoji 当图标，图标用图标库。
