import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Loader, MessageBox, Pagination, Table, TableBody, TableCell, TableHead, TableRow, Text, ValueGroup } from '@adminjs/design-system'
import { ApiClient, useTranslation } from 'adminjs'
import type { BasePropertyProps } from 'adminjs'
import type { RelatedBook, RelatedRecordsResponse, RelatedTransaction } from '../related-records.js'

type RelatedData = RelatedRecordsResponse['related']

const money = (amount: number): string =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount / 100)

const recordLink = (resource: string, id: string) =>
  `/admin/resources/${resource}/records/${encodeURIComponent(id)}/show`

const categoryLabel = (category: string): string =>
  ({ food: '餐饮', transport: '交通', hotel: '住宿', shopping: '购物', entertainment: '娱乐', ticket: '门票', other: '其他' })[category] ?? category ?? '其他'

const cellStyle = { textAlign: 'left' as const, verticalAlign: 'top' as const }
const HeaderCell = ({ children }: { children: React.ReactNode }) => (
  <TableCell as="th" scope="col" style={cellStyle}>{children}</TableCell>
)

const BooksTable = ({ records }: { records: RelatedBook[] }) => (
  <Table>
    <TableHead>
      <TableRow>
        <HeaderCell>账本</HeaderCell>
        <HeaderCell>关系</HeaderCell>
        <HeaderCell>角色</HeaderCell>
        <HeaderCell>状态</HeaderCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {records.map((book) => (
        <TableRow key={book.id}>
          <TableCell style={cellStyle}><a href={recordLink('books', book.id)}>{book.name || book.id}</a></TableCell>
          <TableCell style={cellStyle}>{book.relation === 'owner' ? '创建者' : '参与者'}</TableCell>
          <TableCell style={cellStyle}>{book.role === 'owner' ? '管理员' : book.role === 'member' ? '成员' : '—'}</TableCell>
          <TableCell style={cellStyle}>{book.archived ? '已归档' : '进行中'}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
)

const TransactionsTable = ({ records }: { records: RelatedTransaction[] }) => (
  <Table>
    <TableHead>
      <TableRow>
        <HeaderCell>账单</HeaderCell>
        <HeaderCell>类型</HeaderCell>
        <HeaderCell>分类</HeaderCell>
        <HeaderCell>金额</HeaderCell>
        <HeaderCell>消费时间</HeaderCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {records.map((transaction) => (
        <TableRow key={transaction.id}>
          <TableCell style={cellStyle}><a href={recordLink('transactions', transaction.id)}>{transaction.note || transaction.id}</a></TableCell>
          <TableCell style={cellStyle}>{transaction.type === 'private' ? '私密账' : '共享账'}</TableCell>
          <TableCell style={cellStyle}>{categoryLabel(transaction.category)}</TableCell>
          <TableCell style={cellStyle}>{money(transaction.amount)}</TableCell>
          <TableCell style={cellStyle}>{new Date(transaction.spentAt).toLocaleString('zh-CN')}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
)

const RelatedRecordsProperty = ({ property, record, where }: BasePropertyProps) => {
  const { translateProperty } = useTranslation()
  const isBooks = property.path === 'relatedBooks'
  const actionName = isBooks ? 'relatedBooks' : 'relatedTransactions'
  const resourceId = isBooks ? 'users' : 'books'
  const [data, setData] = useState<RelatedData | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const requestVersion = useRef(0)

  const load = useCallback(async (page: number) => {
    if (!record?.id) return
    const version = ++requestVersion.current
    setLoading(true)
    setError(false)
    try {
      const response = await new ApiClient().recordAction({
        resourceId,
        recordId: record.id,
        actionName,
        params: { page },
      })
      if (version === requestVersion.current) setData((response.data as RelatedRecordsResponse).related)
    } catch {
      if (version === requestVersion.current) setError(true)
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [actionName, record?.id, resourceId])

  useEffect(() => {
    void load(1)
    return () => { requestVersion.current += 1 }
  }, [load])

  const content = loading ? <Loader /> : error ? (
    <MessageBox variant="danger">关联数据加载失败，请刷新后重试。</MessageBox>
  ) : !data?.records.length ? (
    <Text color="grey60">{isBooks ? '该用户当前没有参与的账本' : '该账本暂无账单'}</Text>
  ) : (
    <Box style={{ overflowX: 'auto' }}>
      {isBooks ? <BooksTable records={data.records as RelatedBook[]} /> : <TransactionsTable records={data.records as RelatedTransaction[]} />}
      {data.total > data.perPage && (
        <Box mt="lg">
          <Pagination page={data.page} perPage={data.perPage} total={data.total} onChange={load} />
        </Box>
      )}
    </Box>
  )

  return where === 'show' ? (
    <ValueGroup label={translateProperty(property.label, property.resourceId)}>{content}</ValueGroup>
  ) : content
}

export default RelatedRecordsProperty
