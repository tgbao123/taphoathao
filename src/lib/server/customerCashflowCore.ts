import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import type {
  CashflowQuery,
  CreateCashflowInput,
  CreateCustomerInput,
  CustomerQuery,
} from '@/lib/server/customerCashflowValidation'

type ApiErrorLike = {
  message?: string
  code?: string
  details?: string
}

export async function listCustomers(query: CustomerQuery) {
  const supabase = getSupabaseAdmin()

  let builder = supabase
    .from('customers')
    .select('id, name, phone, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (query.q) {
    const escaped = query.q.replace(/[%_,]/g, '')
    builder = builder.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%`)
  }

  const from = query.offset
  const to = query.offset + query.limit - 1

  const { data: rows, error, count } = await builder.range(from, to)
  if (error) return { data: null, error }

  return {
    data: {
      items:
        rows?.map((row) => ({
          id: row.id,
          name: row.name,
          phone: row.phone,
        })) ?? [],
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: count ?? 0,
      },
    },
    error: null,
  }
}

export async function createCustomer(input: CreateCustomerInput) {
  const supabase = getSupabaseAdmin()
  return supabase
    .from('customers')
    .insert({
      name: input.name,
      code: input.code ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      note: input.note ?? null,
      opening_debt: input.opening_debt ?? 0,
      is_active: input.is_active ?? true,
    })
    .select('id, name, phone, opening_debt, created_at')
    .single()
}

export async function listCashflow(query: CashflowQuery) {
  const supabase = getSupabaseAdmin()

  let builder = supabase
    .from('cash_transactions')
    .select('id, txn_type, category, amount, occurred_at, method, note, created_at', { count: 'exact' })
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })

  if (query.txnType) {
    builder = builder.eq('txn_type', query.txnType)
  }

  if (query.category) {
    const escaped = query.category.replace(/[%_,]/g, '')
    builder = builder.ilike('category', `%${escaped}%`)
  }

  if (query.from) {
    builder = builder.gte('occurred_at', query.from)
  }

  if (query.to) {
    builder = builder.lte('occurred_at', query.to)
  }

  const from = query.offset
  const to = query.offset + query.limit - 1

  const { data, error, count } = await builder.range(from, to)
  if (error) return { data: null, error }

  // Cross-reference sales for debt info
  const saleNos: string[] = []
  for (const item of data ?? []) {
    if (item.category === 'Bán hàng' && item.note) {
      const noteStr = String(item.note)
      const match = noteStr.match(/Đơn (SO-\d+)/)
      if (match?.[1]) saleNos.push(match[1])
    }
  }

  const saleMap = new Map<string, { debtAmount: number; customerName: string | null }>()
  if (saleNos.length > 0) {
    const { data: sales } = await supabase
      .from('sales')
      .select('sale_no, debt_amount, customer_id')
      .in('sale_no', saleNos)

    // Collect unique customer IDs
    const customerIds = [...new Set(
      (sales ?? []).map((s) => s.customer_id).filter(Boolean) as string[]
    )]

    // Fetch customer names in a separate query
    let customerMap = new Map<string, string>()
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds)
      for (const c of customers ?? []) {
        customerMap.set(c.id, c.name)
      }
    }

    for (const s of sales ?? []) {
      saleMap.set(s.sale_no, {
        debtAmount: Number(s.debt_amount ?? 0),
        customerName: s.customer_id ? customerMap.get(s.customer_id) ?? null : null,
      })
    }
  }

  return {
    data: {
      items:
        data?.map((item) => {
          const match = (item.note as string | null)?.match(/Đơn (SO-\d+)/)
          const saleInfo = match ? saleMap.get(match[1]) : undefined
          return {
            id: item.id,
            txnType: item.txn_type,
            entryType: item.txn_type === 'in' ? 'inflow' : 'outflow',
            category: item.category,
            amount: Number(item.amount),
            occurredAt: item.occurred_at,
            method: item.method,
            note: item.note,
            debtAmount: saleInfo?.debtAmount ?? 0,
            customerName: saleInfo?.customerName ?? null,
          }
        }) ?? [],
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: count ?? 0,
      },
    },
    error: null,
  }
}

export async function createCashflow(input: CreateCashflowInput) {
  const supabase = getSupabaseAdmin()

  return supabase
    .from('cash_transactions')
    .insert({
      txn_type: input.txnType,
      category: input.category,
      amount: input.amount,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      method: input.method ?? 'cash',
      note: input.note ?? null,
    })
    .select('id, txn_type, category, amount, occurred_at, method, note')
    .single()
}

function dateRange(searchParams: URLSearchParams) {
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  return {
    from: from && !Number.isNaN(Date.parse(from)) ? from : null,
    to: to && !Number.isNaN(Date.parse(to)) ? to : null,
  }
}

export async function getSummaryKpis(searchParams: URLSearchParams) {
  const supabase = getSupabaseAdmin()
  const range = dateRange(searchParams)

  let salesQ = supabase.from('sales').select('total_amount, debt_amount, created_at').neq('status', 'cancelled')
  if (range.from) salesQ = salesQ.gte('created_at', range.from)
  if (range.to) salesQ = salesQ.lte('created_at', range.to)

  let cashQ = supabase.from('cash_transactions').select('txn_type, amount, occurred_at')
  if (range.from) cashQ = cashQ.gte('occurred_at', range.from)
  if (range.to) cashQ = cashQ.lte('occurred_at', range.to)

  const [salesRes, cashRes, productsRes] = await Promise.all([
    salesQ,
    cashQ,
    supabase.from('products').select('id', { count: 'exact', head: true }),
  ])

  const firstError: ApiErrorLike | null = salesRes.error ?? cashRes.error ?? productsRes.error
  if (firstError) return { data: null, error: firstError }

  const revenue = (salesRes.data ?? []).reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0)
  const debtFromSales = (salesRes.data ?? []).reduce((sum, row) => sum + Number(row.debt_amount ?? 0), 0)

  const cashflowNet = (cashRes.data ?? []).reduce((sum, row) => {
    const amount = Number(row.amount ?? 0)
    return sum + (row.txn_type === 'in' ? amount : -amount)
  }, 0)

  return {
    data: {
      revenue,
      debt: debtFromSales || 0,
      products: productsRes.count ?? 0,
      cashflowNet,
    },
    error: null,
  }
}
