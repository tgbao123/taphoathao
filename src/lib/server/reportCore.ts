import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

type DateRange = { from: string | null; to: string | null }

export function parseDateRange(searchParams: URLSearchParams): DateRange {
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  return {
    from: from && !Number.isNaN(Date.parse(from)) ? from : null,
    to: to && !Number.isNaN(Date.parse(to)) ? to : null,
  }
}

// ========== Revenue by Day ==========
export async function getRevenueByDay(range: DateRange) {
  const supabase = getSupabaseAdmin()

  let q = supabase
    .from('sales')
    .select('total_amount, paid_amount, debt_amount, created_at, status')
    .neq('status', 'cancelled')

  if (range.from) q = q.gte('created_at', range.from)
  if (range.to) q = q.lte('created_at', range.to)

  const { data, error } = await q.order('created_at', { ascending: true })
  if (error) return { data: null, error }

  // Group by date (YYYY-MM-DD)
  const dayMap = new Map<string, { revenue: number; orders: number; debt: number }>()
  for (const row of data ?? []) {
    const day = new Date(row.created_at).toISOString().slice(0, 10)
    const prev = dayMap.get(day) ?? { revenue: 0, orders: 0, debt: 0 }
    prev.revenue += Number(row.total_amount ?? 0)
    prev.orders += 1
    prev.debt += Number(row.debt_amount ?? 0)
    dayMap.set(day, prev)
  }

  const items = Array.from(dayMap.entries()).map(([date, d]) => ({
    date,
    revenue: d.revenue,
    orders: d.orders,
    debt: d.debt,
  }))

  return { data: items, error: null }
}

// ========== Top Products (by qty sold) ==========
export async function getTopProducts(range: DateRange, limit = 5) {
  const supabase = getSupabaseAdmin()

  // Get sale IDs in range
  let salesQ = supabase
    .from('sales')
    .select('id, created_at')
    .neq('status', 'cancelled')
  if (range.from) salesQ = salesQ.gte('created_at', range.from)
  if (range.to) salesQ = salesQ.lte('created_at', range.to)

  const { data: sales, error: salesErr } = await salesQ
  if (salesErr) return { data: null, error: salesErr }

  const saleIds = (sales ?? []).map((s) => s.id)
  if (saleIds.length === 0) return { data: [], error: null }

  const { data: items, error: itemsErr } = await supabase
    .from('sale_items')
    .select('product_id, qty, line_total')
    .in('sale_id', saleIds)
  if (itemsErr) return { data: null, error: itemsErr }

  // Aggregate by product
  const prodMap = new Map<string, { qty: number; revenue: number }>()
  for (const item of items ?? []) {
    const prev = prodMap.get(item.product_id) ?? { qty: 0, revenue: 0 }
    prev.qty += Number(item.qty)
    prev.revenue += Number(item.line_total)
    prodMap.set(item.product_id, prev)
  }

  // Get product names
  const prodIds = [...prodMap.keys()]
  const { data: prods } = await supabase.from('products').select('id, name').in('id', prodIds)
  const nameMap = new Map((prods ?? []).map((p) => [p.id, p.name]))

  const sorted = Array.from(prodMap.entries())
    .map(([id, d]) => ({ name: nameMap.get(id) ?? '—', qty: d.qty, revenue: d.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)

  return { data: sorted, error: null }
}

// ========== Top Customers (by purchase amount) ==========
export async function getTopCustomers(range: DateRange, limit = 5) {
  const supabase = getSupabaseAdmin()

  let q = supabase
    .from('sales')
    .select('customer_id, total_amount, debt_amount, created_at')
    .neq('status', 'cancelled')
    .not('customer_id', 'is', null)
  if (range.from) q = q.gte('created_at', range.from)
  if (range.to) q = q.lte('created_at', range.to)

  const { data, error } = await q
  if (error) return { data: null, error }

  const custMap = new Map<string, { total: number; orders: number; debt: number }>()
  for (const row of data ?? []) {
    const prev = custMap.get(row.customer_id) ?? { total: 0, orders: 0, debt: 0 }
    prev.total += Number(row.total_amount ?? 0)
    prev.orders += 1
    prev.debt += Number(row.debt_amount ?? 0)
    custMap.set(row.customer_id, prev)
  }

  const custIds = [...custMap.keys()]
  if (custIds.length === 0) return { data: [], error: null }

  const { data: custs } = await supabase.from('customers').select('id, name').in('id', custIds)
  const nameMap = new Map((custs ?? []).map((c) => [c.id, c.name]))

  const sorted = Array.from(custMap.entries())
    .map(([id, d]) => ({ name: nameMap.get(id) ?? '—', total: d.total, orders: d.orders, debt: d.debt }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)

  return { data: sorted, error: null }
}

// ========== Cashflow Summary (income vs expense by category) ==========
export async function getCashflowSummary(range: DateRange) {
  const supabase = getSupabaseAdmin()

  let q = supabase.from('cash_transactions').select('txn_type, category, amount, occurred_at')
  if (range.from) q = q.gte('occurred_at', range.from)
  if (range.to) q = q.lte('occurred_at', range.to)

  const { data, error } = await q
  if (error) return { data: null, error }

  let totalIn = 0
  let totalOut = 0
  const catMap = new Map<string, { income: number; expense: number }>()

  for (const row of data ?? []) {
    const amount = Number(row.amount ?? 0)
    const cat = row.category ?? 'Khác'
    const prev = catMap.get(cat) ?? { income: 0, expense: 0 }
    if (row.txn_type === 'in') {
      totalIn += amount
      prev.income += amount
    } else {
      totalOut += amount
      prev.expense += amount
    }
    catMap.set(cat, prev)
  }

  const byCategory = Array.from(catMap.entries())
    .map(([category, d]) => ({ category, income: d.income, expense: d.expense }))
    .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))

  return {
    data: { totalIn, totalOut, net: totalIn - totalOut, byCategory },
    error: null,
  }
}
