'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRequireSession } from '@/lib/useRequireSession'

type Product = {
  id: string
  name: string
  quantity: number
  default_sell_price: number
  unit?: { name: string } | null
}

type CashflowItem = {
  id: string
  entryType: 'inflow' | 'outflow'
  category: string
  amount: number
  occurredAt: string
  note: string | null
  debtAmount: number
  customerName: string | null
}

type ApiError = { error?: { message?: string } }

type ImportLine = {
  productId: string
  qty: string
  importPrice: string
}

export default function CashflowPage() {
  const { checkingSession } = useRequireSession()

  const [items, setItems] = useState<CashflowItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Import form (Chi - Nhập hàng)
  const [importLines, setImportLines] = useState<ImportLine[]>([{ productId: '', qty: '', importPrice: '' }])
  const [importNote, setImportNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [cashRes, prodRes, stockRes] = await Promise.all([
        fetch('/api/cashflow', { cache: 'no-store' }),
        fetch('/api/products', { cache: 'no-store' }),
        fetch('/api/stock', { cache: 'no-store' }),
      ])
      const cashJson = (await cashRes.json()) as { data?: CashflowItem[] } & ApiError
      const prodJson = (await prodRes.json()) as { data?: Product[] } & ApiError
      const stockJson = (await stockRes.json()) as { data?: Record<string, number> }
      if (!cashRes.ok) throw new Error(cashJson.error?.message ?? 'Không tải được dữ liệu')
      setItems(cashJson.data ?? [])
      setProducts(prodJson.data ?? [])
      setStockMap(stockJson.data ?? {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchData() }, [])

  const importTotal = useMemo(() => {
    return importLines.reduce((sum, line) => {
      const qty = Number(line.qty)
      const price = Number(line.importPrice)
      if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum
      return sum + qty * price
    }, 0)
  }, [importLines])

  function addImportLine() {
    setImportLines((prev) => [...prev, { productId: '', qty: '', importPrice: '' }])
  }

  function updateImportLine(index: number, patch: Partial<ImportLine>) {
    setImportLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function removeImportLine(index: number) {
    setImportLines((prev) => prev.filter((_, i) => i !== index))
  }

  async function onSubmitImport(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(null)

    const validLines = importLines.filter((l) => l.productId && Number(l.qty) > 0)
    if (validLines.length === 0) {
      setSubmitError('Cần chọn ít nhất 1 sản phẩm và nhập số lượng')
      return
    }

    setSubmitting(true)

    try {
      // Save import records (stock is calculated from these)
      await fetch('/api/import-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validLines.map((l) => ({
            product_id: l.productId,
            qty: Number(l.qty),
            import_price: Number(l.importPrice || 0),
            note: importNote.trim() || null,
          })),
        }),
      })

      // Record cashflow entry
      const totalCost = validLines.reduce((sum, l) => sum + Number(l.qty) * Number(l.importPrice || 0), 0)
      const productNames = validLines.map((l) => {
        const p = products.find((pr) => pr.id === l.productId)
        return `${p?.name ?? '?'} x${l.qty}`
      }).join(', ')

      if (totalCost > 0) {
        await fetch('/api/cashflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryType: 'outflow',
            category: 'Nhập hàng',
            amount: totalCost,
            note: importNote.trim() || productNames,
          }),
        })
      }

      setSubmitSuccess(`Đã nhập hàng: ${productNames}`)
      setImportLines([{ productId: '', qty: '', importPrice: '' }])
      setImportNote('')
      void fetchData()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Lỗi khi nhập hàng')
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
    <div className="space-y-5 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Nhập hàng & Thu chi</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Nhập hàng vào kho (chi tiền) và xem lịch sử giao dịch.
        </p>
      </div>

      {/* Import form */}
      <section className="card p-5">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 3v12M8 11l4 4 4-4" />
            <path d="M20 21H4" />
          </svg>
          Nhập hàng vào kho
        </h2>

        <form onSubmit={onSubmitImport}>
          <div className="space-y-3">
            {importLines.map((line, index) => (
              <div key={index} className="grid gap-3 items-end" style={{ gridTemplateColumns: '1fr 100px 120px 40px' }}>
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {index === 0 ? 'Sản phẩm *' : ''}
                  <select
                    className={index === 0 ? 'mt-1.5 w-full' : 'w-full'}
                    value={line.productId}
                    onChange={(e) => {
                      const product = products.find((p) => p.id === e.target.value)
                      updateImportLine(index, {
                        productId: e.target.value,
                        importPrice: product ? String(product.default_sell_price) : '',
                      })
                    }}
                  >
                    <option value="">Chọn SP...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (kho: {stockMap[p.id] ?? 0})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {index === 0 ? 'SL' : ''}
                  <input
                    className={index === 0 ? 'mt-1.5 w-full' : 'w-full'}
                    type="number"
                    min="1"
                    placeholder="0"
                    value={line.qty}
                    onChange={(e) => updateImportLine(index, { qty: e.target.value })}
                  />
                </label>
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {index === 0 ? 'Giá nhập (đ)' : ''}
                  <input
                    className={index === 0 ? 'mt-1.5 w-full' : 'w-full'}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={line.importPrice}
                    onChange={(e) => updateImportLine(index, { importPrice: e.target.value })}
                  />
                </label>
                <div>
                  {importLines.length > 1 ? (
                    <button
                      type="button"
                      className="w-8 h-8 flex items-center justify-center rounded-md text-sm"
                      style={{ color: '#e11d48', border: '1px solid rgba(225,29,72,0.2)' }}
                      onClick={() => removeImportLine(index)}
                    >
                      ✕
                    </button>
                  ) : <div className="w-8" />}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-3 text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--primary)', border: '1px dashed var(--primary-light)' }}
            onClick={addImportLine}
          >
            + Thêm sản phẩm
          </button>

          <div className="mt-4 grid gap-3 md:grid-cols-2 items-end">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Ghi chú
              <input
                className="mt-1.5 w-full"
                placeholder="VD: Nhập hàng từ NPP ABC"
                value={importNote}
                onChange={(e) => setImportNote(e.target.value)}
              />
            </label>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Tổng chi: <span className="text-base font-bold tabular-nums" style={{ color: '#e11d48' }}>
                  {importTotal.toLocaleString('vi-VN')}đ
                </span>
              </p>
              <button className="btn-primary flex items-center gap-2" disabled={submitting} type="submit">
                {submitting ? (
                  <><span className="spinner" /> Đang nhập...</>
                ) : (
                  'Xác nhận nhập hàng'
                )}
              </button>
            </div>
          </div>

          {submitError ? (
            <div className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(225,29,72,0.08)', color: 'var(--accent-rose)' }}>
              {submitError}
            </div>
          ) : null}
          {submitSuccess ? (
            <div className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(5,150,105,0.08)', color: '#047857' }}>
              {submitSuccess}
            </div>
          ) : null}
        </form>
      </section>

      {/* Transaction history */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Lịch sử giao dịch
            {!loading && <span className="ml-2 badge badge-neutral">{items.length}</span>}
          </h2>
          <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => void fetchData()} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

        {!loading && !error && items.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-40">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
            <p className="text-sm">Chưa có giao dịch nào.</p>
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Loại</th>
                  <th>Danh mục</th>
                  <th>Số tiền</th>
                  <th>Nợ</th>
                  <th>Người nợ</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="text-xs">{new Date(item.occurredAt).toLocaleString('vi-VN')}</td>
                    <td>
                      {item.entryType === 'inflow' ? (
                        <span className="badge badge-success">↓ Thu</span>
                      ) : (
                        <span className="badge badge-danger">↑ Chi</span>
                      )}
                    </td>
                    <td>{item.category}</td>
                    <td className="font-medium tabular-nums">{Number(item.amount).toLocaleString('vi-VN')}đ</td>
                    <td className="font-medium tabular-nums text-sm" style={{ color: item.debtAmount > 0 ? '#e11d48' : 'var(--text-muted)' }}>
                      {item.debtAmount > 0 ? item.debtAmount.toLocaleString('vi-VN') + 'đ' : '—'}
                    </td>
                    <td className="text-sm" style={{ color: item.customerName ? '#6366f1' : 'var(--text-muted)' }}>
                      {item.customerName ?? '—'}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
