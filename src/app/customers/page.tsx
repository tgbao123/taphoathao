'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { useRequireSession } from '@/lib/useRequireSession'

type Customer = {
  id: string
  name: string
  phone: string | null
}

type ApiError = { error?: { message?: string } }

type EditState = { id: string; name: string; phone: string }

export default function CustomersPage() {
  const { checkingSession } = useRequireSession()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 10

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit
  const [editState, setEditState] = useState<EditState | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [debtMap, setDebtMap] = useState<Record<string, number>>({})
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  async function fetchData(reset = true) {
    if (reset) { setLoading(true); setError(null) } else { setLoadingMore(true) }
    try {
      const offset = reset ? 0 : customers.length
      const [custRes, ...rest] = await Promise.all([
        fetch(`/api/customers?limit=${PAGE_SIZE}&offset=${offset}`, { cache: 'no-store' }),
        ...(reset ? [fetch('/api/customers/debt', { cache: 'no-store' })] : []),
      ])
      const json = (await custRes.json()) as { data?: Customer[]; pagination?: { total?: number } } & ApiError
      if (!custRes.ok) throw new Error(json.error?.message ?? 'Không tải được danh sách')
      const newTotal = json.pagination?.total ?? 0
      if (reset) {
        setCustomers(json.data ?? [])
        const debtRes = rest[0]!
        const debtJson = (await debtRes.json()) as { data?: Record<string, number> }
        setDebtMap(debtJson.data ?? {})
      } else {
        setCustomers((prev) => [...prev, ...(json.data ?? [])])
      }
      setTotal(newTotal)
      setHasMore(offset + PAGE_SIZE < newTotal)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => { void fetchData() }, [])

  useEffect(() => {
    if (!hasMore || loadingMore) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) void fetchData(false)
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, customers.length])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return customers
    return customers.filter((c) =>
      c.name.toLowerCase().includes(keyword) || (c.phone ?? '').includes(keyword)
    )
  }, [customers, query])

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createName.trim()) { setCreateError('Tên là bắt buộc'); return }
    setCreateLoading(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), phone: createPhone.trim() || undefined }),
      })
      const json = (await res.json()) as { data?: Customer } & ApiError
      if (!res.ok) throw new Error(json.error?.message ?? 'Không tạo được')
      setCreateName('')
      setCreatePhone('')
      setShowCreate(false)
      void fetchData()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Lỗi')
    } finally {
      setCreateLoading(false)
    }
  }

  function startEdit(c: Customer) {
    setEditState({ id: c.id, name: c.name, phone: c.phone ?? '' })
    setActionError(null)
  }

  async function saveEdit() {
    if (!editState) return
    setEditLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/customers/${editState.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editState.name, phone: editState.phone }),
      })
      if (!res.ok) {
        const json = (await res.json()) as ApiError
        throw new Error(json.error?.message ?? 'Lỗi cập nhật')
      }
      setEditState(null)
      void fetchData()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Lỗi')
    } finally {
      setEditLoading(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setActionError(null)
    try {
      const res = await fetch(`/api/customers/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = (await res.json()) as ApiError
        throw new Error(json.error?.message ?? 'Lỗi xóa')
      }
      setDeleteTarget(null)
      void fetchData()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Lỗi')
      setDeleteTarget(null)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Khách hàng</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Quản lý danh sách khách hàng.</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setShowCreate(!showCreate)}
          type="button"
        >
          + Tạo mới
        </button>
      </div>

      {/* Create form */}
      {showCreate ? (
        <section className="card p-5">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Thêm khách hàng</h2>
          <form className="grid gap-4 md:grid-cols-3 items-end" onSubmit={onCreate}>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Tên *
              <input className="mt-1.5 w-full" placeholder="VD: Anh Minh" value={createName}
                onChange={(e) => setCreateName(e.target.value)} />
            </label>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Số điện thoại
              <input className="mt-1.5 w-full" placeholder="VD: 0901234567" value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)} />
            </label>
            <div className="flex items-center gap-2">
              <button className="btn-primary" disabled={createLoading} type="submit">
                {createLoading ? 'Đang tạo...' : 'Tạo'}
              </button>
              <button className="btn-secondary" onClick={() => setShowCreate(false)} type="button">Hủy</button>
            </div>
          </form>
          {createError ? (
            <div className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(225,29,72,0.08)', color: 'var(--accent-rose)' }}>
              {createError}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Search */}
      <section className="card p-4">
        <div className="relative md:max-w-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="w-full pl-10"
            placeholder="Tìm theo tên hoặc SĐT..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </section>

      {actionError ? (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(225,29,72,0.08)', color: 'var(--accent-rose)' }}>
          {actionError}
        </div>
      ) : null}

      {loading ? (
        <div className="card p-6 space-y-3">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
        </div>
      ) : null}
      {error ? <p className="text-sm" style={{ color: 'var(--accent-rose)' }}>{error}</p> : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-40">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          <p className="text-sm">Chưa có khách hàng nào.</p>
        </div>
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <section className="card overflow-hidden">
          <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Danh sách
              <span className="ml-2 badge badge-neutral">{filtered.length}</span>
            </h2>
            <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => void fetchData()} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
              Tải lại
            </button>
          </div>
          <div className="overflow-x-auto desktop-table">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>SĐT</th>
                  <th>Nợ</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isEditing = editState?.id === c.id
                  return (
                    <tr key={c.id}>
                      <td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {isEditing ? (
                          <input className="w-40" value={editState.name}
                            onChange={(e) => setEditState((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
                        ) : (
                          <Link href={`/customers/${c.id}`} className="hover:underline" style={{ color: 'var(--primary)' }}>
                            {c.name}
                          </Link>
                        )}
                      </td>
                      <td className="font-mono text-xs">
                        {isEditing ? (
                          <input className="w-32" value={editState.phone}
                            onChange={(e) => setEditState((prev) => prev ? { ...prev, phone: e.target.value } : prev)} />
                        ) : (c.phone ?? '—')}
                      </td>
                      <td>
                        {(() => {
                          const debt = debtMap[c.id] ?? 0
                          return (
                            <span className="font-medium tabular-nums text-sm"
                              style={{ color: debt > 0 ? '#e11d48' : '#047857' }}
                            >
                              {debt > 0 ? debt.toLocaleString('vi-VN') + 'đ' : '0đ'}
                            </span>
                          )
                        })()}
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <button className="btn-primary text-xs py-1 px-2.5" disabled={editLoading}
                              onClick={() => void saveEdit()} type="button">
                              {editLoading ? '...' : 'Lưu'}
                            </button>
                            <button className="btn-secondary text-xs py-1 px-2.5"
                              onClick={() => setEditState(null)} type="button">
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button className="btn-secondary text-xs py-1 px-2.5"
                              onClick={() => startEdit(c)} type="button">
                              Sửa
                            </button>
                            <button className="text-xs py-1 px-2.5 rounded-lg font-medium transition-colors"
                              style={{ color: '#e11d48', border: '1px solid rgba(225,29,72,0.2)' }}
                              onClick={() => setDeleteTarget({ id: c.id, name: c.name })} type="button">
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
          <div className="mobile-cards space-y-3">
            {filtered.map((c) => {
              const isEditing = editState?.id === c.id
              const debt = debtMap[c.id] ?? 0
              return (
                <div key={c.id} className="mobile-card">
                  {isEditing ? (
                    <div className="space-y-3">
                      <input className="w-full" value={editState.name} placeholder="Tên KH"
                        onChange={(e) => setEditState((prev) => prev ? { ...prev, name: e.target.value } : prev)} />
                      <input className="w-full" value={editState.phone} placeholder="SĐT"
                        onChange={(e) => setEditState((prev) => prev ? { ...prev, phone: e.target.value } : prev)} />
                      <div className="flex items-center gap-2">
                        <button className="btn-primary text-xs py-1.5 px-3 flex-1" disabled={editLoading}
                          onClick={() => void saveEdit()} type="button">
                          {editLoading ? '...' : 'Lưu'}
                        </button>
                        <button className="btn-secondary text-xs py-1.5 px-3"
                          onClick={() => setEditState(null)} type="button">Hủy</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <Link href={`/customers/${c.id}`} className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                          {c.name}
                        </Link>
                        <span className="font-medium tabular-nums text-xs"
                          style={{ color: debt > 0 ? '#e11d48' : '#047857' }}>
                          {debt > 0 ? 'Nợ ' + debt.toLocaleString('vi-VN') + 'đ' : '0đ'}
                        </span>
                      </div>
                      {c.phone ? (
                        <p className="text-xs font-mono mb-2" style={{ color: 'var(--text-muted)' }}>{c.phone}</p>
                      ) : null}
                      <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                        <button className="btn-secondary text-xs py-2 px-4 flex-1"
                          onClick={() => startEdit(c)} type="button">✏️ Sửa</button>
                        <button className="btn-secondary text-xs py-2 px-4 flex-1"
                          style={{ color: '#e11d48' }}
                          onClick={() => setDeleteTarget({ id: c.id, name: c.name })} type="button">🗑 Xóa</button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {!loading && !error && customers.length > 0 ? (
            <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2"><span className="spinner spinner-dark" /> Đang tải thêm...</div>
              ) : hasMore ? <div ref={sentinelRef} /> : (
                <span>Hiển thị {customers.length} / {total} khách hàng</span>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
      {/* Delete confirmation modal */}
      {deleteTarget ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDeleteTarget(null)}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideUp 0.2s ease-out' }}
          >
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Xác nhận xóa</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Bạn có chắc muốn xóa khách hàng <strong>{deleteTarget.name}</strong>?
            </p>
            <div className="flex items-center gap-2 justify-end pt-2">
              <button className="btn-secondary text-sm" onClick={() => setDeleteTarget(null)} type="button">Hủy</button>
              <button className="text-sm py-2 px-4 rounded-lg font-medium text-white transition-colors"
                style={{ background: '#e11d48' }}
                onClick={() => void confirmDelete()} type="button">
                Xóa
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  )
}
