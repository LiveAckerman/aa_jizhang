#!/usr/bin/env node
/**
 * CLI wrapper for generate-asset.js
 *
 * Usage examples:
 *   node scripts/gen-asset.js --type emptyState --subject "an open empty notebook" --out static/images/empty-states/empty-book.png
 *   node scripts/gen-asset.js --prompt "custom prompt here" --out static/images/logo/app-icon.png
 *   node scripts/gen-asset.js --type appLogo --subject "a travel expense sharing app" --out static/images/logo/app-icon.png
 */

const { generateAsset, PROMPT_TEMPLATES } = require('./generate-asset')

const args = process.argv.slice(2)

function getArg(name) {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 ? args[idx + 1] : null
}

const type    = getArg('type')
const subject = getArg('subject')
const out     = getArg('out')
const prompt  = getArg('prompt')
const ratio   = getArg('ratio')
let   size    = getArg('size')
const noTransparent = args.includes('--no-transparent')

// 比例别名 → 尺寸映射
const RATIO_PRESETS = {
  '1:1':  '1024x1024',   // 方形（Logo、图标、插画）
  '9:16': '1024x1792',   // 竖屏（登录页、手机全屏）
  '16:9': '1792x1024',   // 横屏（场景头图、Banner）
  '3:4':  '1024x1365',   // 竖版卡片
  '4:3':  '1365x1024',   // 横版卡片
}

// 优先级：ratio > size > 默认
if (ratio) {
  if (!RATIO_PRESETS[ratio]) {
    console.error(`Error: unknown ratio "${ratio}". Available: ${Object.keys(RATIO_PRESETS).join(', ')}`)
    process.exit(1)
  }
  size = RATIO_PRESETS[ratio]
} else if (!size) {
  size = '1024x1024'
}

if (!out) {
  console.error('Error: --out <path> is required')
  process.exit(1)
}

let finalPrompt = prompt

if (!finalPrompt) {
  if (!type) {
    console.error('Error: either --prompt or --type must be provided')
    console.error('Available types: emptyState, appLogo, sceneIllustration, backgroundPattern, avatarPlaceholder')
    process.exit(1)
  }

  const templateFn = PROMPT_TEMPLATES[type]
  if (!templateFn) {
    console.error(`Error: unknown type "${type}". Available: ${Object.keys(PROMPT_TEMPLATES).join(', ')}`)
    process.exit(1)
  }

  finalPrompt = templateFn(subject || '')
}

console.log(`\n[gen-asset] Prompt: ${finalPrompt}`)
console.log(`[gen-asset] Size: ${size}${ratio ? ` (ratio ${ratio})` : ''}\n`)

generateAsset({ prompt: finalPrompt, savePath: out, size, transparent: !noTransparent })
  .then(result => {
    console.log(`\n✅ Done`)
    console.log(`   Local: ${result.localPath}`)
    if (result.uploaded && result.url) {
      console.log(`   CDN:   ${result.url}`)
    }
  })
  .catch(err => {
    console.error(`\n❌ Failed: ${err.message}`)
    process.exit(1)
  })
