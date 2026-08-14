// 覆盖新增功能：账本分组、复制账本、账单修改日志、货币字段
import mysql from '/Users/lijiwang/Documents/test/aa_jizhang/node_modules/.pnpm/mysql2@3.23.3_@types+node@20.19.43/node_modules/mysql2/promise.js'
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

async function main(){
  const conn=await mysql.createConnection({host:env.DB_HOST,port:+env.DB_PORT,user:env.DB_USERNAME,password:env.DB_PASSWORD,database:env.DB_DATABASE})
  const u1=randomUUID(),u2=randomUUID()
  for(const[id,n]of[[u1,'甲'],[u2,'乙']]){await conn.execute(`INSERT INTO users(id,openid,nickname,avatar,isProfileComplete,hasPromptedProfile,createdAt,updatedAt)VALUES(?,?,?,?,1,1,NOW(),NOW())`,[id,`v2_${id.slice(0,8)}`,n,''])}
  const tA=jwt({sub:u1,openid:`v2_${u1.slice(0,8)}`})
  const tB=jwt({sub:u2,openid:`v2_${u2.slice(0,8)}`})
  const bookIds = []
  const groupIds = []

  try {
    // ==== 账本分组 ====
    console.log('\n[book-groups]')
    let r = await api('GET','/book-groups',tA)
    ok('列出分组自动创建默认', r.status===200 && r.body.data.length===1 && r.body.data[0].isDefault)
    const defaultGroup = r.body.data[0]

    r = await api('POST','/book-groups',tA,{name:'旅行'})
    ok('新建分组', r.status===201 && r.body.data.name==='旅行')
    const groupTravel = r.body.data
    groupIds.push(groupTravel.id)

    r = await api('POST','/book-groups',tA,{name:'家庭'})
    const groupFamily = r.body.data
    groupIds.push(groupFamily.id)

    r = await api('PATCH',`/book-groups/${groupFamily.id}`,tA,{name:'家庭聚会'})
    ok('分组改名', r.body.data.name==='家庭聚会')

    r = await api('PATCH',`/book-groups/${defaultGroup.id}`,tA,{name:'尝试改默认'})
    ok('默认分组不能改名', r.status===400)

    r = await api('DELETE',`/book-groups/${defaultGroup.id}`,tA)
    ok('默认分组不能删除', r.status===400)

    // 建账本 → 归到旅行分组
    r = await api('POST','/books',tA,{name:'东京行',scene:'travel'})
    const book1 = r.body.data
    bookIds.push(book1.id)
    r = await api('PATCH',`/books/${book1.id}/group`,tA,{groupId: groupTravel.id})
    ok('账本归入旅行分组', r.body.data.groupId===groupTravel.id)

    // 再建一个不归组的
    r = await api('POST','/books',tA,{name:'其他账'})
    const book2 = r.body.data
    bookIds.push(book2.id)

    r = await api('GET',`/books?groupId=${groupTravel.id}`,tA)
    ok('按旅行分组筛选(仅1个)', r.body.data.length===1 && r.body.data[0].id===book1.id)

    r = await api('GET','/books?groupId=default',tA)
    ok('按默认分组筛选(1个未归组的)', r.body.data.length===1 && r.body.data[0].id===book2.id)

    r = await api('GET','/books',tA)
    ok('不传 groupId 返回全部', r.body.data.length===2)
    ok('列表项含 myGroupId', r.body.data.find(b=>b.id===book1.id).myGroupId===groupTravel.id)

    // 分组下账本数
    r = await api('GET','/book-groups',tA)
    ok('分组含 bookCount', r.body.data.find(g=>g.id===groupTravel.id).bookCount===1)

    // 删除分组后账本回落
    r = await api('DELETE',`/book-groups/${groupTravel.id}`,tA)
    ok('删除分组', r.body.data.deleted===true)
    r = await api('GET',`/books/${book1.id}`,tA)
    // 现在 book1 在成员视角下应该 groupId 已被清空
    r = await api('GET','/books?groupId=default',tA)
    ok('原分组账本回落到默认', r.body.data.some(b=>b.id===book1.id))

    // ==== 复制账本 ====
    console.log('\n[copy-book]')
    // 让 B 加入 book2，测复制成员
    r = await api('POST',`/books/join/${book2.inviteCode}`,tB)
    ok('B 加入原账本', r.status===201)

    r = await api('POST',`/books/${book2.id}/copy`,tA,{name:'其他账副本',copyMembers:false})
    ok('复制账本(不复制成员)', r.body.data.name==='其他账副本' && r.body.data.memberCount===1)
    bookIds.push(r.body.data.id)

    r = await api('POST',`/books/${book2.id}/copy`,tA,{name:'其他账副本2',copyMembers:true})
    ok('复制账本(复制成员)', r.body.data.memberCount===2, JSON.stringify(r.body))
    bookIds.push(r.body.data.id)

    // ==== 货币字段 ====
    console.log('\n[currency]')
    r = await api('POST','/transactions',tA,{
      bookId: book2.id, type:'private', amount:5000, currency:'USD',
      originalAmount:700, exchangeRate:7.14,
      category:'food',
    })
    ok('创建带货币账单', r.status===201 && r.body.data.currency==='USD' && r.body.data.originalAmount===700, JSON.stringify(r.body))
    const tx1 = r.body.data

    r = await api('GET',`/transactions/${tx1.id}`,tA)
    ok('账单详情返回货币字段', r.body.data.currency==='USD' && Number(r.body.data.exchangeRate)===7.14)

    // ==== 账单修改日志 ====
    console.log('\n[transaction-logs]')
    r = await api('GET',`/transactions/${tx1.id}/logs`,tA)
    ok('创建时有 create 日志', r.body.data.length===1 && r.body.data[0].action==='create')

    r = await api('PATCH',`/transactions/${tx1.id}`,tA,{ amount: 6000, note:'新备注' })
    ok('修改账单', r.status===200)

    r = await api('GET',`/transactions/${tx1.id}/logs`,tA)
    ok('修改后有 2 条日志', r.body.data.length===2)
    const updLog = r.body.data.find(l => l.action==='update')
    ok('修改日志含 changes', updLog && Array.isArray(updLog.changes) && updLog.changes.length>=1, JSON.stringify(updLog))
    const amtChange = updLog.changes.find(c => c.field==='amount')
    ok('金额变更由 50.00→60.00', amtChange && amtChange.oldValue==='50.00' && amtChange.newValue==='60.00', JSON.stringify(amtChange))

    // ==== 汇率 ====
    console.log('\n[exchange-rates]')
    r = await api('GET','/exchange-rates',tA)
    ok('汇率接口返回', r.status===200 && Array.isArray(r.body.data.rates) && r.body.data.rates.length>=1)
    ok('汇率含 CNY 基础', r.body.data.rates.some(x=>x.code==='CNY' && x.rate===1))

  } finally {
    // 清理
    for (const bid of bookIds) {
      await conn.execute('DELETE FROM transaction_logs WHERE bookId=?',[bid]).catch(()=>{})
      await conn.execute('DELETE FROM transactions WHERE bookId=?',[bid]).catch(()=>{})
      await conn.execute('DELETE FROM book_members WHERE bookId=?',[bid]).catch(()=>{})
      await conn.execute('DELETE FROM books WHERE id=?',[bid]).catch(()=>{})
    }
    for (const gid of groupIds) {
      await conn.execute('DELETE FROM book_groups WHERE id=?',[gid]).catch(()=>{})
    }
    for (const id of [u1,u2]) {
      await conn.execute('DELETE FROM book_groups WHERE userId=?',[id]).catch(()=>{})
      await conn.execute('DELETE FROM book_members WHERE userId=?',[id]).catch(()=>{})
      await conn.execute('DELETE FROM users WHERE id=?',[id]).catch(()=>{})
    }
    await conn.end()
  }
  console.log(`\n==== 结果: ${pass} 通过 / ${fail} 失败 ====`)
  process.exit(fail>0?1:0)
}
main().catch(e=>{console.error(e); process.exit(1)})
