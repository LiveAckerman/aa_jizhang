# 出发AA记账 (DepartureAA)

多人场景记账小程序 — 专注旅行、聚餐、活动等多人分账场景，支持共享账 + 私密账双账本模式。

## 技术架构

pnpm workspace monorepo：

```
packages/
├── miniapp/    微信原生小程序 (appid: wxcd442ce3374ec257)
├── server/     Nest.js 后端 (微信登录 + JWT + MySQL/TypeORM)
└── shared/     小程序与后端共享的类型、常量
```

## 环境准备

1. 安装依赖（项目根目录）：
   ```bash
   pnpm install
   ```

2. 配置环境变量：复制 `.env.example` 为 `.env` 并填写真实值
   ```bash
   cp .env.example .env
   ```
   关键项：`WX_APPID` / `WX_SECRET`（微信小程序密钥）、数据库连接、`JWT_SECRET`

## 常用命令

```bash
# 构建 shared（server 依赖，首次需先构建）
pnpm build:shared

# 启动后端（开发模式，热重载）
pnpm dev:server

# 构建后端
pnpm build:server

# 生成图片素材（插画/背景/Logo 等，>200KB 自动上传 R2）
node scripts/gen-asset.js --prompt "..." --ratio 9:16 --out static/images/xxx.png
```

## 小程序开发

用微信开发者工具打开 `packages/miniapp` 目录。

- 开发环境后端地址：`http://localhost:9080`（需在开发者工具关闭「校验合法域名」）
- 生产环境需将后端域名加入小程序 request 合法域名白名单（HTTPS + 备案）

## 已接入模块

- 微信登录与个人资料
- 账本 CRUD、自定义分组、邀请、加入、退出和复制
- 共享账/私密账、四种分账算法、图片凭证和位置
- 汇率换算、交易修改日志和基础统计

当前尚未完成智能结算闭环、非平均分账的逐成员输入、前端成员移除、搜索、数据导出/备份/恢复及邮箱登录。详细状态见 [产品设计文档](./docs/product-design-doc.md)。

## 素材生成

所有视觉素材（插画、背景、Logo、图标）统一通过 `scripts/gen-asset.js` 生成，
详见 `.claude/skills/generate-asset.md`。严禁使用 emoji 作图标，图标用图标库。

## 文档

设计与产品文档见 `docs/` 目录。
