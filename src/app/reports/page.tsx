'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'

import { useRequireSession } from '@/lib/useRequireSession'

type ReportSummary = { revenue: number; debt: number; products: number; cashflowNet: number }
type RevenueDay = { date: string; revenue: number; orders: number; debt: number }
type TopProduct = { name: string; qty: number; revenue: number }
type TopCustomer = { name: string; total: number; orders: number; debt: number }
type CashflowSummary = {
  totalIn: number; totalOut: number; net: number
  byCategory: Array<{ category: string; income: number; expense: number }>
}

const PERIOD_OPTIONS = [
  { label: '7 ngày', days: 7 },
  { label: '14 ngày', days: 14 },
  { label: '30 ngày', days: 30 },
  { label: 'Tất cả', days: 0 },
]

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

function fmtVND(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K'
  return v.toLocaleString('vi-VN')
}

const kpiConfig = [
  {
    key: 'revenue' as const, label: 'Doanh thu', gradient: 'kpi-indigo', suffix: 'đ',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>),
  },
  {
    key: 'debt' as const, label: 'Công nợ', gradient: 'kpi-rose', suffix: 'đ',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>),
  },
  {
    key: 'products' as const, label: 'Sản phẩm', gradient: 'kpi-emerald', suffix: '',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>),
  },
  {
    key: 'cashflowNet' as const, label: 'Dòng tiền ròng', gradient: 'kpi-amber', suffix: 'đ',
    icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>),
  },
]

export default function ReportsPage() {
  const { checkingSession } = useRequireSession()

  const [period, setPeriod] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [summary, setSummary] = useState<ReportSummary>({ revenue: 0, debt: 0, products: 0, cashflowNet: 0 })
  const [revenueByDay, setRevenueByDay] = useState<RevenueDay[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [cashflow, setCashflow] = useState<CashflowSummary>({ totalIn: 0, totalOut: 0, net: 0, byCategory: [] })

  const buildParams = useCallback(() => {
    if (period === 0) return ''
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - period)
    return `?from=${from.toISOString()}&to=${to.toISOString()}`
  }, [period])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const qs = buildParams()
    try {
      const [sumRes, revRes, prodRes, custRes, cfRes] = await Promise.all([
        fetch(`/api/reports/summary${qs}`, { cache: 'no-store' }),
        fetch(`/api/reports/revenue-by-day${qs}`, { cache: 'no-store' }),
        fetch(`/api/reports/top-products${qs}`, { cache: 'no-store' }),
        fetch(`/api/reports/top-customers${qs}`, { cache: 'no-store' }),
        fetch(`/api/reports/cashflow-summary${qs}`, { cache: 'no-store' }),
      ])
      const [sumJ, revJ, prodJ, custJ, cfJ] = await Promise.all([
        sumRes.json(), revRes.json(), prodRes.json(), custRes.json(), cfRes.json(),
      ]) as [
        { data?: Partial<ReportSummary> },
        { data?: RevenueDay[] },
        { data?: TopProduct[] },
        { data?: TopCustomer[] },
        { data?: CashflowSummary },
      ]
      setSummary({
        revenue: Number(sumJ.data?.revenue ?? 0),
        debt: Number(sumJ.data?.debt ?? 0),
        products: Number(sumJ.data?.products ?? 0),
        cashflowNet: Number(sumJ.data?.cashflowNet ?? 0),
      })
      setRevenueByDay(revJ.data ?? [])
      setTopProducts(prodJ.data ?? [])
      setTopCustomers(custJ.data ?? [])
      setCashflow(cfJ.data ?? { totalIn: 0, totalOut: 0, net: 0, byCategory: [] })
    } catch {
      setError('Không tải được dữ liệu báo cáo')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { void loadAll() }, [loadAll])

  if (checkingSession) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <span className="spinner spinner-dark" /> Đang kiểm tra phiên đăng nhập...
      </div>
    )
  }

  const pieData = [
    { name: 'Thu', value: cashflow.totalIn },
    { name: 'Chi', value: cashflow.totalOut },
  ]

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>Báo cáo</h1>
          <p>Tổng quan KPI và phân tích kinh doanh.</p>
        </div>
        <div className="flex items-center gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button key={opt.days} type="button"
              className={`text-xs py-1.5 px-3 rounded-lg font-medium transition-all ${period === opt.days ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod(opt.days)}>{opt.label}</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : null}
      {error ? <p className="text-sm" style={{ color: 'var(--accent-rose)' }}>{error}</p> : null}

      {!loading && !error ? (
        <>
          <section className="grid gap-4 grid-cols-2 md:grid-cols-4 stagger-children">
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

          {/* Revenue Area Chart */}
          <section className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" style={{ color: 'var(--primary)' }}>
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Doanh thu theo ngày</h2>
            </div>
            {revenueByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueByDay} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} stroke="var(--text-muted)" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtVND} stroke="var(--text-muted)" />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown) => [Number(v).toLocaleString('vi-VN') + 'đ', 'Doanh thu']}
                    labelFormatter={(l: unknown) => `Ngày ${String(l)}`}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2}
                    fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="rounded-lg p-8 text-center" style={{ background: 'var(--surface-alt)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chưa có dữ liệu doanh thu trong khoảng thời gian này.</p>
              </div>
            )}
          </section>

          {/* Top Products + Cashflow Pie - 2 columns on desktop */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Products */}
            <section className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" style={{ color: 'var(--accent-emerald)' }}>
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Top sản phẩm bán chạy</h2>
              </div>
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={fmtVND} stroke="var(--text-muted)" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} stroke="var(--text-muted)" />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: unknown, name: unknown) => [
                        String(name) === 'qty' ? `${Number(v)} SP` : Number(v).toLocaleString('vi-VN') + 'đ',
                        String(name) === 'qty' ? 'Số lượng' : 'Doanh thu',
                      ]}
                    />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="rounded-lg p-8 text-center" style={{ background: 'var(--surface-alt)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chưa có dữ liệu bán hàng.</p>
                </div>
              )}
            </section>

            {/* Cashflow Pie */}
            <section className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" style={{ color: 'var(--accent-amber)' }}>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Tỷ lệ Thu / Chi</h2>
              </div>
              {cashflow.totalIn > 0 || cashflow.totalOut > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                        paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${fmtVND(value)}đ`}>
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Legend />
                      <Tooltip formatter={(v: unknown) => Number(v).toLocaleString('vi-VN') + 'đ'}
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-2 text-xs font-medium">
                    <span style={{ color: '#10b981' }}>Thu: {cashflow.totalIn.toLocaleString('vi-VN')}đ</span>
                    <span style={{ color: '#ef4444' }}>Chi: {cashflow.totalOut.toLocaleString('vi-VN')}đ</span>
                    <span style={{ color: cashflow.net >= 0 ? '#10b981' : '#ef4444' }}>
                      Ròng: {cashflow.net.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg p-8 text-center" style={{ background: 'var(--surface-alt)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chưa có dữ liệu thu chi.</p>
                </div>
              )}
            </section>
          </div>

          {/* Top Customers Table */}
          <section className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" style={{ color: 'var(--primary)' }}>
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Top khách hàng</h2>
            </div>
            {topCustomers.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="desktop-table">
                  <table className="styled-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Khách hàng</th>
                        <th className="text-right">Số đơn</th>
                        <th className="text-right">Tổng mua</th>
                        <th className="text-right">Nợ còn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCustomers.map((c, i) => (
                        <tr key={c.name}>
                          <td className="font-medium">{i + 1}</td>
                          <td className="font-medium">{c.name}</td>
                          <td className="text-right tabular-nums">{c.orders}</td>
                          <td className="text-right tabular-nums font-medium">{c.total.toLocaleString('vi-VN')}đ</td>
                          <td className="text-right tabular-nums" style={{ color: c.debt > 0 ? '#e11d48' : '#047857' }}>
                            {c.debt > 0 ? c.debt.toLocaleString('vi-VN') + 'đ' : '0đ'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="mobile-cards flex-col gap-2" style={{ display: 'none' }}>
                  {topCustomers.map((c, i) => (
                    <div key={c.name} className="mobile-card">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          #{i + 1} {c.name}
                        </span>
                        <span className="text-xs tabular-nums font-medium">{c.orders} đơn</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Tổng: <strong>{c.total.toLocaleString('vi-VN')}đ</strong></span>
                        <span style={{ color: c.debt > 0 ? '#e11d48' : '#047857' }}>
                          Nợ: {c.debt > 0 ? c.debt.toLocaleString('vi-VN') + 'đ' : '0đ'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg p-8 text-center" style={{ background: 'var(--surface-alt)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chưa có dữ liệu khách hàng.</p>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
