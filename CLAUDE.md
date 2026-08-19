# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**一起分账吧 (一起分账吧)** — 多人场景记账微信小程序，专注旅行、聚餐、活动等分账场景，支持共享账和私密账双账本模式。

**Architecture:** pnpm workspace monorepo with 3 packages:
- `packages/miniapp` — 微信原生小程序 (WeChat native miniapp, appid: wxcd442ce3374ec257)
- `packages/server` — NestJS 后端 (PostgreSQL + TypeORM)
- `packages/shared` — 前后端共享类型和常量

**Tech Stack:**
- Frontend: WeChat native miniapp (原生小程序), state in app.globalData
- Backend: NestJS + TypeORM + PostgreSQL + JWT auth + Cloudflare R2 storage
- Auth: WeChat login flow with JWT tokens

## Development Commands

### Installation & Setup
```bash
# Install dependencies (root directory)
pnpm install

# Build shared package first (server depends on it)
pnpm build:shared

# Watch mode for shared during development
pnpm dev:shared
```

### Backend Development
```bash
# Start backend in dev mode (hot reload)
pnpm dev:server
# Or: cd packages/server && pnpm start:dev

# Build backend
pnpm build:server

# Production build & start
cd packages/server
pnpm build
pnpm start:prod
```

Server runs on port 9080 (configurable via `PORT` in `.env`).

### Miniapp Development
Open `packages/miniapp` in WeChat Developer Tools (微信开发者工具).
- Dev backend: `http://localhost:9080` (disable domain verification in DevTools settings)
- Production requires HTTPS domain whitelisted in WeChat backend

### Testing
```bash
# API integration tests (direct DB + JWT signing)
node scripts/test-api.mjs

# Cascade delete test
node scripts/test-cascade-delete.mjs

# Frontend contract test
node scripts/test-frontend-contract.mjs
```

**Test harness pattern:** scripts like `test-api.mjs` directly connect to DB, create test users, hand-sign JWTs, and verify full API flows without needing the auth layer. Useful for backend contract testing.

### Asset Generation
```bash
# Generate visual assets (illustrations, backgrounds, logos)
node scripts/gen-asset.js --prompt "..." --ratio 9:16 --out static/images/xxx.png
```

**Important:** All visual assets (除图标外) should be generated via `scripts/gen-asset.js`. Images >200KB auto-upload to Cloudflare R2. Never use emoji as icons — use icon libraries instead. See `.claude/skills/generate-asset.md` for details.

## Architecture & Data Model

### Core Entities (TypeORM)
All entities are in `packages/server/src/`:

- **User** (`user/user.entity.ts`) — 用户表，WeChat openId + profile
- **Book** (`book/book.entity.ts`) — 账本，fields: name, scene, icon, cover, ownerId, inviteCode, archived
- **BookMember** (`book/book-member.entity.ts`) — 账本成员关系
- **BookGroup** (`book/book-group.entity.ts`) — 成员分组（如"同事"、"朋友"）
- **Transaction** (`transaction/transaction.entity.ts`) — 账单记录
  - **Type:** `shared` (共享账，所有成员可见) | `private` (私密账，仅创建者可见)
  - **Split methods:** `average` | `ratio` | `shares` | `fixed`
  - **Currency:** stores `currency` (原始币种), `originalAmount`, `exchangeRate`, and `amount` (always CNY in 分/cents)
  - **Location:** optional `locationName`, `locationAddress`, `latitude`, `longitude`
  - **Images:**凭证图片 URLs in `images` JSONB field
- **TransactionLog** (`transaction/transaction-log.entity.ts`) — 账单操作日志

**Database:** PostgreSQL with TypeORM. `synchronize: true` is enabled in development (auto-creates tables). **Production should disable this and use migrations.**

### Module Structure
- `auth/` — WeChat login (`POST /api/auth/wechat/login` with `{code}` → returns `{token, user}`)
- `user/` — User profile management (avatar upload, nickname, personal info)
- `book/` — Book CRUD, member management, invite codes
- `transaction/` — Transaction CRUD, split calculation
- `upload/` — R2 file uploads
- `exchange-rate/` — Currency conversion rates
- `stats/` — Statistics and analytics

### Shared Package
`packages/shared/src/` exports types and constants used by both miniapp and server:
- `types/user.ts`, `types/auth.ts` — User and auth DTOs
- `constants/colors.ts` — Shared color constants

**Always rebuild shared after type changes:** `pnpm build:shared`

### Miniapp Pages Structure
Key pages in `packages/miniapp/pages/`:
- `login/` — WeChat auth entry
- `edit-nickname/` — First-time user setup
- `books/` — Book list (tabbar home)
- `book-detail/` — Book detail with transactions
- `book-form/` — Create/edit book
- `add-transaction/` — Create transaction (共享账 or 私密账)
- `transaction-logs/` — Transaction history
- `statistics/` — Stats and charts
- `invite/`, `join/` — Invite flow
- `profile/`, `profile-edit/` — User profile

Custom tabbar configured via `"tabBar": { "custom": true }` in `app.json`.

## Environment Variables

Copy `.env.example` to `.env` and configure:

**Required:**
- `WX_APPID`, `WX_SECRET` — WeChat miniapp credentials
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` — PostgreSQL connection
- `JWT_SECRET` — JWT signing secret
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — Cloudflare R2 storage

**Optional:**
- `PORT` — Backend port (default: 9080)
- `JWT_EXPIRES_IN` — Token expiry (default: 7d)
- `IMAGE_UPLOAD_THRESHOLD` — Auto-upload threshold in KB (default: 200)
- `IMAGE_API_BASE_URL`, `IMAGE_API_KEY`, `IMAGE_API_MODEL` — AI image generation API (for `gen-asset.js`)

## Key Patterns & Conventions

### Currency Handling
- All monetary amounts stored in **分 (cents)** to avoid floating-point errors
- `Transaction.amount` is **always CNY in 分**
- `Transaction.currency` + `originalAmount` store the original currency
- `Transaction.exchangeRate` snapshots the rate at record time

### Transaction Type: Shared vs Private
- **Shared transactions** (`type: 'shared'`): visible to all book members, require `splitMethod` and `splits`
- **Private transactions** (`type: 'private'`): only visible to `creatorId`, no splits

### Authentication
- WeChat login flow: miniapp gets `code` → sends to `/api/auth/wechat/login` → backend calls WeChat API → returns JWT
- JWT stored in miniapp's `wx.setStorageSync('token')`
- Protected routes require `Authorization: Bearer <token>` header

### File Uploads
- Small files (<200KB): returned as base64 data URLs
- Large files (≥200KB): auto-uploaded to R2, return CDN URLs
- R2 directory structure documented in `.claude/memory/oss-assets-structure.md`

### Testing Strategy
- Backend contract tests bypass auth by directly creating DB users and hand-signing JWTs
- See `scripts/test-api.mjs` for the pattern: raw SQL user creation + `signJwt()` + API calls
- No unit test framework installed yet

## Common Workflows

### Adding a New API Endpoint
1. Create/update entity in `packages/server/src/*/`
2. Add DTO types to `packages/shared/src/types/`
3. Rebuild shared: `pnpm build:shared`
4. Implement controller + service in server
5. Test with `scripts/test-api.mjs` pattern
6. Update miniapp to consume the API

### Modifying Database Schema
1. Update entity file (e.g., `user.entity.ts`)
2. TypeORM auto-syncs in dev (tables update on server restart)
3. **Production:** disable `synchronize`, generate & run migrations

### Adding a New Page to Miniapp
1. Create page directory in `packages/miniapp/pages/`
2. Add to `app.json` pages array
3. If tabbar page, update custom tabbar component

## Documentation

- `docs/product-design-doc.md` — Product requirements & features
- `docs/ui-design-brief.md` — UI style & visual design
- `docs/登录功能实现文档.md` — Login implementation details
- `docs/后端接口开发完成总结.md` — API documentation
- `docs/API测试文档.md` — API testing guide
- `README-开发指南.md` — Quick start guide (Chinese)

## Project Status

**Completed:**
- ✅ WeChat login & auth
- ✅ User profile management (avatar, nickname)
- ✅ Book CRUD & invite system
- ✅ Transaction recording (shared & private)
- ✅ Currency conversion
- ✅ Basic statistics

**In Progress/TODO:**
- ⏳ Smart settlement calculation
- ⏳ Advanced analytics
- ⏳ Notifications
