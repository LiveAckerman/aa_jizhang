// 验证：删除账本/账单时级联清理 transactions + transaction_logs，不留孤儿（Postgres）
import { randomUUID, createHmac } from 'crypto'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const BASE = `http://localhost:${env.PORT || 9080}/api`
function b(s){return Buffer.from(s).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
function jwt(p){const now=Math.floor(Date.now()/1000);const d=`${b(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${b(JSON.stringify({...p,iat:now,exp:now+3600}))}`;return `${d}.${b(createHmac('sha256',env.JWT_SECRET).update(d).digest())}`}

let pass=0, fail=0
const ok=(n,c,e='')=>{c?(pass++,console.log(`  ✅ ${n}`)):(fail++,console.log(`  ❌ ${n} ${e}`))}
async function api(m,p,t,body){const r=await fetch(`${BASE}${p}`,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:`Bearer ${t}`}:{})},body:body?JSON.stringify(body):undefined});let d=null;try{d=await r.json()}catch{};return{status:r.status,body:d}}

const pgPath = '/Users/lijiwang/Documents/test/aa_jizhang/node_modules/.pnpm/pg@8.23.0/node_modules/pg/lib/index.js'

async function main(){
  const pg = (await import(pgPath)).default
  const c = new pg.Client({ host: env.DB_HOST, port: +env.DB_PORT, user: env.DB_USERNAME, password: env.DB_PASSWORD, database: env.DB_DATABASE })
  await c.connect()
  const count = async (table, col, val) => {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE "${col}" = $1`, [val])
    return r.rows[0].n
  }

  const u1 = randomUUID()
  await c.query(
    `INSERT INTO users(id,openid,nickname,avatar,"isProfileComplete","hasPromptedProfile","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,true,true,NOW(),NOW())`,
    [u1, `cd_${u1.slice(0,8)}`, '级联', ''],
  )
  const tA = jwt({ sub: u1, openid: `cd_${u1.slice(0,8)}` })

  let bookId, txId
  try {
    let r = await api('POST','/books',tA,{name:'级联测试',scene:'travel'})
    bookId = r.body.data.id
    r = await api('POST','/transactions',tA,{bookId,type:'private',amount:1000,category:'food'})
    txId = r.body.data.id
    await api('POST','/transactions',tA,{bookId,type:'private',amount:2000,category:'other'})
    await api('PATCH',`/transactions/${txId}`,tA,{amount:1500}) // 产生 update 日志

    const before = await count('transaction_logs', 'transactionId', txId)
    ok('删除前该账单有日志(create+update)', before >= 2, `count=${before}`)

    await api('DELETE',`/transactions/${txId}`,tA)
    ok('删账单后其日志清空', (await count('transaction_logs','transactionId',txId)) === 0)

    await api('DELETE',`/books/${bookId}`,tA)
    ok('删账本后无孤儿 transactions', (await count('transactions','bookId',bookId)) === 0)
    ok('删账本后无孤儿 transaction_logs', (await count('transaction_logs','bookId',bookId)) === 0)
    ok('删账本后无孤儿 book_members', (await count('book_members','bookId',bookId)) === 0)
    bookId = null
  } finally {
    if (bookId) {
      await c.query('DELETE FROM transaction_logs WHERE "bookId"=$1',[bookId]).catch(()=>{})
      await c.query('DELETE FROM transactions WHERE "bookId"=$1',[bookId]).catch(()=>{})
      await c.query('DELETE FROM book_members WHERE "bookId"=$1',[bookId]).catch(()=>{})
      await c.query('DELETE FROM books WHERE id=$1',[bookId]).catch(()=>{})
    }
    await c.query('DELETE FROM users WHERE id=$1',[u1]).catch(()=>{})
    await c.end()
  }
  console.log(`\n==== 结果: ${pass} 通过 / ${fail} 失败 ====`)
  process.exit(fail>0?1:0)
}
main().catch(e=>{console.error(e); process.exit(1)})
