#!/usr/bin/env node
/**
 * 单文件上传到 R2
 * Usage: node scripts/upload-one.js <local-file-path>
 */

const { uploadToR2 } = require('./generate-asset')
const path = require('path')
const fs = require('fs')

const localPath = process.argv[2]
if (!localPath || !fs.existsSync(localPath)) {
  console.error('Usage: node scripts/upload-one.js <local-file-path>')
  process.exit(1)
}

const fileName = path.basename(localPath)
const remoteKey = `images/${new Date().toISOString().slice(0, 7)}/${fileName}`

uploadToR2(localPath, remoteKey)
  .then(result => {
    console.log('✅ Uploaded:', result.publicURL || result.remoteKey)
  })
  .catch(err => {
    console.error('❌ Upload failed:', err.message)
    process.exit(1)
  })
