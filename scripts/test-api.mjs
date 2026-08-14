// 端到端接口测试：直接建测试用户 + 签发 JWT，跑账本/记账全流程
import mysql from '/Users/lijiwang/Documents/test/aa_jizhang/node_modules/.pnpm/mysql2@3.23.3_@types+node@20.19.43/node_modules/mysql2/promise.js'
import { randomUUID, createHmac } from 'crypto'
import { readFileSync } from 'fs'

// 手写 HS256 JWT 签发，避免额外依赖
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function signJwt(payload, secret, expSeconds = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expSeconds }
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`
  const sig = b64url(createHmac('sha256', secret).update(data).digest())
  return `${data}.${sig}`
}
const jwt = { sign: (payload, secret, opts) => signJwt(payload, secret) }

// 读取 .env
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const BASE = `http://localhost:${env.PORT || 9080}/api`
const SECRET = env.JWT_SECRET

let pass = 0
let fail = 0
function ok(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name} ${extra}`)
  }
}

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {}
  return { status: res.status, body: data }
}

async function main() {
  // 1. 建两个测试用户
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  })

  const u1 = randomUUID()
  const u2 = randomUUID()
  for (const [id, nick] of [[u1, '测试用户A'], [u2, '测试用户B']]) {
    await conn.execute(
      `INSERT INTO users (id, openid, nickname, avatar, isProfileComplete, hasPromptedProfile, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, 1, NOW(), NOW())`,
      [id, `test_openid_${id.slice(0, 8)}`, nick, 'https://cdn.ljw44.com/avatar.png'],
    )
  }
  const tokenA = jwt.sign({ sub: u1, openid: `test_openid_${u1.slice(0, 8)}` }, SECRET, { expiresIn: '1h' })
  const tokenB = jwt.sign({ sub: u2, openid: `test_openid_${u2.slice(0, 8)}` }, SECRET, { expiresIn: '1h' })
  console.log(`\n[setup] users A=${u1.slice(0,8)} B=${u2.slice(0,8)}`)

  const cleanupIds = [u1, u2]
  let bookId, txId, inviteCode

  try {
    // ---- 账本 ----
    console.log('\n[books]')
    let r = await api('POST', '/books', tokenA, { name: '北京旅游', scene: 'travel', description: '五一出行' })
    ok('创建账本', r.status === 201 && r.body?.data?.id, JSON.stringify(r.body))
    bookId = r.body?.data?.id
    inviteCode = r.body?.data?.inviteCode
    ok('返回 coverUrl(默认场景封面)', !!r.body?.data?.coverUrl)

    r = await api('GET', '/books', tokenA)
    ok('账本列表含新账本', Array.isArray(r.body?.data) && r.body.data.some((b) => b.id === bookId))
    ok('列表项含 memberCount', r.body?.data?.[0]?.memberCount >= 1)

    r = await api('GET', `/books/${bookId}`, tokenA)
    ok('账本详情含成员', r.body?.data?.members?.length === 1)
    ok('成员含 nickname', r.body?.data?.members?.[0]?.nickname === '测试用户A', JSON.stringify(r.body?.data?.members))

    r = await api('PATCH', `/books/${bookId}`, tokenA, { name: '北京五一游', cover: 'https://cdn.ljw44.com/custom.png' })
    ok('更新账本名称+封面', r.body?.data?.name === '北京五一游' && r.body?.data?.cover?.includes('custom'))

    // 非 owner 不能改
    r = await api('PATCH', `/books/${bookId}`, tokenB, { name: 'hack' })
    ok('非成员/非owner改账本被拒', r.status === 403)

    // ---- 邀请 / 加入 ----
    console.log('\n[invite/join]')
    r = await api('GET', `/books/invite/${inviteCode}`, tokenB)
    ok('邀请码预览账本', r.body?.data?.name === '北京五一游' && r.body?.data?.ownerName === '测试用户A')

    r = await api('POST', `/books/join/${inviteCode}`, tokenB, { displayName: '小B' })
    ok('B 通过邀请码加入', r.status === 201 && r.body?.data?.id === bookId)

    r = await api('POST', `/books/join/${inviteCode}`, tokenB)
    ok('重复加入幂等', r.status === 201)

    r = await api('GET', `/books/${bookId}`, tokenB)
    ok('加入后 B 可见账本(2成员)', r.body?.data?.members?.length === 2)

    // ---- 记账：共享账平均分摊 ----
    console.log('\n[transactions]')
    r = await api('POST', '/transactions', tokenA, {
      bookId, type: 'shared', amount: 20000, category: 'food', note: '午餐',
      splitMethod: 'average', participantIds: [u1, u2],
      images: ['https://cdn.ljw44.com/r1.png'],
      locationName: '全聚德', locationAddress: '前门大街', latitude: 39.9, longitude: 116.4,
    })
    ok('创建共享账(均摊)', r.status === 201 && r.body?.data?.splits?.length === 2, JSON.stringify(r.body))
    txId = r.body?.data?.id
    const splitSum = (r.body?.data?.splits || []).reduce((s, x) => s + x.amount, 0)
    ok('均摊总和=金额', splitSum === 20000)
    ok('位置已保存', r.body?.data?.locationName === '全聚德')

    // 私密账
    r = await api('POST', '/transactions', tokenA, { bookId, type: 'private', amount: 3500, category: 'shopping', note: '冰箱贴' })
    ok('创建私密账', r.status === 201 && r.body?.data?.type === 'private' && r.body?.data?.splits === null)
    const privTxId = r.body?.data?.id

    // B 看流水：看不到 A 的私密账
    r = await api('GET', `/transactions?bookId=${bookId}`, tokenB)
    const bSeesPriv = (r.body?.data || []).some((t) => t.id === privTxId)
    ok('B 看不到 A 的私密账', !bSeesPriv)
    ok('B 能看到共享账', (r.body?.data || []).some((t) => t.id === txId))

    // B 不能查 A 的私密账详情
    r = await api('GET', `/transactions/${privTxId}`, tokenB)
    ok('B 查 A 私密账详情被拒', r.status === 403)

    // summary
    r = await api('GET', `/transactions/summary?bookId=${bookId}`, tokenA)
    ok('A 汇总: sharedTotal=20000', r.body?.data?.sharedTotal === 20000, JSON.stringify(r.body))
    ok('A 汇总: myPrivate=3500', r.body?.data?.myPrivate === 3500)
    ok('A 汇总: myShared=10000', r.body?.data?.myShared === 10000)
    ok('A 汇总: myTotal=13500', r.body?.data?.myTotal === 13500)

    r = await api('GET', `/transactions/summary?bookId=${bookId}`, tokenB)
    ok('B 汇总: myPrivate=0(看不到A私密)', r.body?.data?.myPrivate === 0)
    ok('B 汇总: myShared=10000', r.body?.data?.myShared === 10000)

    // 更新账单：改金额，重算分账
    r = await api('PATCH', `/transactions/${txId}`, tokenA, { amount: 30000 })
    const newSum = (r.body?.data?.splits || []).reduce((s, x) => s + x.amount, 0)
    ok('改金额后重算均摊', newSum === 30000, JSON.stringify(r.body?.data?.splits))

    // 非记录人不能改
    r = await api('PATCH', `/transactions/${txId}`, tokenB, { amount: 1 })
    ok('非记录人改账单被拒', r.status === 403)

    // 固定金额分账校验
    r = await api('POST', '/transactions', tokenA, {
      bookId, type: 'shared', amount: 10000, category: 'other',
      splitMethod: 'fixed', splits: [{ userId: u1, amount: 6000 }, { userId: u2, amount: 3000 }],
    })
    ok('固定金额总和不符被拒(400)', r.status === 400, `status=${r.status}`)

    // ---- 成员管理 ----
    console.log('\n[members]')
    r = await api('POST', `/books/${bookId}/leave`, tokenB)
    ok('B 退出账本', r.body?.data?.left === true)
    r = await api('POST', `/books/${bookId}/leave`, tokenA)
    ok('owner 不能退出(400)', r.status === 400)

    // 删除账单
    r = await api('DELETE', `/transactions/${txId}`, tokenA)
    ok('删除账单', r.body?.data?.deleted === true)

    // 删除账本
    r = await api('DELETE', `/books/${bookId}`, tokenA)
    ok('删除账本', r.body?.data?.deleted === true)
    bookId = null
  } finally {
    // 清理
    if (bookId) {
      await conn.execute('DELETE FROM transactions WHERE bookId = ?', [bookId]).catch(() => {})
      await conn.execute('DELETE FROM book_members WHERE bookId = ?', [bookId]).catch(() => {})
      await conn.execute('DELETE FROM books WHERE id = ?', [bookId]).catch(() => {})
    }
    for (const id of cleanupIds) {
      await conn.execute('DELETE FROM book_members WHERE userId = ?', [id]).catch(() => {})
      await conn.execute('DELETE FROM users WHERE id = ?', [id]).catch(() => {})
    }
    await conn.end()
  }

  console.log(`\n==== 结果: ${pass} 通过 / ${fail} 失败 ====`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('测试异常:', e)
  process.exit(1)
})
