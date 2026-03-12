'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { useRequireSession } from '@/lib/useRequireSession'

type LedgerEntry = {
  id: string
  entryType: 'sale_debt' | 'payment' | 'adjustment'
  amount: number
  balanceAfter: number | null
  saleId: string | null
  paymentId: string | null
  occurredAt: string
  note: string | null
}

type LedgerResponse = {
  customerId: string
  customerName: string
  openingDebt: number
  currentDebt: number
  entries: LedgerEntry[]
}

type ApiError = {
  error?: {
    message?: string
  }
}

const entryTypeBadge: Record<string, { class: string; label: string }> = {
  sale_debt: { class: 'badge-danger', label: 'Nợ bán hàng' },
  payment: { class: 'badge-success', label: 'Thu nợ' },
  adjustment: { class: 'badge-warning', label: 'Điều chỉnh' },
}

export default function CustomerDebtPage() {
  const { checkingSession } = useRequireSession()

  const params = useParams<{ id: string }>()
  const customerId = params.id

  const [ledgerData, setLedgerData] = useState<LedgerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'card' | 'ewallet' | 'other'>('cash')
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  async function fetchLedger() {
    if (!customerId) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/debt/customers/${customerId}/ledger?limit=50&offset=0`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as LedgerResponse & ApiError

      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Không tải được sổ công nợ')
      }

      setLedgerData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được sổ công nợ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchLedger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  const isEmpty = useMemo(() => {
    return !loading && !error && (ledgerData?.entries?.length ?? 0) === 0
  }, [loading, error, ledgerData])

  async function onSubmitPayment(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(null)

    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setSubmitError('Số tiền thu nợ phải > 0')
      return
    }

    setSubmitLoading(true)

    try {
      const res = await fetch('/api/debt/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          amount: parsedAmount,
          method,
          note: note.trim() || undefined,
          reference: reference.trim() || undefined,
        }),
      })

      const json = (await res.json()) as { paymentId?: string; error?: { message?: string } }
      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Không ghi nhận được thu nợ')
      }

      setSubmitSuccess(`Thu nợ thành công${json.paymentId ? `: ${json.paymentId}` : ''}`)
      setAmount('')
      setNote('')
      setReference('')
      await fetchLedger()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Không ghi nhận được thu nợ')
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
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <Link className="inline-flex items-center gap-1 text-sm mb-1 transition-colors" href="/customers"
          style={{ color: 'var(--primary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại khách hàng
        </Link>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Công nợ: {ledgerData?.customerName ?? '...'}</h1>
          <p>Sổ công nợ chi tiết và form thu nợ.</p>
        </div>
      </div>

      {/* KPI cards */}
      <section className="grid gap-4 md:grid-cols-3 stagger-children">
        <div className="kpi-card kpi-amber">
          <p className="kpi-label">Nợ đầu kỳ</p>
          <p className="kpi-value">{Number(ledgerData?.openingDebt ?? 0).toLocaleString('vi-VN')}đ</p>
        </div>
        <div className="kpi-card kpi-rose">
          <p className="kpi-label">Nợ hiện tại</p>
          <p className="kpi-value">{Number(ledgerData?.currentDebt ?? 0).toLocaleString('vi-VN')}đ</p>
        </div>
        <div className="kpi-card kpi-sky">
          <p className="kpi-label">Số dòng ledger</p>
          <p className="kpi-value">{ledgerData?.entries?.length ?? 0}</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {/* Ledger table */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Sổ công nợ</h2>
            <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => void fetchLedger()} type="button">
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
          {isEmpty ? (
            <p className="p-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
              Khách hàng chưa phát sinh công nợ.
            </p>
          ) : null}

          {!loading && !error && (ledgerData?.entries?.length ?? 0) > 0 ? (
            <div className="overflow-x-auto">
              <table className="styled-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Loại</th>
                    <th>Số tiền</th>
                    <th>Số dư sau</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData?.entries.map((entry) => {
                    const badge = entryTypeBadge[entry.entryType] ?? { class: 'badge-neutral', label: entry.entryType }
                    return (
                      <tr key={entry.id}>
                        <td className="text-xs">{new Date(entry.occurredAt).toLocaleString('vi-VN')}</td>
                        <td><span className={`badge ${badge.class}`}>{badge.label}</span></td>
                        <td className="font-medium tabular-nums">{Number(entry.amount).toLocaleString('vi-VN')}đ</td>
                        <td className="tabular-nums">
                          {entry.balanceAfter == null ? '—' : `${Number(entry.balanceAfter).toLocaleString('vi-VN')}đ`}
                        </td>
                        <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{entry.note ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {/* Payment form */}
        <form className="card p-5" onSubmit={onSubmitPayment}>
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Thu nợ</h2>

          <label className="block text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
            Số tiền
            <input
              className="mt-1 w-full"
              min="0.01"
              step="0.01"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>

          <label className="block text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
            Phương thức
            <select
              className="mt-1 w-full"
              value={method}
              onChange={(e) => setMethod(e.target.value as 'cash' | 'bank_transfer' | 'card' | 'ewallet' | 'other')}
            >
              <option value="cash">Tiền mặt</option>
              <option value="bank_transfer">Chuyển khoản</option>
              <option value="card">Thẻ</option>
              <option value="ewallet">Ví điện tử</option>
              <option value="other">Khác</option>
            </select>
          </label>

          <label className="block text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
            Reference
            <input
              className="mt-1 w-full"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>

          <label className="block text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
            Ghi chú
            <textarea
              className="mt-1 w-full"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          {submitError ? (
            <div className="rounded-lg px-3 py-2 mb-2 text-sm" style={{ background: 'rgba(225, 29, 72, 0.08)', color: 'var(--accent-rose)' }}>
              {submitError}
            </div>
          ) : null}
          {submitSuccess ? (
            <div className="rounded-lg px-3 py-2 mb-2 text-sm" style={{ background: 'rgba(5, 150, 105, 0.08)', color: '#047857' }}>
              {submitSuccess}
            </div>
          ) : null}

          <button
            className="btn-primary w-full flex items-center justify-center gap-2"
            disabled={submitLoading}
            type="submit"
          >
            {submitLoading ? (
              <>
                <span className="spinner" />
                Đang ghi nhận...
              </>
            ) : (
              'Xác nhận thu nợ'
            )}
          </button>
        </form>
      </section>
    </div>
  )
}
