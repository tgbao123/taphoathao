'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { useRequireSession } from '@/lib/useRequireSession'

type Unit = {
  id: string
  code: string
  name: string
  symbol: string | null
}

type Product = {
  id: string
  sku: string
  name: string
  unit_id: string
  barcode: string | null
  default_sell_price: number
  quantity: number
  is_active: boolean
  created_at: string
  unit?: Unit | null
}

type ApiError = {
  error?: {
    message?: string
  }
}

type EditState = {
  id: string
  sku: string
  name: string
  unit_id: string
  barcode: string
  default_sell_price: string
  quantity: string
  is_active: boolean
}

const initialCreateForm = {
  sku: '',
  name: '',
  unit_id: '',
  barcode: '',
  default_sell_price: '',
  quantity: '',
}

export default function ProductsPage() {
  const { checkingSession } = useRequireSession()

  const [products, setProducts] = useState<Product[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState(initialCreateForm)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editState, setEditState] = useState<EditState | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [showCreateForm, setShowCreateForm] = useState(false)

  async function fetchData() {
    setLoading(true)
    setError(null)

    try {
      const [productsRes, unitsRes] = await Promise.all([
        fetch('/api/products', { cache: 'no-store' }),
        fetch('/api/units', { cache: 'no-store' }),
      ])

      const productsJson = (await productsRes.json()) as { data?: Product[] } & ApiError
      const unitsJson = (await unitsRes.json()) as { data?: Unit[] } & ApiError

      if (!productsRes.ok) {
        throw new Error(productsJson.error?.message ?? 'Failed to load products')
      }

      if (!unitsRes.ok) {
        throw new Error(unitsJson.error?.message ?? 'Failed to load units')
      }

      setProducts(productsJson.data ?? [])
      setUnits(unitsJson.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  const unitMap = useMemo(() => {
    return new Map(units.map((u) => [u.id, u]))
  }, [units])

  async function onCreateProduct(e: React.FormEvent) {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)

    const payload = {
      sku: crypto.randomUUID(),
      name: createForm.name.trim(),
      unit_id: createForm.unit_id,
      barcode: createForm.barcode.trim() || undefined,
      default_sell_price: Number(createForm.default_sell_price || 0),
      quantity: Number(createForm.quantity || 0),
    }

    if (!payload.name || !payload.unit_id) {
      setCreateError('Tên sản phẩm và đơn vị là bắt buộc')
      setCreateLoading(false)
      return
    }

    if (!Number.isFinite(payload.default_sell_price) || payload.default_sell_price < 0) {
      setCreateError('Giá bán mặc định phải >= 0')
      setCreateLoading(false)
      return
    }

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json()) as { data?: Product } & ApiError

      if (!res.ok || !json.data) {
        throw new Error(json.error?.message ?? 'Cannot create product')
      }

      setProducts((prev) => [json.data as Product, ...prev])
      setCreateForm(initialCreateForm)
      setShowCreateForm(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Cannot create product')
    } finally {
      setCreateLoading(false)
    }
  }

  function startEdit(product: Product) {
    setActionError(null)
    setEditState({
      id: product.id,
      sku: product.sku,
      name: product.name,
      unit_id: product.unit_id,
      barcode: product.barcode ?? '',
      default_sell_price: String(product.default_sell_price),
      quantity: String(product.quantity),
      is_active: product.is_active,
    })
  }

  async function saveEdit() {
    if (!editState) return

    const payload = {
      sku: editState.sku.trim(),
      name: editState.name.trim(),
      unit_id: editState.unit_id,
      barcode: editState.barcode.trim() || null,
      default_sell_price: Number(editState.default_sell_price || 0),
      quantity: Number(editState.quantity || 0),
      is_active: editState.is_active,
    }

    if (!payload.name || !payload.unit_id) {
      setActionError('Tên sản phẩm và đơn vị không được trống')
      return
    }

    if (!Number.isFinite(payload.default_sell_price) || payload.default_sell_price < 0) {
      setActionError('Giá bán mặc định phải >= 0')
      return
    }

    setEditLoading(true)
    setActionError(null)

    try {
      const res = await fetch(`/api/products/${editState.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as { data?: Product } & ApiError

      if (!res.ok || !json.data) {
        throw new Error(json.error?.message ?? 'Cannot update product')
      }

      setProducts((prev) => prev.map((p) => (p.id === editState.id ? (json.data as Product) : p)))
      setEditState(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cannot update product')
    } finally {
      setEditLoading(false)
    }
  }

  async function removeProduct(id: string) {
    const ok = window.confirm('Xóa sản phẩm này?')
    if (!ok) return

    setActionError(null)

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiError
      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Cannot delete product')
      }

      setProducts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cannot delete product')
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
          <h1>Sản phẩm</h1>
          <p>Quản lý danh mục sản phẩm, tạo mới và chỉnh sửa nhanh.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowCreateForm(!showCreateForm)}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tạo mới
          </button>

        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <section className="card p-5 animate-slide-up">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Tạo sản phẩm mới
          </h2>
          <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={onCreateProduct}>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Tên sản phẩm *
              <input
                className="mt-1.5 w-full"
                placeholder="VD: Nước suối Lavie 500ml..."
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Đơn vị *
              <select
                className="mt-1.5 w-full"
                value={createForm.unit_id}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, unit_id: e.target.value }))}
              >
                <option value="">Chọn đơn vị</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Barcode (tuỳ chọn)
              <input
                className="mt-1.5 w-full"
                placeholder="VD: 8934588012150"
                value={createForm.barcode}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, barcode: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Giá bán mặc định (đ)
              <input
                className="mt-1.5 w-full"
                placeholder="VD: 10000"
                type="number"
                min="0"
                step="1"
                value={createForm.default_sell_price}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, default_sell_price: e.target.value }))}
              />
            </label>


            <div className="md:col-span-2 flex items-center gap-2">
              <button
                className="btn-primary"
                disabled={createLoading}
                type="submit"
              >
                {createLoading ? 'Đang tạo...' : 'Tạo sản phẩm'}
              </button>
              <button className="btn-secondary" onClick={() => setShowCreateForm(false)} type="button">
                Hủy
              </button>
            </div>
          </form>
          {createError ? <p className="mt-2 text-sm" style={{ color: 'var(--accent-rose)' }}>{createError}</p> : null}
          {units.length === 0 ? (
            <p className="mt-2 text-sm" style={{ color: 'var(--accent-amber)' }}>
              Chưa có đơn vị. Hãy tạo đơn vị bằng API <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--surface-alt)' }}>POST /api/units</code> trước khi thêm sản phẩm.
            </p>
          ) : null}
        </section>
      )}

      {/* Products table */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Danh sách sản phẩm
            {!loading && <span className="ml-2 badge badge-neutral">{products.length}</span>}
          </h2>
          <button className="btn-secondary text-xs flex items-center gap-1.5" onClick={() => void fetchData()}>
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
            <div className="skeleton h-4 w-2/3" />
          </div>
        ) : null}

        {error ? <p className="p-4 text-sm" style={{ color: 'var(--accent-rose)' }}>{error}</p> : null}
        {!loading && !error && actionError ? <p className="p-4 text-sm" style={{ color: 'var(--accent-rose)' }}>{actionError}</p> : null}

        {!loading && !error && products.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-40">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            </svg>
            <p className="text-sm">Chưa có sản phẩm nào.</p>
          </div>
        ) : null}

        {!loading && !error && products.length > 0 ? (
          <>
          {/* Desktop Table */}
          <div className="overflow-x-auto desktop-table">
            <table className="styled-table">
              <thead>
                <tr>

                  <th>Tên</th>
                  <th>Đơn vị</th>
                  <th>Giá bán</th>
                  <th>Barcode</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const isEditing = editState?.id === product.id
                  const unit = product.unit ?? unitMap.get(product.unit_id) ?? null

                  return (
                    <tr key={product.id}>

                      <td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {isEditing ? (
                          <input
                            className="w-44"
                            value={editState.name}
                            onChange={(e) =>
                              setEditState((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                            }
                          />
                        ) : (
                          <Link className="hover:underline" style={{ color: 'var(--primary)' }} href={`/products/${product.id}`}>
                            {product.name}
                          </Link>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="w-32"
                            value={editState.unit_id}
                            onChange={(e) =>
                              setEditState((prev) => (prev ? { ...prev, unit_id: e.target.value } : prev))
                            }
                          >
                            <option value="">Chọn đơn vị</option>
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.code})
                              </option>
                            ))}
                          </select>
                        ) : (
                          unit?.name ?? '-'
                        )}
                      </td>

                      <td className="font-medium tabular-nums">
                        {isEditing ? (
                          <input
                            className="w-24"
                            type="number"
                            min="0"
                            step="1"
                            value={editState.default_sell_price}
                            onChange={(e) =>
                              setEditState((prev) =>
                                prev ? { ...prev, default_sell_price: e.target.value } : prev
                              )
                            }
                          />
                        ) : (
                          Number(product.default_sell_price).toLocaleString('vi-VN') + 'đ'
                        )}
                      </td>

                      <td className="font-mono text-xs">
                        {isEditing ? (
                          <input
                            className="w-32"
                            value={editState.barcode}
                            onChange={(e) =>
                              setEditState((prev) => (prev ? { ...prev, barcode: e.target.value } : prev))
                            }
                          />
                        ) : (
                          <span style={{ color: product.barcode ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                            {product.barcode ?? '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              checked={editState.is_active}
                              onChange={(e) =>
                                setEditState((prev) =>
                                  prev ? { ...prev, is_active: e.target.checked } : prev
                                )
                              }
                              type="checkbox"
                              className="accent-indigo-600"
                            />
                            Active
                          </label>
                        ) : product.is_active ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-neutral">Inactive</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="flex gap-1.5">
                            <button
                              className="btn-primary text-xs py-1.5 px-3"
                              disabled={editLoading}
                              onClick={() => void saveEdit()}
                              type="button"
                            >
                              {editLoading ? 'Lưu...' : 'Lưu'}
                            </button>
                            <button
                              className="btn-secondary text-xs py-1.5 px-3"
                              onClick={() => setEditState(null)}
                              type="button"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <button
                              className="btn-secondary text-xs py-1.5 px-3"
                              onClick={() => startEdit(product)}
                              type="button"
                            >
                              Sửa
                            </button>
                            <button
                              className="btn-danger text-xs py-1.5 px-2.5"
                              onClick={() => void removeProduct(product.id)}
                              type="button"
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="mobile-cards flex-col gap-3 p-3">
            {products.map((product) => {
              const isEditing = editState?.id === product.id
              const unit = product.unit ?? unitMap.get(product.unit_id) ?? null
              return (
                <div key={product.id} className="mobile-card">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input className="w-full" value={editState.name} placeholder="Tên SP"
                        onChange={(e) => setEditState((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
                      <div className="flex gap-2">
                        <input className="flex-1" type="number" min="0" value={editState.default_sell_price} placeholder="Giá bán"
                          onChange={(e) => setEditState((prev) => prev ? { ...prev, default_sell_price: e.target.value } : prev)} />
                        <select className="flex-1" value={editState.unit_id}
                          onChange={(e) => setEditState((prev) => prev ? { ...prev, unit_id: e.target.value } : prev)}>
                          <option value="">Đơn vị</option>
                          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <input className="w-full" value={editState.barcode} placeholder="Barcode"
                        onChange={(e) => setEditState((prev) => prev ? { ...prev, barcode: e.target.value } : prev)} />
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input checked={editState.is_active} type="checkbox" className="accent-indigo-600"
                          onChange={(e) => setEditState((prev) => prev ? { ...prev, is_active: e.target.checked } : prev)} />
                        Active
                      </label>
                      <div className="flex items-center gap-2">
                        <button className="btn-primary text-xs py-2 px-4 flex-1" disabled={editLoading}
                          onClick={() => void saveEdit()} type="button">{editLoading ? '...' : 'Lưu'}</button>
                        <button className="btn-secondary text-xs py-2 px-4"
                          onClick={() => setEditState(null)} type="button">Hủy</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <Link href={`/products/${product.id}`} className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                          {product.name}
                        </Link>
                        {product.is_active ? (
                          <span className="badge badge-success text-[10px]">Active</span>
                        ) : (
                          <span className="badge badge-neutral text-[10px]">Inactive</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-medium tabular-nums" style={{ color: 'var(--primary)' }}>
                          {Number(product.default_sell_price).toLocaleString('vi-VN')}đ
                        </span>
                        <span>/ {unit?.name ?? '-'}</span>
                        {product.barcode ? (
                          <span className="font-mono" style={{ color: 'var(--text-muted)' }}>{product.barcode}</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                        <button className="btn-secondary text-xs py-2 px-4 flex-1"
                          onClick={() => startEdit(product)} type="button">✏️ Sửa</button>
                        <button className="btn-secondary text-xs py-2 px-4 flex-1"
                          style={{ color: '#e11d48' }}
                          onClick={() => void removeProduct(product.id)} type="button">🗑 Xóa</button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          </>
        ) : null}
      </section>
    </div>
  )
}
