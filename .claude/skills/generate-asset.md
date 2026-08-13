---
description: 项目素材提供师 — 为整个项目生成所有视觉素材，包括插画、背景图、雪碧图、边框素材、Logo、贴纸、图案等，严禁使用 emoji 作为图标或素材。大文件自动上传 Cloudflare R2 OSS。
runInAgentSession: false
---

# 项目素材提供师（Asset Generator）

这个 Skill 是整个项目的**唯一视觉素材来源**。凡是项目中需要用到任何图片类素材，都通过此 Skill 生成，包括但不限于：

- 插画（空状态、引导页、场景头图）
- 背景图（页面背景、卡片背景、渐变背景）
- 雪碧图（Sprite Sheet，多个小图标/装饰合并为一张图）
- 边框素材（卡片边框、装饰边框、波浪边框）
- Logo / 应用图标 / 启动页
- 贴纸装饰（星星、爱心、云朵、旗帜等）
- 图案纹理（背景纹理、噪点纹理、条纹纹理）
- 自定义分割线素材
- 头像占位图

---

## 铁律（必须遵守）

1. **严禁在项目任何地方使用 emoji 作为图标或素材**
2. **图标类元素** → 必须使用图标库（Iconoir / Lucide / SF Symbols / Tabler Icons）
3. **自定义插画、背景、装饰类素材** → 必须通过本 Skill 生成
4. **生成失败时自动重试，最多重试 3 次**
5. **所有素材风格必须对齐 Apple Human Interface Guidelines**
6. **需要透明背景的素材（插画、贴纸、装饰）一律生成 PNG 透明底**
7. **大于 200KB 的图片自动上传 Cloudflare R2，返回 CDN 链接**

---

## 配置要求

**必须在项目根目录创建 `.env` 文件，包含以下配置：**

```bash
# AI 图片生成 API
IMAGE_API_BASE_URL=<your-image-api-base-url>
IMAGE_API_KEY=<your-image-api-key>
IMAGE_API_MODEL=<your-image-model>

# Cloudflare R2 对象存储
R2_ACCOUNT_ID=<your-r2-account-id>
R2_ACCESS_KEY_ID=<your-r2-access-key-id>
R2_SECRET_ACCESS_KEY=<your-r2-secret-access-key>
R2_ENDPOINT=<your-r2-endpoint>
R2_BUCKET_NAME=<your-r2-bucket-name>
R2_PUBLIC_URL=<your-r2-public-url>

# 图片上传策略（大于此大小自动上传 OSS，单位 KB）
IMAGE_UPLOAD_THRESHOLD=200
```

**配置模板已提供：** 参考项目根目录的 `.env.example` 文件。

**如果配置缺失：**
- Skill 会提示用户配置环境变量
- 用户可以选择「立即配置」或「忽略提醒」
- 选择忽略后，本次会话不再提醒（记录在会话内存中）
- Skill 将无法工作，直到配置完成

---

## 图片存储策略（智能决策）

```
生成图片后自动判断：

文件大小 ≤ 200KB:
  ✅ 保存到本地 static/images/
  ✅ 小程序直接引用本地路径
  
文件大小 > 200KB:
  ✅ 保存到本地 static/images/（备份）
  ✅ 自动上传到 Cloudflare R2
  ✅ 返回 CDN 公开链接
  ✅ 小程序引用 CDN 链接
  
R2 存储路径规则:
  images/YYYY-MM/filename.png
  例如：images/2026-08/bg-scene-travel.jpg
  
公开访问地址（自定义域名 cdn.ljw44.com）:
  https://cdn.ljw44.com/images/2026-08/bg-scene-travel.jpg

注意：
  - R2_PUBLIC_URL 未配置时，文件仍会上传到桶，但不返回公开地址
  - 公开访问依赖 Cloudflare R2 控制台绑定的自定义域名
```

---

## 重试机制

```
第1次失败 → 等待 1s → 第2次重试
第2次失败 → 等待 2s → 第3次重试
第3次失败 → 报错，执行降级方案
```

**降级方案（按优先级）：**
1. 简化 prompt 重新生成
2. 改用纯 CSS 实现（渐变、圆角）
3. 使用图标库中的 SVG 替代
4. 临时用品牌色色块占位，并记录待生成

---

## 素材类型 & 生成规范

### 1. 插画（Illustration）

**适用场景：** 空状态、引导页、账本头图、功能说明

**Prompt 模板：**
```
A minimalist flat illustration of [具体内容],
Apple iOS design language, clean geometric shapes,
soft gradient, [品牌配色 #4097a9 teal and #fa9583 coral],
friendly and approachable, centered composition,
transparent background, PNG
```

**尺寸：** 1024x1024（方形）或 1792x1024（横图场景头图）  
**格式：** PNG 透明背景  
**保存路径：** `static/images/illustrations/`

---

### 2. 背景图（Background）

**适用场景：** 页面背景、卡片背景、账本封面背景、头部 Hero 区域

**Prompt 模板：**
```
A beautiful [类型: gradient/abstract/scene] background,
Apple iOS wallpaper aesthetic, soft and elegant,
[配色描述], smooth gradients, no text, no harsh edges,
suitable as a mobile app background, wide format
```

**尺寸：** 1024x1024（卡片背景）/ 1024x1792（全屏背景）  
**格式：** JPG（不透明背景）或 PNG（可透明叠加）  
**保存路径：** `static/images/backgrounds/`

**常用背景类型：**
- `gradient-teal-coral` - 蓝绿到粉橙渐变
- `starry-night` - 星空背景
- `soft-cloud` - 柔和云彩
- `frosted-glass` - 磨砂质感底纹
- `mesh-gradient` - 网格渐变（Apple 风格）

---

### 3. 雪碧图（Sprite Sheet）

**适用场景：** 多个小装饰元素合并为一张图，用 CSS background-position 调用，减少网络请求

**Prompt 模板：**
```
A sprite sheet containing [N] small [类型] icons/decorations,
arranged in a [列数]x[行数] grid, each cell [尺寸]px,
Apple flat design style, [配色],
consistent style across all items, transparent background,
PNG, total size [总宽]x[总高]px

Items included: [列出每个格子的内容]
```

**示例（装饰贴纸雪碧图）：**
```
A sprite sheet of 8 small decorative stickers in a 4x2 grid,
each cell 128x128px, total 512x256px.
Items: star, heart, cloud, flag, diamond, crown, moon, sparkle.
Apple flat design, soft colors matching #4097a9 and #fa9583 palette,
transparent background, PNG
```

**保存路径：** `static/images/sprites/`  
**配套 CSS：**
```css
.sprite-star    { background-position: 0 0; }
.sprite-heart   { background-position: -128px 0; }
.sprite-cloud   { background-position: -256px 0; }
/* 以此类推 */
```

---

### 4. 边框素材（Border / Frame）

**适用场景：** 卡片装饰边框、波浪边框、虚线边框、不规则边框

**Prompt 模板：**
```
A decorative border/frame element for a mobile app card,
[形状描述: wavy/dotted/organic/geometric],
[配色], Apple iOS style, clean and minimal,
transparent background, PNG,
suitable as CSS border-image or overlay
```

**常用类型：**

**波浪边框（顶部/底部）：**
```
A smooth wave divider shape, horizontal orientation,
soft teal color #4097a9, transparent background, PNG,
1024x64px, suitable as a top/bottom card border decoration
```

**装饰边框（四角）：**
```
Four corner decoration elements for a card,
small floral/geometric ornaments, Apple style,
pastel colors, transparent background, PNG,
each corner in a separate quadrant, 256x256px total
```

**保存路径：** `static/images/borders/`

---

### 5. Logo / 应用图标（Logo）

**适用场景：** App 图标、启动页 Logo、导航栏 Logo

**Prompt 模板：**
```
A modern iOS app icon for [产品名/描述],
[象征元素], gradient background from [色A] to [色B],
iOS rounded square style, ultra clean minimal design,
no text, professional and trustworthy,
1024x1024px
```

**DepartureAA 应用图标示例：**
```
A modern iOS app icon for a group travel expense splitting app "DepartureAA",
featuring a minimalist airplane silhouette combined with a simple split-arrow symbol,
gradient background from teal #4097a9 to coral #fa9583,
iOS rounded square format, clean flat design, no text,
1024x1024px, professional and friendly
```

**尺寸要求：**
```
1024x1024 → 原始大图（App Store）
512x512   → 中等（小程序封面）
192x192   → 小图（导航栏/分享）
```

**保存路径：** `static/images/logo/`

---

### 6. 贴纸装饰（Sticker / Decoration）

**适用场景：** 卡片四角装饰、账本封面贴纸、节日主题装饰

**Prompt 模板：**
```
A single cute flat sticker of [内容],
Apple iOS emoji-alternative style but as illustration not emoji,
[配色], transparent background, PNG,
128x128px, rounded and friendly design
```

**项目内置贴纸套件：**
```
sticker-star.png     - 星星
sticker-heart.png    - 爱心
sticker-plane.png    - 飞机（旅行场景）
sticker-food.png     - 食物（聚餐场景）
sticker-house.png    - 房子（合租场景）
sticker-party.png    - 派对（活动场景）
sticker-coin.png     - 硬币（记账主题）
sticker-lock.png     - 锁（私密账标识）
```

**保存路径：** `static/images/stickers/`

---

### 7. 图案纹理（Pattern / Texture）

**适用场景：** 磨砂卡片底纹、噪点叠加纹理、细腻背景增强

**Prompt 模板：**
```
A very subtle seamless tileable [类型] texture/pattern,
extremely minimal, [密度: sparse/medium], 
Apple iOS design aesthetic, [配色],
mostly transparent with very low opacity elements,
PNG with transparency, 512x512px, seamlessly tileable
```

**常用纹理类型：**
```
noise-light.png    - 轻微噪点纹理（增加磨砂感）
dots-pattern.png   - 细点阵纹理
lines-pattern.png  - 细条纹纹理
stars-pattern.png  - 稀疏星星纹理
grid-pattern.png   - 极细网格纹理
```

**保存路径：** `static/images/patterns/`

---

## 完整目录结构

```
static/images/
├── logo/
│   ├── app-icon-1024.png    # 原始图标
│   ├── app-icon-512.png
│   ├── app-icon-192.png
│   └── splash.png           # 启动页
│
├── illustrations/
│   ├── empty-book.png       # 空账本
│   ├── empty-bill.png       # 空账单
│   ├── empty-settle.png     # 已结清
│   ├── onboarding-1.png     # 引导页1
│   ├── onboarding-2.png     # 引导页2
│   └── onboarding-3.png     # 引导页3
│
├── backgrounds/
│   ├── bg-gradient-main.png        # 主背景渐变
│   ├── bg-gradient-card.jpg        # 卡片背景
│   ├── bg-starry.jpg               # 星空背景
│   ├── scene-travel.jpg            # 旅行场景头图
│   ├── scene-dinner.jpg            # 聚餐场景头图
│   └── scene-apartment.jpg         # 合租场景头图
│
├── borders/
│   ├── wave-top.png         # 顶部波浪边框
│   ├── wave-bottom.png      # 底部波浪边框
│   └── corner-deco.png      # 四角装饰
│
├── stickers/
│   ├── sticker-star.png
│   ├── sticker-heart.png
│   ├── sticker-plane.png
│   ├── sticker-food.png
│   ├── sticker-house.png
│   ├── sticker-party.png
│   ├── sticker-coin.png
│   └── sticker-lock.png
│
├── sprites/
│   ├── stickers-sprite.png  # 所有贴纸合并雪碧图
│   └── sprite-map.json      # 雪碧图坐标映射
│
└── patterns/
    ├── noise-light.png
    ├── dots-pattern.png
    ├── stars-pattern.png
    └── grid-pattern.png
```

---

## 调用方式（工具脚本）

通过项目内的 `scripts/generate-asset.js` 执行生成：

```javascript
const { generateAsset, PROMPT_TEMPLATES } = require('./scripts/generate-asset')

// 1. 生成空状态插画
await generateAsset({
  prompt: PROMPT_TEMPLATES.emptyState('an open empty travel suitcase'),
  savePath: 'static/images/illustrations/empty-book.png',
  transparent: true
})

// 2. 生成全屏背景
await generateAsset({
  prompt: PROMPT_TEMPLATES.backgroundPattern('mesh gradient teal to coral'),
  savePath: 'static/images/backgrounds/bg-gradient-main.png',
  size: '1024x1792',
  transparent: false
})

// 3. 生成雪碧图
await generateAsset({
  prompt: `A sprite sheet of 8 small flat decorative stickers in a 4x2 grid,
  each cell 128x128px, total 512x256px.
  Items: star, heart, cloud, flag, diamond, crown, moon, sparkle.
  Apple flat design, #4097a9 and #fa9583 palette, transparent background, PNG`,
  savePath: 'static/images/sprites/stickers-sprite.png',
  size: '1024x1024',
  transparent: true
})

// 4. 生成波浪边框
await generateAsset({
  prompt: `A smooth wave divider shape, horizontal, soft teal #4097a9,
  transparent background, PNG, 1024x128px, for use as card top border decoration`,
  savePath: 'static/images/borders/wave-top.png',
  transparent: true
})
```

**CLI 命令行：**
```bash
# 生成 App Logo
node scripts/gen-asset.js \
  --type appLogo \
  --subject "travel expense splitting app with airplane and arrow" \
  --out static/images/logo/app-icon-1024.png

# 生成场景背景
node scripts/gen-asset.js \
  --type sceneIllustration \
  --subject "people traveling together with luggage in a soft abstract background" \
  --out static/images/backgrounds/scene-travel.jpg \
  --no-transparent
```

---

## 重试机制

```
第1次失败 → 等待 1s → 第2次重试
第2次失败 → 等待 2s → 第3次重试
第3次失败 → 报错，执行降级方案
```

**降级方案（按优先级）：**
1. 简化 prompt 重新生成
2. 改用纯 CSS 实现（渐变、圆角）
3. 使用图标库中的 SVG 替代
4. 临时用品牌色色块占位，并记录待生成

---

## Prompt 风格指南

所有素材 Prompt 都必须包含以下关键词方向，保证风格统一：

```
设计语言:   Apple iOS design language / Apple HIG style / iOS flat design
质感:       soft gradients / clean geometric / minimal / frosted glass aesthetic
配色方向:   teal #4097a9 / coral #fa9583 / deep navy #2f4159 / warm cream #f4dfcc
透明处理:   transparent background / PNG with alpha channel（需要透明时）
避免:       no emoji / no text / no harsh shadows / no overly detailed
```

---

## 使用检查清单

在将生成素材加入项目前，确认以下所有项：

- [ ] 风格对齐 Apple 设计语言（简洁、柔和、干净）
- [ ] 配色在品牌色范围内
- [ ] 需要透明背景的已生成 PNG 透明底
- [ ] 文件命名清晰（使用 kebab-case）
- [ ] 保存到正确的目录分类
- [ ] 文件大小合理（插画 < 300KB，背景 < 500KB）
- [ ] 未使用任何 emoji 作为视觉素材
- [ ] 图标类元素使用了图标库而非生成图片

---

## 素材命名规范

```
格式:  [类型]-[描述]-[尺寸(可选)].扩展名
示例:
  bg-gradient-main.png
  bg-scene-travel-1792x1024.jpg
  illus-empty-book.png
  sticker-star-128.png
  sprite-stickers-512x256.png
  border-wave-top.png
  pattern-dots-512.png
  logo-app-icon-1024.png
```
