# AdminJS 管理后台

这是一个独立的 ESM 服务，通过官方 `@adminjs/sql` 读取 PostgreSQL。它不加载 NestJS、TypeORM 实体，也不会改变现有服务的 CommonJS 构建配置。列表、筛选和详情继续直接读数据库；写操作通过带共享令牌的 NestJS 管理 API 进入现有业务服务。

当前开放三个资源：用户、账本和账单。用户只允许编辑昵称和头像；账本支持新建、编辑、删除；账单支持新建、编辑、删除。批量删除仍关闭，避免一次操作跨越多条业务记录。账单写入仍会执行成员校验、结算锁定、分账重算和原有账单日志。后台写操作另外写入 `admin_audit_logs`。`openid`、`unionid`、`inviteCode` 会从 AdminJS API 响应中移除，且不能用于筛选、排序或搜索。金额字段按数据库原值展示，`amount` 是 CNY 分，`originalAmount` 是原币分。

首页是只读统计报表：以北京时间展示今天、近 7 天、近 30 天的注册用户、小程序访问、新建账本和记录账单，并提供最近 30 天每日趋势。注册、账本、账单分别按各表创建时间统计。访问数读取 `app_visit_events.created_at` 和 `analytics_collection_status.started_at`；采集起点前显示“未采集”，跨起点区间显示“部分采集”，不会用 0 掩盖缺失历史。

## 本地启动

1. 在项目根目录执行 `pnpm install`。
2. 在根目录 `.env` 中补充：

   ```dotenv
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD_HASH=<bcrypt-hash>
   ADMIN_SESSION_SECRET=<at-least-32-random-characters>
   ADMIN_HOST=127.0.0.1
   ADMIN_PORT=9081
   ADMIN_API_URL=http://127.0.0.1:9080/api
   ADMIN_API_TOKEN=<same-token-used-by-the-NestJS-server>
   ```

3. 在交互式终端执行 `pnpm admin:hash-password`，输入两次密码，把输出的 bcrypt 哈希填入 `ADMIN_PASSWORD_HASH`。两次输入必须一致。
4. 先启动 NestJS 业务服务：`pnpm dev:server`。
5. 再执行 `pnpm build:admin && pnpm start:admin`，访问 `http://127.0.0.1:9081/admin`。

非 `production` 环境始终连接 `aa_jizhang_test`，即使 `.env` 中的 `DB_DATABASE` 指向其他数据库也会忽略。连接和查询最长等待 30 秒。后台不会自动建表或修改 schema。

## 生产部署

生产环境还需要设置：

```dotenv
NODE_ENV=production
DB_DATABASE=aa_jizhang
ADMIN_ALLOW_PRODUCTION_DB=true
ADMIN_TRUST_PROXY=1
```

执行 `pnpm install --frozen-lockfile`、`pnpm build:admin` 和 `pnpm start:admin`。生产启动会在监听端口前初始化 AdminJS 前端 bundle。请在 HTTPS 反向代理后提供后台；生产 cookie 强制 `Secure`。只有反向代理正确覆盖 `X-Forwarded-For` 和 `X-Forwarded-Proto` 时才设置 `ADMIN_TRUST_PROXY=1`。

AdminJS 7.8.17 自带的 Tiptap starter-kit 使用宽松的子依赖范围，pnpm 曾解析出 2.1.13/2.27.3 混合版本并导致运行期 ESM 导出错误。根 `package.json` 将相关扩展统一锁为 2.1.13；`@babel/plugin-syntax-import-assertions` 也是 AdminJS 生产/开发 bundle 的运行依赖，不要移除这些兼容固定项。

建议为后台创建专用 PostgreSQL 读账号，不要复用业务服务的可写账号。可用 `ADMIN_DB_HOST`、`ADMIN_DB_PORT`、`ADMIN_DB_USERNAME`、`ADMIN_DB_PASSWORD` 和 `ADMIN_DB_SSL` 配置；未配置时才回退到 `DB_*`。由于列表仍由 AdminJS SQL 资源直接读取，账号至少需要以下权限；写操作由 NestJS 服务账号执行：

```sql
GRANT CONNECT ON DATABASE aa_jizhang TO admin_reader;
GRANT USAGE ON SCHEMA public TO admin_reader;
GRANT SELECT ON TABLE public.users, public.books, public.transactions,
  public.app_visit_events, public.analytics_collection_status TO admin_reader;
```

生产部署时，先执行包含 `CreateAdminAuditLogs` 的后端迁移，再部署后端和 AdminJS。访问统计上线顺序是：先执行新增访问表的迁移，再部署后端，最后发布小程序。只有小程序发布后才会产生访问事件；历史访问无法补录，发布延迟、断网或上报失败也可能造成采集起点后的数据不完整。这里的步骤仅说明部署依赖，不会由 AdminJS 启动过程执行迁移或发布。

应用层的写入限制和数据库读账号应同时保留。不要给 AdminJS SQL 账号写权限，也不要把 `ADMIN_API_TOKEN` 暴露给浏览器；它只在 AdminJS 服务端转发请求时使用。

默认 session 保存在 `packages/admin/.sessions`，不会在业务数据库创建 session 表，适合单实例部署。多实例或无持久磁盘环境需要把 session store 换成独立 Redis 等共享存储后再部署。

## 验证

```bash
pnpm test:admin
pnpm verify:admin-statistics
pnpm verify:admin-live
pnpm verify:admin-production-assets
pnpm build:shared
pnpm build:server
```

`verify:admin-statistics` 只允许连接 `aa_jizhang_test`，在单个回滚事务内用临时表验证北京时间边界、30 天零填充、访问采集覆盖，以及账单按 `createdAt` 而非 `spentAt` 统计，不修改持久业务数据。`verify:admin-live` 同样只允许测试库，运行前临时设置 `ADMIN_E2E_PASSWORD` 为当前测试管理员的明文密码；脚本不会打印密码。`verify:admin-production-assets` 也拒绝生产数据库，它只用测试库验证 production bundle 和静态资源路由。

自动测试覆盖环境守卫、bcrypt 登录、session 鉴权、登录限流、敏感字段脱敏、查询字段白名单，以及四个默认写动作的服务端禁用配置。真实数据库验收还应在 `aa_jizhang_test` 上检查用户列表、账单列表和含 `splits` JSONB 的账单详情。

## 当前限制

- 现有 `bookId`、`payerId`、`creatorId` 等字段没有数据库外键；付款人、创建者已显示为头像 + 昵称，账本和账单 ID 只在详情/新建表单等必要位置保留。
- JSONB 字段仍使用 AdminJS 的通用编辑输入，适合小范围修正；复杂分账建议优先在小程序中修改。
- 删除账本会按业务服务顺序清理账单、账单日志和成员，删除已结算账单或已结算账本内的记录会被业务规则拒绝。
- 文件 session store 只支持单实例可靠运行。
