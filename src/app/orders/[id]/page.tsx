'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useRequireSession } from '@/lib/useRequireSession'

type OrderItem = { id: string; productName: string; qty: number; unitPrice: number; lineTotal: number }
type OrderDetail = {
  id: string; saleNo: string; createdAt: string
  subtotal: number; totalAmount: number; paidAmount: number; debtAmount: number
  status: string; note: string | null
  customer: { id: string; name: string; phone: string | null } | null
  items: OrderItem[]
}

const statusMap: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Hoàn thành', cls: 'badge-success' },
  cancelled: { label: 'Đã huỷ', cls: 'badge-danger' },
  draft: { label: 'Nháp', cls: 'badge-neutral' },
  refunded: { label: 'Hoàn tiền', cls: 'badge-warning' },
}

export default function OrderDetailPage() {
  const { checkingSession } = useRequireSession()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error?.message ?? 'Lỗi tải dữ liệu')
        setData(json.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
      } finally {
        setLoading(false)
      }
    }
    if (id) void load()
  }, [id])

  if (checkingSession) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <span className="spinner spinner-dark" /> Đang tải...
      </div>
    )
  }

  const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ'

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Back */}
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: 'var(--primary)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Đơn hàng
      </Link>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-32 w-full mt-4" />
        </div>
      ) : error ? (
        <p className="text-sm" style={{ color: 'var(--accent-rose)' }}>{error}</p>
      ) : data ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{data.saleNo}</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {new Date(data.createdAt).toLocaleString('vi-VN')}
              </p>
            </div>
            <span className={`badge ${statusMap[data.status]?.cls ?? 'badge-neutral'}`}>
              {statusMap[data.status]?.label ?? data.status}
            </span>
          </div>

          {/* Customer */}
          {data.customer ? (
            <div className="mobile-card">
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Khách hàng</p>
              <Link href={`/customers/${data.customer.id}`} className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                {data.customer.name}
              </Link>
              {data.customer.phone ? (
                <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>📞 {data.customer.phone}</span>
              ) : null}
            </div>
          ) : null}

          {/* Items */}
          <div className="mobile-card">
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Sản phẩm ({data.items.length})</p>
            <div className="space-y-2">
              {data.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between"
                  style={{ padding: '8px 12px', background: 'var(--surface-alt)', borderRadius: '8px' }}>
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.productName}</span>
                    <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>
                      ×{item.qty} · {fmt(item.unitPrice)}/sp
                    </span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {fmt(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="mobile-card">
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Thanh toán</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Tạm tính</span>
                <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmt(data.subtotal)}</span>
              </div>
              <div className="flex justify-between pt-2 font-semibold" style={{ borderTop: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-primary)' }}>Tổng cộng</span>
                <span className="tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmt(data.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Đã trả</span>
                <span className="tabular-nums" style={{ color: '#059669' }}>{fmt(data.paidAmount)}</span>
              </div>
              {data.debtAmount > 0 ? (
                <div className="flex justify-between font-semibold">
                  <span style={{ color: '#e11d48' }}>Còn nợ</span>
                  <span className="tabular-nums" style={{ color: '#e11d48' }}>{fmt(data.debtAmount)}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Note */}
          {data.note ? (
            <div className="mobile-card">
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Ghi chú</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{data.note}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
