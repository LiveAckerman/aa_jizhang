#!/usr/bin/env bash
# =============================================================================
# prune-vant.sh — 裁剪 vant 到实际用到的组件
#
# 背景：微信开发者工具的「构建 npm」是整包拷贝，不做 tree-shaking。
#      vant 全量 1.9M，但本项目只用了 van-icon，裁剪后约 204K。
#
# 用法：每次在开发者工具执行「工具 → 构建 npm」之后，跑一次本脚本。
#   ./scripts/prune-vant.sh
#
# 注意：miniprogram_npm/ 在 .gitignore 中，裁剪结果不进版本库，
#      所以换机器 / 重装依赖 / 重新构建 npm 后都需要重跑。
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VANT_DIR="$SCRIPT_DIR/../packages/miniapp/miniprogram_npm/@vant/weapp"

if [ ! -d "$VANT_DIR" ]; then
  echo "✗ 未找到 $VANT_DIR"
  echo "  请先在微信开发者工具执行「工具 → 构建 npm」"
  exit 1
fi

# van-icon 的依赖闭环：icon 自身 + info(icon 的 json 引用) + common/mixins/wxs/definitions
# 如果以后新增了别的 vant 组件，把组件名追加到这里
KEEP="icon info common mixins wxs definitions"

BEFORE=$(du -sh "$VANT_DIR" | awk '{print $1}')

cd "$VANT_DIR"
for d in */; do
  d="${d%/}"
  case " $KEEP " in
    *" $d "*) ;;
    *) rm -rf "$d" ;;
  esac
done

AFTER=$(du -sh "$VANT_DIR" | awk '{print $1}')
echo "✓ vant 裁剪完成: $BEFORE → $AFTER"
echo "  保留组件: $KEEP"
