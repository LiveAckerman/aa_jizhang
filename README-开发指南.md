# 出发AA记账 - 快速开始

## 📦 项目结构

```
aa_jizhang/
├── packages/
│   ├── miniapp/          # 微信小程序前端
│   ├── server/           # NestJS 后端服务
│   └── shared/           # 共享类型定义
├── docs/                 # 项目文档
├── scripts/              # 启动脚本
└── .env                  # 环境变量配置
```

---

## 🚀 快速启动

### 1. 安装依赖

```bash
# 使用 pnpm（推荐）
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填写配置：

```env
# Cloudflare R2 配置
R2_ACCOUNT_ID=你的账号ID
R2_ACCESS_KEY_ID=你的访问密钥
R2_SECRET_ACCESS_KEY=你的访问密钥
R2_BUCKET_NAME=aajizhang
R2_PUBLIC_URL=https://cdn.ljw44.com

# 微信小程序配置
WX_APPID=wxcd442ce3374ec257
WX_SECRET=你的微信密钥

# 数据库配置
DB_HOST=111.228.61.230
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=你的数据库密码
DB_DATABASE=aa_jizhang

# JWT 配置
JWT_SECRET=你的JWT密钥
JWT_EXPIRES_IN=7d

# 服务端口
PORT=9080
```

### 3. 启动后端服务

```bash
# 方式1：使用启动脚本（推荐）
./scripts/start-server.sh

# 方式2：手动启动
cd packages/server
pnpm run start:dev
```

服务将运行在：`http://localhost:9080`

### 4. 启动小程序

1. 打开微信开发者工具
2. 导入项目：选择 `packages/miniapp` 目录
3. 填写 AppID（测试可以选择"不使用AppID"）
4. 点击「编译」运行

---

## 📚 文档索引

- [产品设计文档](./docs/product-design-doc.md) - 产品需求和功能设计
- [UI设计简要](./docs/ui-design-brief.md) - UI风格和视觉设计
- [登录功能实现](./docs/登录功能实现文档.md) - 登录技术实现
- [后端接口文档](./docs/后端接口开发完成总结.md) - API接口说明
- [API测试文档](./docs/API测试文档.md) - 接口测试指南
- [开发完成报告](./docs/出发AA记账-登录功能开发完成报告.md) - 完整开发报告

---

## ✅ 已完成功能

### 用户认证
- ✅ 微信登录
- ✅ 首次登录信息完善
- ✅ 头像上传
- ✅ 昵称修改
- ✅ 个人信息管理

### 下一步开发
- ⏳ 账本创建和管理
- ⏳ 成员邀请
- ⏳ 记账功能（共享账/私密账）
- ⏳ 智能结算
- ⏳ 统计分析

---

## 🧪 测试账号

**测试环境：** 开发环境  
**后端地址：** http://localhost:9080  

---

## 🔧 常用命令

### 后端

```bash
# 开发模式
cd packages/server
pnpm run start:dev

# 生产构建
pnpm run build

# 生产运行
pnpm run start:prod
```

### 前端（小程序）

```bash
# 使用微信开发者工具直接打开 packages/miniapp
```

---

## 📝 技术栈

### 前端
- **框架：** 微信小程序原生
- **UI风格：** 渐变背景 + 毛玻璃效果
- **状态管理：** app.globalData

### 后端
- **框架：** NestJS
- **数据库：** MySQL + TypeORM
- **认证：** JWT
- **文件存储：** Cloudflare R2
- **API文档：** 待集成 Swagger

---

## 🐛 问题排查

### 1. 后端启动失败

检查：
- 数据库是否启动
- `.env` 配置是否正确
- 端口 9080 是否被占用

### 2. 小程序无法登录

检查：
- 后端服务是否启动
- `app.js` 中的 `baseURL` 是否正确
- 微信开发者工具的"详情-本地设置"中是否勾选"不校验合法域名"

### 3. 图片上传失败

检查：
- Cloudflare R2 配置是否正确
- R2 存储桶是否创建
- API 密钥是否有效

---

## 📞 联系方式

**项目负责人：** 李继旺  
**开发时间：** 2026-08-13  

---

**Happy Coding! 🎉**
