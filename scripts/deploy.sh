#!/usr/bin/env bash
# =============================================================================
# deploy.sh — 出发AA记账后端一键部署到 103 服务器
#
# 用法：
#   ./scripts/deploy.sh            # 完整部署（push + build + upload + env + restart）
#   ./scripts/deploy.sh --no-push  # 跳过 git push（代码已推过）
#   ./scripts/deploy.sh --no-env   # 跳过 .env.production 同步（只更新代码）
#   ./scripts/deploy.sh --dry-run  # 只演练，不实际执行
#
# 环境变量：
#   本地开发用 .env（连测试库），生产用 .env.production（连生产库）
#   两份文件都在 .gitignore 中，不提交。修改生产变量时改 .env.production 即可
#
# 前提：
#   - ~/.ssh/id_ed25519 已配置且可连接 103.65.39.210
#   - 本地已安装 pnpm、rsync
# =============================================================================

set -euo pipefail

# ── 配置 ──────────────────────────────────────────────────────────────────────
SERVER_USER="root"
SERVER_IP="103.65.39.210"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/root/aa-jizhang-server"
PM2_APP="aa-jizhang-api"

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
RSYNC="rsync -az --delete -e \"ssh -i $SSH_KEY -o StrictHostKeyChecking=no\""

# ── 参数解析 ──────────────────────────────────────────────────────────────────
SKIP_PUSH=false
SKIP_ENV=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --no-push)  SKIP_PUSH=true ;;
    --no-env)   SKIP_ENV=true ;;
    --dry-run)  DRY_RUN=true ;;
    *)          echo "未知参数: $arg"; exit 1 ;;
  esac
done

run() {
  if [ "$DRY_RUN" = true ]; then
    echo "[dry-run] $*"
  else
    eval "$@"
  fi
}

# ── 工具函数 ──────────────────────────────────────────────────────────────────
step() { echo ""; echo "▶ $1"; }
ok()   { echo "  ✓ $1"; }
fail() { echo "  ✗ $1" >&2; exit 1; }

# ── 检查本地工具 ──────────────────────────────────────────────────────────────
step "检查本地环境"
command -v pnpm  >/dev/null || fail "pnpm 未安装"
command -v rsync >/dev/null || fail "rsync 未安装"
[ -f "$SSH_KEY" ]            || fail "SSH 密钥不存在: $SSH_KEY"
ok "环境检查通过"

# ── 确认工作目录 ──────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"
ok "项目根目录: $PROJECT_ROOT"

# ── Step 1: git push ──────────────────────────────────────────────────────────
if [ "$SKIP_PUSH" = false ]; then
  step "推送代码到远程仓库"
  run "git push origin main"
  ok "代码已推送"
else
  step "跳过 git push"
fi

# ── Step 2: 本地构建 ──────────────────────────────────────────────────────────
step "构建 shared 包"
run "pnpm build:shared"
ok "shared 构建完成"

step "构建 server 包"
run "pnpm build:server"
ok "server 构建完成（dist/ 已生成）"

# ── Step 3: 上传 dist ─────────────────────────────────────────────────────────
step "上传 packages/server/dist → 服务器"
run "rsync -az --delete \
  -e \"ssh -i $SSH_KEY -o StrictHostKeyChecking=no\" \
  packages/server/dist/ \
  ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/packages/server/dist/"
ok "server dist 上传完成"

step "上传 packages/shared/dist → 服务器"
run "rsync -az --delete \
  -e \"ssh -i $SSH_KEY -o StrictHostKeyChecking=no\" \
  packages/shared/dist/ \
  ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/packages/shared/dist/"
ok "shared dist 上传完成"

# ── Step 3.5: 同步生产环境变量 ────────────────────────────────────────────────
# 说明：本地 .env 是开发库配置，生产走独立的 .env.production 文件
#      通过 --no-env 可跳过（例如只更新代码、不动配置时）
if [ "$SKIP_ENV" = false ]; then
  step "同步 .env.production → 服务器 .env"
  if [ ! -f .env.production ]; then
    fail ".env.production 不存在。请先从服务器拉取一份：
      scp -i $SSH_KEY ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/.env ./.env.production
    或者使用 --no-env 跳过此步"
  fi
  # 安全校验：生产配置不允许出现测试库或非生产标识
  if grep -qE "^DB_DATABASE=.*_test\b" .env.production; then
    fail ".env.production 中 DB_DATABASE 疑似指向测试库，拒绝部署"
  fi
  if ! grep -qE "^NODE_ENV=production[[:space:]]*$" .env.production; then
    fail ".env.production 中 NODE_ENV 必须严格为 production，拒绝部署"
  fi
  # 覆盖前先在服务器上备份现有 .env，出问题时可 mv 回滚
  run "$SSH ${SERVER_USER}@${SERVER_IP} '[ -f ${REMOTE_DIR}/.env ] && cp ${REMOTE_DIR}/.env ${REMOTE_DIR}/.env.bak || true'"
  run "rsync -az \
    -e \"ssh -i $SSH_KEY -o StrictHostKeyChecking=no\" \
    .env.production \
    ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/.env"
  ok ".env 同步完成（旧配置备份为 .env.bak）"
else
  step "跳过 .env 同步（--no-env）"
fi

# ── Step 4: pm2 重启 ──────────────────────────────────────────────────────────
step "重启 pm2 进程: $PM2_APP"
run "$SSH ${SERVER_USER}@${SERVER_IP} 'pm2 restart $PM2_APP'"
ok "pm2 restart 完成"

# ── Step 5: 验证服务状态 ──────────────────────────────────────────────────────
step "验证服务状态（等待 5 秒）"
if [ "$DRY_RUN" = false ]; then
  sleep 5
  STATUS=$($SSH ${SERVER_USER}@${SERVER_IP} "pm2 show $PM2_APP | grep -E 'status|uptime|unstable'")
  echo "$STATUS"
  if echo "$STATUS" | grep -q "online"; then
    ok "服务运行正常 ✅"
  else
    fail "服务状态异常，请检查: ssh root@${SERVER_IP} 'pm2 logs $PM2_APP --lines 50'"
  fi
fi

echo ""
echo "============================================================"
echo "  部署完成 🚀"
echo "  服务器: ${SERVER_IP}"
echo "  pm2:   ${PM2_APP}"
echo "  查看日志: ssh root@${SERVER_IP} 'pm2 logs ${PM2_APP} --lines 50'"
echo "============================================================"
