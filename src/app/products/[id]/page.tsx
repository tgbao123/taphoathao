'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useRequireSession } from '@/lib/useRequireSession'

type Unit = {
  id: string
  code: string
  name: string
  symbol: string | null
}

type Product = {
  id: string
  name: string
  unit_id: string
  barcode: string | null
  is_active: boolean
  created_at: string
  unit?: Unit | null
}

type ImportItem = {
  id: string
  qty: number
  import_price: number
  note: string | null
  created_at: string
}

type SaleItem = {
  id: string
  qty: number
  unit_price: number
  line_total: number
  created_at: string
}

type ApiError = {
  error?: {
    message?: string
  }
}

export default function ProductDetailsPage() {
  const { checkingSession } = useRequireSession()

  const params = useParams<{ id: string }>()
  const id = params.id

  const [product, setProduct] = useState<Product | null>(null)
  const [imports, setImports] = useState<ImportItem[]>([])
  const [sales, setSales] = useState<SaleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!id) return

      setLoading(true)
      setError(null)

      try {
        const productRes = await fetch(`/api/products/${id}`, { cache: 'no-store' })
        const productJson = (await productRes.json()) as { data?: Product } & ApiError
        if (!productRes.ok || !productJson.data) {
          throw new Error(productJson.error?.message ?? 'Không tải được sản phẩm')
        }
        setProduct(productJson.data)

        // Fetch import and sale history for this product
        const stockRes = await fetch(`/api/stock/${id}`, { cache: 'no-store' })
        if (stockRes.ok) {
          const stockJson = (await stockRes.json()) as { imports?: ImportItem[]; sales?: SaleItem[] }
          setImports(stockJson.imports ?? [])
          setSales(stockJson.sales ?? [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id])

  const totalImported = imports.reduce((sum, i) => sum + i.qty, 0)
  const totalSold = sales.reduce((sum, i) => sum + i.qty, 0)
  const currentStock = totalImported - totalSold

  if (checkingSession) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <span className="spinner spinner-dark" /> Đang kiểm tra phiên đăng nhập...
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div>
        <Link className="inline-flex items-center gap-1 text-sm mb-1 transition-colors" href="/products"
          style={{ color: 'var(--primary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại sản phẩm
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Chi tiết sản phẩm</h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="card p-6"><div className="skeleton h-20 w-full" /></div>
        </div>
      ) : null}
      {error ? <p className="text-sm" style={{ color: 'var(--accent-rose)' }}>{error}</p> : null}

      {!loading && !error && product ? (
        <>
          {/* Info cards */}
          <section className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Thông tin cơ bản</h2>
              <div className="space-y-3">
                <InfoRow label="Tên" value={product.name} />
                <InfoRow label="Đơn vị" value={product.unit?.name ?? '-'} />
                <InfoRow label="Barcode" value={product.barcode ?? '—'} mono />
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Trạng thái</span>
                  {product.is_active ? (
                    <span className="badge badge-success">Active</span>
                  ) : (
                    <span className="badge badge-neutral">Inactive</span>
                  )}
                </div>
                <InfoRow
                  label="Ngày tạo"
                  value={new Date(product.created_at).toLocaleString('vi-VN')}
                />
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Tồn kho</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Tổng nhập</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: '#047857' }}>+{totalImported}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Tổng bán</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: '#e11d48' }}>−{totalSold}</span>
                </div>
                <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Còn lại</span>
                    <span className={`text-lg font-bold tabular-nums ${currentStock <= 0 ? 'text-rose-500' : currentStock <= 10 ? 'text-amber-500' : ''}`}
                      style={currentStock > 10 ? { color: '#047857' } : {}}
                    >
                      {currentStock}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Import history */}
          <section className="card overflow-hidden">
            <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Lịch sử nhập hàng
                <span className="ml-2 badge badge-neutral">{imports.length}</span>
              </h2>
            </div>

            {imports.length === 0 ? (
              <div className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>
                <p className="text-sm">Chưa có lần nhập nào.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>SL nhập</th>
                      <th>Giá nhập</th>
                      <th>Thành tiền</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imports.map((item) => (
                      <tr key={item.id}>
                        <td className="text-xs">{new Date(item.created_at).toLocaleString('vi-VN')}</td>
                        <td className="tabular-nums font-medium" style={{ color: '#047857' }}>+{item.qty}</td>
                        <td className="tabular-nums">{Number(item.import_price).toLocaleString('vi-VN')}đ</td>
                        <td className="tabular-nums font-medium">{(item.qty * Number(item.import_price)).toLocaleString('vi-VN')}đ</td>
                        <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Sales history */}
          <section className="card overflow-hidden">
            <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Lịch sử bán hàng
                <span className="ml-2 badge badge-neutral">{sales.length}</span>
              </h2>
            </div>

            {sales.length === 0 ? (
              <div className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>
                <p className="text-sm">Chưa có lần bán nào.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>SL bán</th>
                      <th>Đơn giá</th>
                      <th>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((item) => (
                      <tr key={item.id}>
                        <td className="text-xs">{new Date(item.created_at).toLocaleString('vi-VN')}</td>
                        <td className="tabular-nums font-medium" style={{ color: '#e11d48' }}>−{item.qty}</td>
                        <td className="tabular-nums">{Number(item.unit_price).toLocaleString('vi-VN')}đ</td>
                        <td className="tabular-nums font-medium">{Number(item.line_total).toLocaleString('vi-VN')}đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span
        className={`text-sm font-medium ${mono ? 'font-mono text-xs' : ''}`}
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  )
}
