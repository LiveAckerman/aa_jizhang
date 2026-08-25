#!/usr/bin/env node
/**
 * 单文件上传到 R2
 * Usage:
 *   node scripts/upload-one.js <local-file-path>              # 默认传到 images/YYYY-MM/
 *   node scripts/upload-one.js <local-file-path> <remote-key> # 指定远程 key(完整路径)
 */

const { uploadToR2 } = require('./generate-asset')
const path = require('path')
const fs = require('fs')

const localPath = process.argv[2]
const customKey = process.argv[3]
if (!localPath || !fs.existsSync(localPath)) {
  console.error('Usage: node scripts/upload-one.js <local-file-path> [remote-key]')
  process.exit(1)
}

const fileName = path.basename(localPath)
const remoteKey = customKey || `images/${new Date().toISOString().slice(0, 7)}/${fileName}`

uploadToR2(localPath, remoteKey)
  .then(result => {
    console.log('✅ Uploaded:', result.publicURL || result.remoteKey)
  })
  .catch(err => {
    console.error('❌ Upload failed:', err.message)
    process.exit(1)
  })
