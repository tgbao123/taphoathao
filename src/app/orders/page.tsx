'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

import { useRequireSession } from '@/lib/useRequireSession'

type OrderItem = {
  id: string
  productName: string
  qty: number
  unitPrice: number
  lineTotal: number
}

type Order = {
  id: string
  saleNo: string
  soldAt: string
  totalAmount: number
  paidAmount: number
  debtAmount: number
  status: string
  note: string | null
  customer: { id: string; name: string; phone: string | null } | null
  items: OrderItem[]
}

type Customer = {
  id: string
  name: string
  phone: string | null
}

export default function OrdersPage() {
  const { checkingSession } = useRequireSession()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editPaid, setEditPaid] = useState('')
  const [editCustomer, setEditCustomer] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<{ id: string; saleNo: string } | null>(null)

  // Detail expand
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [ordRes, custRes] = await Promise.all([
        fetch('/api/orders', { cache: 'no-store' }),
        fetch('/api/customers', { cache: 'no-store' }),
      ])
      const ordJson = (await ordRes.json()) as { data?: Order[] }
      const custJson = (await custRes.json()) as { data?: Customer[] }
      setOrders(ordJson.data ?? [])
      setCustomers(custJson.data ?? [])
    } catch {
      setError('Không tải được danh sách đơn hàng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchData() }, [])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return orders
    return orders.filter((o) =>
      o.saleNo.toLowerCase().includes(kw) ||
      o.customer?.name.toLowerCase().includes(kw) ||
      o.note?.toLowerCase().includes(kw)
    )
  }, [orders, search])

  function startEdit(o: Order) {
    setEditId(o.id)
    setEditPaid(String(o.paidAmount))
    setEditCustomer(o.customer?.id ?? '')
    setEditNote(o.note ?? '')
  }

  async function saveEdit() {
    if (!editId) return
    setEditLoading(true)
    try {
      const res = await fetch(`/api/orders/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paidAmount: Number(editPaid || 0),
          customerId: editCustomer || null,
          note: editNote || null,
        }),
      })
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } }
        throw new Error(j.error?.message ?? 'Lỗi cập nhật')
      }
      setEditId(null)
      void fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi cập nhật')
    } finally {
      setEditLoading(false)
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    try {
      const res = await fetch(`/api/orders/${cancelTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } }
        throw new Error(j.error?.message ?? 'Lỗi huỷ đơn')
      }
      setCancelTarget(null)
      void fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Lỗi huỷ đơn')
    }
  }

  const statusLabel = (s: string) => {
    if (s === 'completed') return <span className="badge badge-success">Hoàn thành</span>
    if (s === 'cancelled') return <span className="badge badge-danger">Đã huỷ</span>
    if (s === 'draft') return <span className="badge badge-neutral">Nháp</span>
    return <span className="badge badge-neutral">{s}</span>
  }

  if (checkingSession) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <span className="spinner spinner-dark" /> Đang kiểm tra phiên đăng nhập...
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Đơn hàng</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Xem, sửa thông tin thanh toán hoặc huỷ đơn hàng.
        </p>
      </div>

      <section className="card overflow-hidden">
        <div className="p-4 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <input className="flex-1" placeholder="Tìm mã đơn, khách hàng..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => void fetchData()} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            Tải lại
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        ) : null}
        {error ? <p className="p-4 text-sm" style={{ color: 'var(--accent-rose)' }}>{error}</p> : null}

        {!loading && !error && filtered.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            <p className="text-sm">Chưa có đơn hàng nào.</p>
          </div>
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Sản phẩm</th>
                  <th>Thời gian</th>
                  <th>Khách hàng</th>
                  <th>Tổng tiền</th>
                  <th>Đã trả</th>
                  <th>Nợ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const isEditing = editId === o.id
                  const isExpanded = expandedId === o.id
                  return (
                    <tr key={o.id} style={o.status === 'cancelled' ? { opacity: 0.5 } : undefined}>
                      <td className="text-xs font-mono" style={{ color: 'var(--primary)' }}>
                        {o.saleNo}
                        {o.note ? <p className="mt-1 font-sans" style={{ color: 'var(--text-muted)' }}>Ghi chú: {o.note}</p> : null}
                      </td>
                      <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {o.items.map((item, idx) => (
                          <span key={item.id}>
                            {item.productName} ×{item.qty}
                            {idx < o.items.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </td>
                      <td className="text-xs">{new Date(o.soldAt).toLocaleString('vi-VN')}</td>
                      <td className="text-sm">
                        {isEditing ? (
                          <select className="w-full text-xs" value={editCustomer}
                            onChange={(e) => setEditCustomer(e.target.value)}>
                            <option value="">Khách lẻ</option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        ) : (o.customer?.name ?? <span style={{ color: 'var(--text-muted)' }}>Khách lẻ</span>)}
                      </td>
                      <td className="font-medium tabular-nums">{o.totalAmount.toLocaleString('vi-VN')}đ</td>
                      <td className="tabular-nums">
                        {isEditing ? (
                          <input className="w-20 text-xs" type="number" min="0" value={editPaid}
                            onChange={(e) => setEditPaid(e.target.value)} />
                        ) : (
                          <span className="font-medium">{o.paidAmount.toLocaleString('vi-VN')}đ</span>
                        )}
                      </td>
                      <td className="font-medium tabular-nums" style={{ color: o.debtAmount > 0 ? '#e11d48' : '#047857' }}>
                        {o.debtAmount > 0 ? o.debtAmount.toLocaleString('vi-VN') + 'đ' : '0đ'}
                      </td>
                      <td>{statusLabel(o.status)}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {o.status !== 'cancelled' ? (
                            isEditing ? (
                              <>
                                <button className="btn-primary text-xs py-1 px-2.5" disabled={editLoading}
                                  onClick={() => void saveEdit()} type="button">Lưu</button>
                                <button className="btn-secondary text-xs py-1 px-2.5"
                                  onClick={() => setEditId(null)} type="button">Huỷ</button>
                              </>
                            ) : (
                              <>
                                <button className="btn-secondary text-xs py-1 px-2.5"
                                  onClick={() => startEdit(o)} type="button">Sửa</button>
                                <button className="text-xs py-1 px-2.5 rounded-lg font-medium"
                                  style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}
                                  onClick={() => setCancelTarget({ id: o.id, saleNo: o.saleNo })} type="button">Huỷ đơn</button>
                              </>
                            )
                          ) : null}
                          <button className="text-xs py-1 px-2.5 rounded-lg font-medium"
                            style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1' }}
                            onClick={() => {
                              localStorage.setItem('prefill_cart', JSON.stringify(o.items.map((i) => ({
                                productName: i.productName, qty: i.qty, unitPrice: i.unitPrice,
                              }))))
                              if (o.customer) localStorage.setItem('prefill_customer', o.customer.id)
                              router.push('/sales')
                            }} type="button">Tạo lại</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* Cancel modal */}
      {cancelTarget ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="card p-6 max-w-sm w-full space-y-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Xác nhận huỷ đơn</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Bạn có chắc muốn huỷ đơn <strong>{cancelTarget.saleNo}</strong>? Cashflow liên quan sẽ bị xoá.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button className="btn-secondary text-sm py-2 px-4" onClick={() => setCancelTarget(null)} type="button">Không</button>
              <button className="text-sm py-2 px-4 rounded-lg font-medium"
                style={{ background: '#e11d48', color: '#fff' }}
                onClick={() => void confirmCancel()} type="button">Huỷ đơn</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  )
}
