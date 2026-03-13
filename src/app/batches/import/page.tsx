'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useRequireSession } from '@/lib/useRequireSession'

type Product = {
  id: string
  sku: string
  name: string
}

type BatchLine = {
  product_id: string
  batch_no: string
  import_price: string
  sell_price: string
  qty_in: string
  imported_at: string
  expires_at: string
}

type ApiError = {
  error?: {
    message?: string
  }
}

function emptyLine(): BatchLine {
  return {
    product_id: '',
    batch_no: '',
    import_price: '0',
    sell_price: '0',
    qty_in: '1',
    imported_at: '',
    expires_at: '',
  }
}

export default function BatchImportPage() {
  const { checkingSession } = useRequireSession()

  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<BatchLine[]>([emptyLine()])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function loadProducts() {
      setLoadingProducts(true)
      setError(null)

      try {
        const res = await fetch('/api/products', { cache: 'no-store' })
        const json = (await res.json()) as { data?: Product[] } & ApiError

        if (!res.ok) {
          throw new Error(json.error?.message ?? 'Không tải được sản phẩm')
        }

        setProducts(json.data ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được sản phẩm')
      } finally {
        setLoadingProducts(false)
      }
    }

    void loadProducts()
  }, [])

  function updateLine(index: number, patch: Partial<BatchLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(index: number) {
    setLines((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

  async function submitImport(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const payload = lines.map((line, index) => {
      const importPrice = Number(line.import_price)
      const sellPrice = Number(line.sell_price)
      const qtyIn = Number(line.qty_in)

      if (!line.product_id) throw new Error(`Dòng ${index + 1}: cần chọn sản phẩm`)
      if (!Number.isFinite(importPrice) || importPrice < 0) {
        throw new Error(`Dòng ${index + 1}: giá nhập phải >= 0`)
      }
      if (!Number.isFinite(sellPrice) || sellPrice < 0) {
        throw new Error(`Dòng ${index + 1}: giá bán phải >= 0`)
      }
      if (!Number.isFinite(qtyIn) || qtyIn <= 0) {
        throw new Error(`Dòng ${index + 1}: số lượng phải > 0`)
      }

      return {
        product_id: line.product_id,
        batch_no: line.batch_no.trim() || undefined,
        import_price: importPrice,
        sell_price: sellPrice,
        qty_in: qtyIn,
        imported_at: line.imported_at || undefined,
        expires_at: line.expires_at || undefined,
      }
    })

    setSubmitting(true)

    try {
      const res = await fetch('/api/batches/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batches: payload }),
      })

      const json = (await res.json()) as { data?: unknown[] } & ApiError

      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Nhập lô thất bại')
      }

      setSuccess(`Nhập thành công ${json.data?.length ?? payload.length} lô hàng.`)
      setLines([emptyLine()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nhập lô thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <span className="spinner spinner-dark" /> Đang kiểm tra phiên đăng nhập...
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Nhập lô hàng</h1>
          <p>Tạo 1 hoặc nhiều lô mới trong một lần nhập.</p>
        </div>
        <Link className="btn-secondary flex items-center gap-2" href="/products">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Sản phẩm
        </Link>
      </div>

      {loadingProducts ? (
        <div className="card p-6"><div className="skeleton h-20 w-full" /></div>
      ) : null}

      {error ? (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(225, 29, 72, 0.08)', color: 'var(--accent-rose)' }}>
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(5, 150, 105, 0.08)', color: '#047857' }}>
          {success}
        </div>
      ) : null}

      {products.length === 0 && !loadingProducts ? (
        <div className="card p-5 text-sm" style={{ borderLeft: '4px solid var(--accent-amber)', color: 'var(--accent-amber)' }}>
          Chưa có sản phẩm. Hãy tạo sản phẩm trước khi nhập lô.
        </div>
      ) : null}

      <form className="card overflow-hidden" onSubmit={submitImport}>
        {/* Desktop Table */}
        <div className="overflow-x-auto desktop-table">
          <table className="styled-table">
            <thead>
              <tr>
                <th>Sản phẩm *</th>
                <th>Mã lô</th>
                <th>Giá nhập *</th>
                <th>Giá bán *</th>
                <th>Số lượng *</th>
                <th>Ngày nhập</th>
                <th>HSD</th>
                <th>#</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index}>
                  <td>
                    <select
                      className="min-w-44"
                      value={line.product_id}
                      onChange={(e) => updateLine(index, { product_id: e.target.value })}
                    >
                      <option value="">Chọn sản phẩm</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={line.batch_no}
                      onChange={(e) => updateLine(index, { batch_no: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="w-24"
                      min="0"
                      step="0.01"
                      type="number"
                      value={line.import_price}
                      onChange={(e) => updateLine(index, { import_price: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="w-24"
                      min="0"
                      step="0.01"
                      type="number"
                      value={line.sell_price}
                      onChange={(e) => updateLine(index, { sell_price: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="w-20"
                      min="0.001"
                      step="0.001"
                      type="number"
                      value={line.qty_in}
                      onChange={(e) => updateLine(index, { qty_in: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="datetime-local"
                      value={line.imported_at}
                      onChange={(e) => updateLine(index, { imported_at: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={line.expires_at}
                      onChange={(e) => updateLine(index, { expires_at: e.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      className="btn-danger text-xs py-1.5 px-2.5"
                      onClick={() => removeLine(index)}
                      type="button"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="mobile-cards flex-col gap-3 p-3">
          {lines.map((line, index) => (
            <div key={index} className="mobile-card space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Dòng {index + 1}</span>
                <button className="btn-secondary text-xs py-1 px-2" style={{ color: '#e11d48' }}
                  onClick={() => removeLine(index)} type="button">✕</button>
              </div>
              <select className="w-full" value={line.product_id}
                onChange={(e) => updateLine(index, { product_id: e.target.value })}>
                <option value="">Chọn sản phẩm *</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
              <input className="w-full" value={line.batch_no} placeholder="Mã lô (tuỳ chọn)"
                onChange={(e) => updateLine(index, { batch_no: e.target.value })} />
              <div className="flex gap-2">
                <label className="flex-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Giá nhập *
                  <input className="w-full mt-1" type="number" min="0" step="0.01" value={line.import_price}
                    onChange={(e) => updateLine(index, { import_price: e.target.value })} />
                </label>
                <label className="flex-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Giá bán *
                  <input className="w-full mt-1" type="number" min="0" step="0.01" value={line.sell_price}
                    onChange={(e) => updateLine(index, { sell_price: e.target.value })} />
                </label>
                <label className="w-20 text-xs" style={{ color: 'var(--text-muted)' }}>
                  SL *
                  <input className="w-full mt-1" type="number" min="0.001" step="0.001" value={line.qty_in}
                    onChange={(e) => updateLine(index, { qty_in: e.target.value })} />
                </label>
              </div>
              <div className="flex gap-2">
                <label className="flex-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Ngày nhập
                  <input className="w-full mt-1" type="datetime-local" value={line.imported_at}
                    onChange={(e) => updateLine(index, { imported_at: e.target.value })} />
                </label>
                <label className="flex-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  HSD
                  <input className="w-full mt-1" type="date" value={line.expires_at}
                    onChange={(e) => updateLine(index, { expires_at: e.target.value })} />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 p-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button className="btn-secondary flex items-center gap-1.5" onClick={addLine} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Thêm dòng
          </button>
          <button
            className="btn-primary flex items-center gap-2"
            disabled={submitting || products.length === 0}
            type="submit"
          >
            {submitting ? (
              <>
                <span className="spinner" />
                Đang nhập...
              </>
            ) : (
              'Xác nhận nhập kho'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
