// 验证前端(add-transaction 页)构造的各分账方式 payload 能被后端正确接受
import mysql from '/Users/lijiwang/Documents/test/aa_jizhang/node_modules/.pnpm/mysql2@3.23.3_@types+node@20.19.43/node_modules/mysql2/promise.js'
import { randomUUID, createHmac } from 'crypto'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const BASE = `http://localhost:${env.PORT || 9080}/api`
function b64url(b){return Buffer.from(b).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
function jwt(payload){const h={alg:'HS256',typ:'JWT'};const now=Math.floor(Date.now()/1000);const body={...payload,iat:now,exp:now+3600};const d=`${b64url(JSON.stringify(h))}.${b64url(JSON.stringify(body))}`;return `${d}.${b64url(createHmac('sha256',env.JWT_SECRET).update(d).digest())}`}

let pass=0, fail=0
const ok=(n,c,e='')=>{c?(pass++,console.log(`  ✅ ${n}`)):(fail++,console.log(`  ❌ ${n} ${e}`))}
async function api(m,p,t,b){const r=await fetch(`${BASE}${p}`,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:`Bearer ${t}`}:{})},body:b?JSON.stringify(b):undefined});let d=null;try{d=await r.json()}catch{};return{status:r.status,body:d}}

// 复刻前端 add-transaction.js 的 splits 构造逻辑
function buildSharedPayload(bookId, ids, amount, splitMethod){
  const payload={bookId,type:'shared',amount,category:'food',note:'',images:[],payerId:ids[0],splitMethod,participantIds:ids}
  if(splitMethod==='ratio'||splitMethod==='shares'){payload.splits=ids.map(u=>({userId:u,amount:0,weight:1}))}
  else if(splitMethod==='fixed'){const n=ids.length||1;const base=Math.floor(amount/n);let rem=amount-base*n;payload.splits=ids.map(u=>{const e=rem>0?1:0;rem-=e;return{userId:u,amount:base+e}})}
  return payload
}

async function main(){
  const conn=await mysql.createConnection({host:env.DB_HOST,port:+env.DB_PORT,user:env.DB_USERNAME,password:env.DB_PASSWORD,database:env.DB_DATABASE})
  const u1=randomUUID(),u2=randomUUID(),u3=randomUUID()
  for(const[id,n]of[[u1,'甲'],[u2,'乙'],[u3,'丙']]){await conn.execute(`INSERT INTO users(id,openid,nickname,avatar,isProfileComplete,hasPromptedProfile,createdAt,updatedAt)VALUES(?,?,?,?,1,1,NOW(),NOW())`,[id,`fc_${id.slice(0,8)}`,n,''])}
  const tA=jwt({sub:u1,openid:`fc_${u1.slice(0,8)}`})
  let bookId
  try{
    let r=await api('POST','/books',tA,{name:'分账测试',scene:'dinner'})
    bookId=r.body?.data?.id
    ok('建账本',!!bookId)
    const code=r.body?.data?.inviteCode
    await api('POST',`/books/join/${code}`,jwt({sub:u2,openid:`fc_${u2.slice(0,8)}`}))
    await api('POST',`/books/join/${code}`,jwt({sub:u3,openid:`fc_${u3.slice(0,8)}`}))
    const ids=[u1,u2,u3]

    // average
    r=await api('POST','/transactions',tA,{bookId,type:'shared',amount:10000,category:'food',splitMethod:'average',participantIds:ids})
    ok('均摊: 3人 100元',r.status===201 && r.body.data.splits.reduce((s,x)=>s+x.amount,0)===10000)

    // ratio
    r=await api('POST','/transactions',tA,buildSharedPayload(bookId,ids,10000,'ratio'))
    ok('按比例(等权重)总和=金额',r.status===201 && r.body.data.splits.reduce((s,x)=>s+x.amount,0)===10000, JSON.stringify(r.body))

    // shares
    r=await api('POST','/transactions',tA,buildSharedPayload(bookId,ids,10000,'shares'))
    ok('按份额(等份)总和=金额',r.status===201 && r.body.data.splits.reduce((s,x)=>s+x.amount,0)===10000, JSON.stringify(r.body))

    // fixed
    r=await api('POST','/transactions',tA,buildSharedPayload(bookId,ids,10000,'fixed'))
    ok('指定金额总和=金额',r.status===201 && r.body.data.splits.reduce((s,x)=>s+x.amount,0)===10000, JSON.stringify(r.body))

    // 带位置+图片(私密)
    r=await api('POST','/transactions',tA,{bookId,type:'private',amount:2500,category:'shopping',note:'纪念品',images:['https://cdn.ljw44.com/a.png','https://cdn.ljw44.com/b.png'],locationName:'南锣鼓巷',locationAddress:'东城区',latitude:39.937,longitude:116.403,spentAt:new Date().toISOString()})
    ok('私密账带位置+多图',r.status===201 && r.body.data.images.length===2 && r.body.data.locationName==='南锣鼓巷')

    // qrcode 路由存在且鉴权通过(微信侧可能失败, 但不应是 401/404)
    const qr=await fetch(`${BASE}/books/${bookId}/qrcode`,{headers:{Authorization:`Bearer ${tA}`}})
    ok('qrcode 路由鉴权通过(非401/404)', qr.status!==401 && qr.status!==404, `status=${qr.status}`)
    const qrNoAuth=await fetch(`${BASE}/books/${bookId}/qrcode`)
    ok('qrcode 未登录被拒(401)', qrNoAuth.status===401, `status=${qrNoAuth.status}`)
  }finally{
    if(bookId){await conn.execute('DELETE FROM transactions WHERE bookId=?',[bookId]).catch(()=>{});await conn.execute('DELETE FROM book_members WHERE bookId=?',[bookId]).catch(()=>{});await conn.execute('DELETE FROM books WHERE id=?',[bookId]).catch(()=>{})}
    for(const id of[u1,u2,u3]){await conn.execute('DELETE FROM book_members WHERE userId=?',[id]).catch(()=>{});await conn.execute('DELETE FROM users WHERE id=?',[id]).catch(()=>{})}
    await conn.end()
  }
  console.log(`\n==== 结果: ${pass} 通过 / ${fail} 失败 ====`)
  process.exit(fail>0?1:0)
}
main().catch(e=>{console.error(e);process.exit(1)})
