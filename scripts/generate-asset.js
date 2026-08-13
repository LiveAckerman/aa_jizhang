/**
 * AI Image Generation Utility
 *
 * Rules:
 * - Never use emoji as icons or assets in the project
 * - For icons: use icon libraries (Iconoir, Lucide, SF Symbols)
 * - For custom illustrations/logos/backgrounds: use this utility
 * - Retry up to 3 times on failure
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// ===== 配置信息（从环境变量读取，无 fallback）=====

// 尝试加载 .env 文件
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim()
        process.env[key.trim()] = value
      }
    }
  })
}

const IMAGE_API_CONFIG = {
  baseURL: process.env.IMAGE_API_BASE_URL,
  apiKey: process.env.IMAGE_API_KEY,
  model: process.env.IMAGE_API_MODEL,
  maxRetries: 3,
  retryDelayMs: 1000,
}

const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  endpoint: process.env.R2_ENDPOINT,
  bucketName: process.env.R2_BUCKET_NAME,
  publicURL: process.env.R2_PUBLIC_URL,
}

// 图片大于此大小（KB）自动上传 OSS
const UPLOAD_THRESHOLD_KB = parseInt(process.env.IMAGE_UPLOAD_THRESHOLD) || 200

/**
 * 检查配置是否完整
 */
function checkConfig() {
  const missingImageAPI = []
  const missingR2 = []

  if (!IMAGE_API_CONFIG.baseURL) missingImageAPI.push('IMAGE_API_BASE_URL')
  if (!IMAGE_API_CONFIG.apiKey) missingImageAPI.push('IMAGE_API_KEY')
  if (!IMAGE_API_CONFIG.model) missingImageAPI.push('IMAGE_API_MODEL')

  // R2 上传所需的必填项（R2_PUBLIC_URL 仅用于拼接公开地址，非必填）
  if (!R2_CONFIG.accountId) missingR2.push('R2_ACCOUNT_ID')
  if (!R2_CONFIG.accessKeyId) missingR2.push('R2_ACCESS_KEY_ID')
  if (!R2_CONFIG.secretAccessKey) missingR2.push('R2_SECRET_ACCESS_KEY')
  if (!R2_CONFIG.endpoint) missingR2.push('R2_ENDPOINT')
  if (!R2_CONFIG.bucketName) missingR2.push('R2_BUCKET_NAME')

  return {
    isValid: missingImageAPI.length === 0 && missingR2.length === 0,
    missingImageAPI,
    missingR2,
  }
}

/**
 * 打印配置缺失错误
 */
function printConfigError(configCheck) {
  console.error('\n❌ [generate-asset] 环境变量配置不完整\n')

  if (configCheck.missingImageAPI.length > 0) {
    console.error('缺少图片生成 API 配置：')
    configCheck.missingImageAPI.forEach(key => console.error(`  - ${key}`))
    console.error('')
  }

  if (configCheck.missingR2.length > 0) {
    console.error('缺少 Cloudflare R2 配置：')
    configCheck.missingR2.forEach(key => console.error(`  - ${key}`))
    console.error('')
  }

  console.error('请在项目根目录创建 .env 文件，参考 .env.example 模板填写配置。')
  console.error('示例：')
  console.error('  cp .env.example .env')
  console.error('  # 然后编辑 .env 文件填写实际配置\n')
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Upload file to Cloudflare R2 using AWS S3 API (Signature V4)
 */
async function uploadToR2(localPath, remoteKey) {
  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(localPath)
    const contentType = getContentType(localPath)

    // AWS Signature V4
    const now = new Date()
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')

    const region = 'auto' // Cloudflare R2 使用 'auto'
    const service = 's3'

    const host = new URL(R2_CONFIG.endpoint).hostname
    const canonicalUri = `/${R2_CONFIG.bucketName}/${remoteKey}`

    // Canonical Request
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${amzDate}\n`
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
    const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`

    // String to Sign
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${hashedCanonicalRequest}`

    // Signing Key
    const kDate = crypto.createHmac('sha256', `AWS4${R2_CONFIG.secretAccessKey}`).update(dateStamp).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest()
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()

    // Signature
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

    // Authorization Header
    const authorization = `AWS4-HMAC-SHA256 Credential=${R2_CONFIG.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const url = `${R2_CONFIG.endpoint}/${R2_CONFIG.bucketName}/${remoteKey}`
    const parsedURL = new URL(url)

    const options = {
      hostname: parsedURL.hostname,
      port: 443,
      path: parsedURL.pathname,
      method: 'PUT',
      headers: {
        'Host': host,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
        'Content-Type': contentType,
        'Content-Length': fileContent.length,
        'Authorization': authorization,
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 仅当配置了公开访问地址时才拼接可访问 URL，否则返回 null
          const publicURL = R2_CONFIG.publicURL
            ? `${R2_CONFIG.publicURL}/${remoteKey}`
            : null
          resolve({ remoteKey, publicURL })
        } else {
          reject(new Error(`R2 upload failed: ${res.statusCode} ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.write(fileContent)
    req.end()
  })
}

/**
 * Get content type by file extension
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  }
  return types[ext] || 'application/octet-stream'
}

/**
 * Get file size in KB
 */
function getFileSizeKB(filePath) {
  const stats = fs.statSync(filePath)
  return stats.size / 1024
}

/**
 * Make a POST request (no external dependencies)
 */
function postJSON(url, body, headers) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const parsedURL = new URL(url)
    const isHTTPS = parsedURL.protocol === 'https:'

    // 检查代理设置
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy

    let lib, options

    if (proxy) {
      // 使用代理
      const proxyURL = new URL(proxy)
      lib = http // 代理连接使用 http
      options = {
        hostname: proxyURL.hostname,
        port: proxyURL.port || 80,
        path: url, // 完整 URL 作为 path
        method: 'POST',
        headers: {
          'Host': parsedURL.hostname,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      }
    } else {
      // 直连
      lib = isHTTPS ? https : http
      options = {
        hostname: parsedURL.hostname,
        port: parsedURL.port ? parseInt(parsedURL.port) : (isHTTPS ? 443 : 80),
        path: parsedURL.pathname + (parsedURL.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      }
    }

    const req = lib.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed)
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`))
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`))
        }
      })
    })

    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

/**
 * Download a file from URL to local path
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    const file = fs.createWriteStream(destPath)
    const parsedURL = new URL(url)
    const lib = parsedURL.protocol === 'https:' ? https : http

    lib.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close()
        fs.unlinkSync(destPath)
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject)
      }

      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve(destPath)
      })
    }).on('error', (err) => {
      fs.unlinkSync(destPath)
      reject(err)
    })
  })
}

/**
 * Generate an image using the AI image API.
 *
 * @param {Object} options
 * @param {string} options.prompt       - The image generation prompt
 * @param {string} options.savePath     - Absolute or relative path to save the PNG (e.g. "static/images/empty-states/empty-book.png")
 * @param {'1024x1024'|'1792x1024'|'1024x1792'} [options.size] - Image size (default: 1024x1024)
 * @param {boolean} [options.transparent] - Request transparent background (default: true)
 * @param {boolean} [options.forceLocal] - Force save locally even if file is large (default: false)
 * @returns {Promise<{localPath: string, url?: string, uploaded: boolean}>}
 */
async function generateAsset({ prompt, savePath, size = '1024x1024', transparent = true, forceLocal = false }) {
  if (!prompt) throw new Error('prompt is required')
  if (!savePath) throw new Error('savePath is required')

  // 检查配置
  const configCheck = checkConfig()
  if (!configCheck.isValid) {
    printConfigError(configCheck)
    throw new Error('环境变量配置不完整，无法生成图片。请配置 .env 文件后重试。')
  }

  // Append transparency instruction when requested
  const fullPrompt = transparent
    ? `${prompt}, transparent background, PNG with transparency`
    : prompt

  const endpoint = `${IMAGE_API_CONFIG.baseURL}/v1/images/generations`

  let lastError

  for (let attempt = 1; attempt <= IMAGE_API_CONFIG.maxRetries; attempt++) {
    try {
      console.log(`[generate-asset] Attempt ${attempt}/${IMAGE_API_CONFIG.maxRetries} — generating: ${savePath}`)

      const result = await postJSON(
        endpoint,
        {
          model: IMAGE_API_CONFIG.model,
          prompt: fullPrompt,
          n: 1,
          size,
          response_format: 'b64_json', // 使用 base64 格式，避免 URL 路径问题
        },
        {
          Authorization: `Bearer ${IMAGE_API_CONFIG.apiKey}`,
        }
      )

      const b64Image = result?.data?.[0]?.b64_json
      if (!b64Image) throw new Error('No image data in response: ' + JSON.stringify(result))

      // Resolve savePath relative to cwd if not absolute
      const absoluteSavePath = path.isAbsolute(savePath)
        ? savePath
        : path.resolve(process.cwd(), savePath)

      // 确保目录存在
      fs.mkdirSync(path.dirname(absoluteSavePath), { recursive: true })

      // 保存 base64 图片
      fs.writeFileSync(absoluteSavePath, Buffer.from(b64Image, 'base64'))
      console.log(`[generate-asset] ✅ Downloaded to: ${absoluteSavePath}`)

      // 检查文件大小，决定是否上传 OSS
      const fileSizeKB = getFileSizeKB(absoluteSavePath)
      console.log(`[generate-asset] File size: ${fileSizeKB.toFixed(2)} KB`)

      if (!forceLocal && fileSizeKB > UPLOAD_THRESHOLD_KB) {
        console.log(`[generate-asset] File exceeds ${UPLOAD_THRESHOLD_KB}KB threshold, uploading to R2...`)

        try {
          // 生成 OSS 路径：images/YYYY-MM/filename
          const now = new Date()
          const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
          const filename = path.basename(absoluteSavePath)
          const remoteKey = `images/${yearMonth}/${filename}`

          const uploadResult = await uploadToR2(absoluteSavePath, remoteKey)

          if (uploadResult.publicURL) {
            console.log(`[generate-asset] ✅ Uploaded to R2: ${uploadResult.publicURL}`)
          } else {
            console.log(`[generate-asset] ✅ Uploaded to R2 bucket (key: ${uploadResult.remoteKey})`)
            console.log(`[generate-asset] ℹ️  未配置 R2_PUBLIC_URL，无公开访问地址`)
          }

          // 删除本地文件（可选，保留注释可改为保留本地副本）
          // fs.unlinkSync(absoluteSavePath)
          // console.log(`[generate-asset] 🗑️  Local file deleted (uploaded to R2)`)

          return {
            localPath: absoluteSavePath,
            url: uploadResult.publicURL,
            remoteKey: uploadResult.remoteKey,
            uploaded: true,
          }
        } catch (uploadErr) {
          console.warn(`[generate-asset] ⚠️  R2 upload failed: ${uploadErr.message}`)
          console.warn(`[generate-asset] Falling back to local storage`)
        }
      }

      // 小文件或上传失败时保存本地
      return {
        localPath: absoluteSavePath,
        uploaded: false,
      }

    } catch (err) {
      lastError = err
      console.error(`[generate-asset] ❌ Attempt ${attempt} failed:`, err.message)

      if (attempt < IMAGE_API_CONFIG.maxRetries) {
        const delay = IMAGE_API_CONFIG.retryDelayMs * attempt
        console.log(`[generate-asset] Retrying in ${delay}ms...`)
        await sleep(delay)
      }
    }
  }

  throw new Error(
    `[generate-asset] Image generation failed after ${IMAGE_API_CONFIG.maxRetries} attempts. Last error: ${lastError?.message}`
  )
}

/**
 * Prompt templates aligned with the project's Apple design style.
 * Use these as a base and append your specific details.
 */
const PROMPT_TEMPLATES = {
  /**
   * Empty state illustration
   * @param {string} subject - e.g. "an open empty notebook with coins"
   */
  emptyState: (subject) =>
    `A minimalist flat illustration of ${subject}, Apple iOS design style, ` +
    `clean geometric shapes, soft gradient, pastel blue #4097a9 and coral #fa9583 color palette, ` +
    `simple and friendly, centered composition, white or transparent background`,

  /**
   * App logo / icon
   * @param {string} concept - e.g. "a travel expense sharing app with a suitcase"
   */
  appLogo: (concept) =>
    `A modern iOS app icon for ${concept}, ` +
    `gradient background from teal #5AC8FA to coral #FF9583, ` +
    `rounded square iOS style, 1024x1024, clean minimal geometric design, ` +
    `professional and trustworthy, no text`,

  /**
   * Scene / header illustration
   * @param {string} scene - e.g. "people traveling with luggage"
   */
  sceneIllustration: (scene) =>
    `A flat vector scene illustration of ${scene}, Apple iOS style, ` +
    `soft color palette with blues and warm corals, minimal details, ` +
    `wide landscape format, clean background suitable for a card header`,

  /**
   * Subtle background pattern
   * @param {string} element - e.g. "tiny stars and dots"
   */
  backgroundPattern: (element) =>
    `A very subtle and sparse repeating pattern of ${element}, ` +
    `extremely minimalist, soft pastel colors almost transparent, ` +
    `Apple iOS wallpaper aesthetic, seamless tileable, transparent PNG`,

  /**
   * Custom avatar placeholder
   */
  avatarPlaceholder: () =>
    `A simple flat vector avatar placeholder icon, single silhouette figure, ` +
    `iOS style, soft blue gradient #4097a9, circular composition, ` +
    `clean and minimal, transparent background`,
}

module.exports = { generateAsset, PROMPT_TEMPLATES }
