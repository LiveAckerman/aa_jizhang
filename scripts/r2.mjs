// R2 工具：list / copy / delete。用法：
//   node scripts/r2.mjs list [prefix]
//   node scripts/r2.mjs copy <srcKey> <destKey>
//   node scripts/r2.mjs delete <key>
import { readFileSync } from 'fs'
import { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '/Users/lijiwang/Documents/test/aa_jizhang/node_modules/.pnpm/@aws-sdk+client-s3@3.1109.0/node_modules/@aws-sdk/client-s3/dist-cjs/index.js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)

const BUCKET = env.R2_BUCKET_NAME
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})

const [, , cmd, a, b] = process.argv

async function list(prefix = '') {
  let token
  const keys = []
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }))
    ;(r.Contents || []).forEach((o) => keys.push({ key: o.Key, size: o.Size }))
    token = r.IsTruncated ? r.NextContinuationToken : undefined
  } while (token)
  return keys
}

async function main() {
  if (cmd === 'list') {
    const keys = await list(a || '')
    keys.forEach((k) => console.log(`${String(k.size).padStart(8)}  ${k.key}`))
    console.log(`\n共 ${keys.length} 个对象`)
  } else if (cmd === 'copy') {
    await s3.send(new CopyObjectCommand({ Bucket: BUCKET, CopySource: `/${BUCKET}/${encodeURIComponent(a).replace(/%2F/g, '/')}`, Key: b }))
    console.log(`copied ${a} -> ${b}`)
  } else if (cmd === 'delete') {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: a }))
    console.log(`deleted ${a}`)
  } else if (cmd === 'head') {
    try { const r = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: a })); console.log('exists', r.ContentType, r.ContentLength) }
    catch (e) { console.log('missing', e.name) }
  } else {
    console.log('usage: list [prefix] | copy <src> <dest> | delete <key> | head <key>')
  }
}
main().catch((e) => { console.error(e.message); process.exit(1) })
