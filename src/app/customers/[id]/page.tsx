'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

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
  createdAt: string
  totalAmount: number
  paidAmount: number
  debtAmount: number
  status: string
  note: string | null
  items: OrderItem[]
}

type CustomerData = {
  customer: { id: string; name: string; phone: string | null }
  stats: { totalSpent: number; totalDebt: number; orderCount: number }
  orders: Order[]
}

export default function CustomerDetailPage() {
  const { checkingSession } = useRequireSession()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<CustomerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pay debt state
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payLoading, setPayLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/customers/${id}/orders`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? 'Lỗi tải dữ liệu')
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) void load()
  }, [id])

  async function payDebt(orderId: string, currentPaid: number) {
    const amount = Number(payAmount)
    if (!amount || amount <= 0) return
    setPayLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidAmount: currentPaid + amount }),
      })
      if (!res.ok) {
        const json = await res.json()
        alert(json.error?.message ?? 'Lỗi trả nợ')
        return
      }
      setPayingId(null)
      setPayAmount('')
      void load()
    } catch {
      alert('Lỗi kết nối')
    } finally {
      setPayLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <span className="spinner spinner-dark" /> Đang tải...
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Back */}
      <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: 'var(--primary)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Khách hàng
      </Link>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-24 w-full mt-4" />
        </div>
      ) : error ? (
        <p className="text-sm" style={{ color: 'var(--accent-rose)' }}>{error}</p>
      ) : data ? (
        <>
          {/* Customer Header */}
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{data.customer.name}</h1>
            {data.customer.phone ? (
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>📞 {data.customer.phone}</p>
            ) : null}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="kpi-card kpi-indigo">
              <p className="kpi-label">Tổng đơn</p>
              <p className="kpi-value">{data.stats.orderCount}</p>
            </div>
            <div className="kpi-card kpi-emerald">
              <p className="kpi-label">Tổng mua</p>
              <p className="kpi-value">{data.stats.totalSpent > 0 ? (data.stats.totalSpent / 1000).toFixed(0) + 'k' : '0đ'}</p>
            </div>
            <div className="kpi-card kpi-rose">
              <p className="kpi-label">Còn nợ</p>
              <p className="kpi-value">{data.stats.totalDebt > 0 ? (data.stats.totalDebt / 1000).toFixed(0) + 'k' : '0đ'}</p>
            </div>
          </div>

          {/* Order History */}
          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Lịch sử mua hàng
            </h2>

            {data.orders.length === 0 ? (
              <div className="card p-6 text-center" style={{ color: 'var(--text-muted)' }}>
                <p className="text-sm">Chưa có đơn hàng nào.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.orders.map((o) => (
                  <div key={o.id} className="mobile-card" style={o.status === 'cancelled' ? { opacity: 0.5 } : undefined}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Link href={`/orders/${o.id}`} className="text-xs font-mono font-medium" style={{ color: 'var(--primary)' }}>{o.saleNo}</Link>
                        {o.status === 'cancelled' ? (
                          <span className="badge badge-danger text-[10px]">Đã huỷ</span>
                        ) : null}
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(o.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    {/* Items */}
                    <div className="space-y-1.5 mb-3" style={{ background: 'var(--surface-alt)', borderRadius: '8px', padding: '10px 12px' }}>
                      {o.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.productName}</span>
                            <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>
                              ×{item.qty} · {item.unitPrice.toLocaleString('vi-VN')}đ/sp
                            </span>
                          </div>
                          <span className="text-sm tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                            {item.lineTotal.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                      <div className="text-xs">
                        <span style={{ color: 'var(--text-muted)' }}>Tổng: </span>
                        <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {o.totalAmount.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      {o.debtAmount > 0 ? (
                        payingId === o.id ? (
                          <div className="flex items-center gap-1.5">
                            <input type="number" className="w-24 text-xs" placeholder="Số tiền"
                              value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                              min="1" max={o.debtAmount} />
                            <button className="btn-primary text-xs py-1 px-2.5" disabled={payLoading}
                              onClick={() => void payDebt(o.id, o.paidAmount)} type="button">
                              {payLoading ? '...' : 'OK'}
                            </button>
                            <button className="btn-secondary text-xs py-1 px-2"
                              onClick={() => { setPayingId(null); setPayAmount('') }} type="button">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold tabular-nums" style={{ color: '#e11d48' }}>
                              Nợ {o.debtAmount.toLocaleString('vi-VN')}đ
                            </span>
                            <button className="text-xs py-1 px-2.5 rounded-lg font-medium"
                              style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}
                              onClick={() => { setPayingId(o.id); setPayAmount('') }}
                              type="button">
                              Trả nợ
                            </button>
                          </div>
                        )
                      ) : o.status !== 'cancelled' ? (
                        <span className="badge badge-success text-[10px]">Đã thanh toán</span>
                      ) : null}
                    </div>
                    {o.note ? (
                      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>📝 {o.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}

