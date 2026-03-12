'use client'

import { useEffect, useState } from 'react'

import { useRequireSession } from '@/lib/useRequireSession'

type ReportSummary = {
  revenue: number
  debt: number
  products: number
  cashflowNet: number
}

type ApiError = {
  error?: {
    message?: string
  }
}

const kpiConfig = [
  {
    key: 'revenue' as const,
    label: 'Doanh thu',
    gradient: 'kpi-indigo',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    suffix: 'đ',
  },
  {
    key: 'debt' as const,
    label: 'Công nợ',
    gradient: 'kpi-rose',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    suffix: 'đ',
  },
  {
    key: 'products' as const,
    label: 'Sản phẩm',
    gradient: 'kpi-emerald',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    suffix: '',
  },
  {
    key: 'cashflowNet' as const,
    label: 'Dòng tiền ròng',
    gradient: 'kpi-amber',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    suffix: 'đ',
  },
]

export default function ReportsPage() {
  const { checkingSession } = useRequireSession()

  const [summary, setSummary] = useState<ReportSummary>({
    revenue: 0,
    debt: 0,
    products: 0,
    cashflowNet: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadReportSummary() {
      setLoading(true)
      setError(null)
      try {
        const [productsRes, reportRes] = await Promise.all([
          fetch('/api/products', { cache: 'no-store' }),
          fetch('/api/reports/summary', { cache: 'no-store' }),
        ])

        const productsJson = (await productsRes.json()) as { data?: Array<{ id: string }> } & ApiError
        const reportJson = (await reportRes.json()) as { data?: Partial<ReportSummary> } & ApiError

        if (!productsRes.ok) {
          throw new Error(productsJson.error?.message ?? 'Không tải được dữ liệu sản phẩm cho báo cáo')
        }

        if (!reportRes.ok) {
          throw new Error(reportJson.error?.message ?? 'Không tải được báo cáo tổng hợp')
        }

        setSummary({
          revenue: Number(reportJson.data?.revenue ?? 0),
          debt: Number(reportJson.data?.debt ?? 0),
          cashflowNet: Number(reportJson.data?.cashflowNet ?? 0),
          products: Number(reportJson.data?.products ?? productsJson.data?.length ?? 0),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được báo cáo')
      } finally {
        setLoading(false)
      }
    }

    void loadReportSummary()
  }, [])

  if (checkingSession) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <span className="spinner spinner-dark" /> Đang kiểm tra phiên đăng nhập...
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1>Báo cáo</h1>
        <p>Tổng quan KPI và phân tích kinh doanh.</p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : null}
      {error ? <p className="text-sm" style={{ color: 'var(--accent-rose)' }}>{error}</p> : null}

      {!loading && !error ? (
        <section className="grid gap-4 md:grid-cols-4 stagger-children">
          {kpiConfig.map((kpi) => (
            <div key={kpi.key} className={`kpi-card ${kpi.gradient}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="kpi-label">{kpi.label}</p>
                <span className="opacity-70">{kpi.icon}</span>
              </div>
              <p className="kpi-value">
                {Number(summary[kpi.key]).toLocaleString('vi-VN')}{kpi.suffix}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ color: 'var(--primary)' }}>
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Biểu đồ</h2>
        </div>
        <div className="rounded-lg p-8 text-center" style={{ background: 'var(--surface-alt)', border: '1.5px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Biểu đồ doanh thu / lợi nhuận theo thời gian sẽ hiển thị ở đây.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Coming soon — Post V1</p>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(5, 150, 105, 0.1)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ color: 'var(--accent-emerald)' }}>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Phân tích chi tiết</h2>
        </div>
        <div className="rounded-lg p-8 text-center" style={{ background: 'var(--surface-alt)', border: '1.5px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Top sản phẩm, top khách hàng, phân tích theo danh mục.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Coming soon — Post V1</p>
        </div>
      </section>
    </div>
  )
}
