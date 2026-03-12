'use client'

import { useEffect, useState } from 'react'

import { useRequireSession } from '@/lib/useRequireSession'

type Unit = {
  id: string
  code: string
  name: string
  symbol: string | null
  is_active: boolean
  created_at: string
}

type ApiError = {
  error?: {
    message?: string
  }
}

export default function UnitsPage() {
  const { checkingSession } = useRequireSession()

  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function fetchUnits() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/units', { cache: 'no-store' })
      const json = (await res.json()) as { data?: Unit[] } & ApiError
      if (!res.ok) throw new Error(json.error?.message ?? 'Không tải được danh sách đơn vị')
      setUnits(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách đơn vị')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUnits()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(null)

    if (!code.trim() || !name.trim()) {
      setSubmitError('Mã và tên đơn vị là bắt buộc')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          symbol: symbol.trim() || undefined,
        }),
      })

      const json = (await res.json()) as { data?: Unit } & ApiError
      if (!res.ok) throw new Error(json.error?.message ?? 'Không tạo được đơn vị')

      if (json.data) {
        setUnits((prev) => [json.data as Unit, ...prev])
      }

      setSubmitSuccess(`Đã tạo đơn vị "${name.trim()}"`)
      setCode('')
      setName('')
      setSymbol('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Không tạo được đơn vị')
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
      <div className="flex flex-wrap items-start justify-between gap-4" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Đơn vị</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Quản lý đơn vị tính cho sản phẩm.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(!showForm)} type="button">
          {showForm ? (
            '✕ Đóng'
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Tạo mới
            </>
          )}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <section className="card p-5 animate-fade-in">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Tạo đơn vị mới</h2>
          <form className="grid gap-4 sm:grid-cols-3" onSubmit={onSubmit}>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Mã (code) *
              <input
                className="mt-1.5 w-full uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VD: KG, HOP, CAI..."
                maxLength={10}
              />
            </label>

            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Tên đơn vị *
              <input
                className="mt-1.5 w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Kilogram, Hộp, Cái..."
              />
            </label>

            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Ký hiệu (tuỳ chọn)
              <input
                className="mt-1.5 w-full"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="VD: kg, g, ml..."
              />
            </label>

            {submitError ? (
              <div className="sm:col-span-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(225, 29, 72, 0.08)', color: 'var(--accent-rose)' }}>
                {submitError}
              </div>
            ) : null}
            {submitSuccess ? (
              <div className="sm:col-span-3 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(5, 150, 105, 0.08)', color: '#047857' }}>
                {submitSuccess}
              </div>
            ) : null}

            <div className="sm:col-span-3">
              <button className="btn-primary flex items-center gap-2" disabled={submitting} type="submit">
                {submitting ? (
                  <>
                    <span className="spinner" />
                    Đang lưu...
                  </>
                ) : (
                  'Tạo đơn vị'
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Units list */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Danh sách đơn vị
            {!loading && <span className="ml-2 badge badge-neutral">{units.length}</span>}
          </h2>
          <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => void fetchUnits()} type="button">
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

        {!loading && !error && units.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 opacity-40">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            <p className="text-sm">Chưa có đơn vị nào. Nhấn &quot;Tạo mới&quot; để thêm.</p>
          </div>
        ) : null}

        {!loading && !error && units.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên</th>
                  <th>Ký hiệu</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id}>
                    <td>
                      <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary)' }}>
                        {unit.code}
                      </span>
                    </td>
                    <td className="font-medium">{unit.name}</td>
                    <td className="text-sm" style={{ color: 'var(--text-muted)' }}>{unit.symbol ?? '—'}</td>
                    <td>
                      {unit.is_active ? (
                        <span className="badge badge-success">Hoạt động</span>
                      ) : (
                        <span className="badge badge-neutral">Ẩn</span>
                      )}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(unit.created_at).toLocaleDateString('vi-VN')}
                    </td>
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
