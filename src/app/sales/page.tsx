'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRequireSession } from '@/lib/useRequireSession'

type Product = {
  id: string
  name: string
  default_sell_price: number
  unit?: { name: string; code: string } | null
}

type Customer = {
  id: string
  name: string
  phone: string | null
}

type ApiError = {
  error?: {
    message?: string
  }
}

type CartItem = {
  productId: string
  name: string
  unitName: string
  qty: string
  unitPrice: string
}

export default function SalesPage() {
  const { checkingSession } = useRequireSession()

  const [products, setProducts] = useState<Product[]>([])
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [isDebt, setIsDebt] = useState(false)
  const [paidAmount, setPaidAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [cart, setCart] = useState<CartItem[]>([])
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [prodRes, stockRes, custRes] = await Promise.all([
        fetch('/api/products', { cache: 'no-store' }),
        fetch('/api/stock', { cache: 'no-store' }),
        fetch('/api/customers', { cache: 'no-store' }),
      ])
      const prodJson = (await prodRes.json()) as { data?: Product[] } & ApiError
      const stockJson = (await stockRes.json()) as { data?: Record<string, number> }
      if (!prodRes.ok) throw new Error(prodJson.error?.message ?? 'Không tải được sản phẩm')
      setProducts(prodJson.data ?? [])
      setStockMap(stockJson.data ?? {})
      const custJson = (await custRes.json()) as { data?: Customer[] }
      setCustomers(custJson.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được sản phẩm')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  // Prefill cart from orders page (Tạo lại)
  useEffect(() => {
    if (loading || products.length === 0) return
    const raw = localStorage.getItem('prefill_cart')
    if (!raw) return
    localStorage.removeItem('prefill_cart')
    try {
      const prefill = JSON.parse(raw) as Array<{ productName: string; qty: number; unitPrice: number }>
      const cartItems: CartItem[] = []
      for (const p of prefill) {
        const match = products.find((pr) => pr.name === p.productName)
        cartItems.push({
          productId: match?.id ?? '',
          name: p.productName,
          unitName: match?.unit?.name ?? '',
          qty: String(p.qty),
          unitPrice: String(p.unitPrice),
        })
      }
      if (cartItems.length > 0) setCart(cartItems)
    } catch { /* ignore */ }

    const custId = localStorage.getItem('prefill_customer')
    if (custId) {
      localStorage.removeItem('prefill_customer')
      setSelectedCustomerId(custId)
      setIsDebt(true)
    }
  }, [loading, products])

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, search])

  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const qty = Number(item.qty)
      const unitPrice = Number(item.unitPrice)
      if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) return sum
      return sum + qty * unitPrice
    }, 0)
  }, [cart])

  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0)
  }, [cart])

  function addToCart(product: Product) {
    setSubmitError(null)
    setSubmitSuccess(null)

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, qty: String(Number(item.qty || '0') + 1) }
            : item
        )
      }

      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitName: product.unit?.name ?? '',
          qty: '1',
          unitPrice: String(product.default_sell_price ?? 0),
        },
      ]
    })
  }

  function updateCartItem(productId: string, patch: Partial<CartItem>) {
    setCart((prev) => prev.map((item) => (item.productId === productId ? { ...item, ...patch } : item)))
  }

  function removeCartItem(productId: string) {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }

  function decrementCart(productId: string) {
    setCart((prev) => {
      const item = prev.find((i) => i.productId === productId)
      if (!item) return prev
      const newQty = Number(item.qty || '0') - 1
      if (newQty <= 0) return prev.filter((i) => i.productId !== productId)
      return prev.map((i) => (i.productId === productId ? { ...i, qty: String(newQty) } : i))
    })
  }

  async function onSubmitSale(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(null)

    if (cart.length === 0) {
      setSubmitError('Giỏ hàng đang trống')
      return
    }

    const items = cart.map((item, index) => {
      const qty = Number(item.qty)
      const unitPrice = Number(item.unitPrice)

      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error(`Dòng ${index + 1}: số lượng phải > 0`)
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error(`Dòng ${index + 1}: đơn giá phải >= 0`)
      }

      return {
        skuId: item.productId,
        qty,
        unitPrice,
        allocationMode: 'AUTO_FIFO',
      }
    })

    setSubmitLoading(true)

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          customerId: selectedCustomerId || undefined,
          paidAmount: isDebt ? Number(paidAmount || 0) : undefined,
        }),
      })

      const json = (await res.json()) as { saleId?: string; error?: { message?: string } }
      if (!res.ok) throw new Error(json.error?.message ?? 'Không tạo được đơn bán')

      setSubmitSuccess('Đã tạo đơn bán thành công!')
      setCart([])
      setSelectedCustomerId('')
      setIsDebt(false)
      setPaidAmount('')
      void loadData()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Không tạo được đơn bán')
    } finally {
      setSubmitLoading(false)
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Bán hàng</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Chọn sản phẩm, điều chỉnh số lượng và xác nhận thanh toán.
        </p>
      </div>

      {/* POS grid */}
      <section className="grid gap-5 lg:grid-cols-5">
        {/* Product list — 3 cols */}
        <div className="card overflow-hidden lg:col-span-3">
          <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex-1 relative">
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="w-full pl-9"
                placeholder="Tìm sản phẩm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span className="badge badge-neutral text-xs">{filteredProducts.length} SP</span>
          </div>

          <div className="p-3 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-2">
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-16 w-3/4" />
              </div>
            ) : null}
            {error ? <p className="p-3 text-sm" style={{ color: 'var(--accent-rose)' }}>{error}</p> : null}
            {!loading && !error && filteredProducts.length === 0 ? (
              <p className="p-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                {search ? 'Không tìm thấy sản phẩm phù hợp.' : 'Chưa có sản phẩm để bán.'}
              </p>
            ) : null}

            {!loading && !error && filteredProducts.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {filteredProducts.map((product) => {
                  const inCart = cart.find((c) => c.productId === product.id)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-3 py-2.5 transition-all duration-150 w-full"
                      style={{
                        border: inCart ? '1.5px solid var(--primary-light)' : '1px solid var(--border-light)',
                        background: inCart ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                      }}
                      onClick={() => addToCart(product)}
                    >
                      {/* Row 1: Name + Price + Unit */}
                      <p className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                        {product.name}
                      </p>
                      <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--primary)' }}>
                        {Number(product.default_sell_price).toLocaleString('vi-VN')}đ
                      </span>
                      {product.unit?.name ? (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          / {product.unit.name}
                        </span>
                      ) : null}

                      {/* Row 2: Stock + Cart controls (push to right) */}
                      <span className="ml-auto" />
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0"
                        style={{
                          background: (stockMap[product.id] ?? 0) <= 0
                            ? 'rgba(225,29,72,0.08)' : (stockMap[product.id] ?? 0) <= 10
                            ? 'rgba(245,158,11,0.08)' : 'rgba(5,150,105,0.08)',
                          color: (stockMap[product.id] ?? 0) <= 0
                            ? '#e11d48' : (stockMap[product.id] ?? 0) <= 10
                            ? '#d97706' : '#047857',
                        }}
                      >
                        Kho: {stockMap[product.id] ?? 0}
                      </span>
                      {inCart ? (
                        <div
                          className="flex items-center gap-0.5 rounded-full px-1 flex-shrink-0"
                          style={{ background: 'var(--primary)', boxShadow: '0 2px 6px rgba(79,70,229,0.3)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="w-7 h-7 flex items-center justify-center text-white text-sm font-bold rounded-full hover:bg-white/20 transition-colors"
                            onClick={(e) => { e.stopPropagation(); decrementCart(product.id) }}
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-white text-xs font-bold tabular-nums">
                            {Number(inCart.qty) || 0}
                          </span>
                          <button
                            type="button"
                            className="w-7 h-7 flex items-center justify-center text-white text-sm font-bold rounded-full hover:bg-white/20 transition-colors"
                            onClick={(e) => { e.stopPropagation(); addToCart(product) }}
                          >
                            +
                          </button>
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* Cart — 2 cols */}
        <form className="card overflow-hidden flex flex-col lg:col-span-2" onSubmit={onSubmitSale}>
          <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
              Giỏ hàng
              {cart.length > 0 && (
                <span className="badge badge-info">{totalItems} SP</span>
              )}
            </h2>
          </div>

          <div className="flex-1 p-3 max-h-[380px] overflow-y-auto">
            {cart.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-40">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
                </svg>
                <p className="text-sm">Giỏ hàng đang trống.</p>
                <p className="text-xs mt-1">Nhấn vào sản phẩm bên trái để thêm</p>
              </div>
            ) : null}

            {cart.length > 0 ? (
              <div className="space-y-2">
                {cart.map((item) => {
                  const lineTotal = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0)
                  return (
                    <div key={item.productId} className="rounded-lg p-3" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border-light)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                          {item.unitName ? (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Đơn vị: {item.unitName}</p>
                          ) : null}
                        </div>
                        <button
                          className="text-xs py-1 px-2 rounded-md transition-colors"
                          style={{ color: '#e11d48', border: '1px solid rgba(225,29,72,0.2)' }}
                          onClick={() => removeCartItem(item.productId)}
                          type="button"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                          SL
                          <input
                            className="mt-1 w-full"
                            min="1"
                            step="1"
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateCartItem(item.productId, { qty: e.target.value })}
                          />
                        </label>
                        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                          Đơn giá (đ)
                          <input
                            className="mt-1 w-full"
                            min="0"
                            step="1"
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateCartItem(item.productId, { unitPrice: e.target.value })}
                          />
                        </label>
                      </div>

                      <p className="text-xs text-right mt-2 font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>
                        = {lineTotal.toLocaleString('vi-VN')}đ
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>

          {/* Checkout footer */}
          <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-alt)' }}>
            {submitError ? <p className="text-sm" style={{ color: 'var(--accent-rose)' }}>{submitError}</p> : null}
            {submitSuccess ? (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#047857' }}>
                {submitSuccess}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs font-medium flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                Khách hàng (tuỳ chọn)
              </label>
              <select className="w-full text-sm" value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">Khách lẻ</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` - ${c.phone}` : ''}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Tổng tiền</span>
              <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {Number(totalAmount).toLocaleString('vi-VN')}đ
              </span>
            </div>

            {/* Debt toggle */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isDebt}
                  onChange={(e) => { setIsDebt(e.target.checked); if (!e.target.checked) setPaidAmount('') }}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Ghi nợ</span>
              </label>
            </div>

            {isDebt ? (
              <div className="space-y-2 rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <label className="text-xs font-medium" style={{ color: '#d97706' }}>
                  Số tiền đã trả
                </label>
                <input className="w-full text-sm" type="number" min="0" placeholder="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
                <div className="flex items-center justify-between text-xs font-medium">
                  <span style={{ color: '#d97706' }}>Số tiền nợ</span>
                  <span style={{ color: '#e11d48' }}>
                    {Math.max(0, totalAmount - Number(paidAmount || 0)).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
            ) : null}

            <button
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              disabled={submitLoading || cart.length === 0}
              type="submit"
            >
              {submitLoading ? (
                <>
                  <span className="spinner" />
                  Đang tạo đơn...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Xác nhận thanh toán
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
