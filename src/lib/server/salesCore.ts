import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export type SalesCoreErrorCode =
  | 'INSUFFICIENT_STOCK'
  | 'INVALID_PAYLOAD'
  | 'SALE_CREATE_FAILED'

export class SalesCoreError extends Error {
  code: SalesCoreErrorCode
  status: number
  details: string | null

  constructor(input: { code: SalesCoreErrorCode; status: number; message: string; details?: string | null }) {
    super(input.message)
    this.name = 'SalesCoreError'
    this.code = input.code
    this.status = input.status
    this.details = input.details ?? null
  }
}

type SaleItem = {
  skuId: string
  qty: number
  unitPrice: number
}

type CreateSalePayload = {
  items: SaleItem[]
  note?: string
  customerId?: string
  paidAmount?: number
}

export async function createSale(input: { payload: CreateSalePayload; idempotencyKey?: string | null }) {
  const supabase = getSupabaseAdmin()
  const { items, note, customerId } = input.payload

  if (!items || items.length === 0) {
    throw new SalesCoreError({
      code: 'INVALID_PAYLOAD',
      status: 422,
      message: 'Giỏ hàng trống',
    })
  }

  const totalAmount = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  const paidAmount = input.payload.paidAmount !== undefined
    ? Math.min(Math.max(0, input.payload.paidAmount), totalAmount)
    : totalAmount
  const debtAmount = totalAmount - paidAmount

  // 1. Create sale record
  const saleNo = `SO-${Date.now()}`
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      sale_no: saleNo,
      subtotal: totalAmount,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      debt_amount: debtAmount,
      note: note ?? null,
      customer_id: customerId ?? null,
    })
    .select('id')
    .single()

  if (saleError || !sale) {
    throw new SalesCoreError({
      code: 'SALE_CREATE_FAILED',
      status: 400,
      message: saleError?.message ?? 'Không tạo được đơn bán',
    })
  }

  // 2. Insert sale items
  const saleItems = items.map((item) => ({
    sale_id: sale.id,
    product_id: item.skuId,
    qty: item.qty,
    unit_price: item.unitPrice,
    line_total: item.qty * item.unitPrice,
  }))

  const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)

  if (itemsError) {
    // Rollback: delete the sale
    await supabase.from('sales').delete().eq('id', sale.id)
    throw new SalesCoreError({
      code: 'SALE_CREATE_FAILED',
      status: 400,
      message: itemsError.message ?? 'Không tạo được chi tiết đơn bán',
    })
  }

  // 4. Record cashflow entry (Thu - income from sale, only paid amount)
  let customerName = ''
  if (customerId && debtAmount > 0) {
    const { data: cust } = await supabase.from('customers').select('name').eq('id', customerId).single()
    customerName = cust?.name ?? ''
  }

  if (paidAmount > 0) {
    let cashNote = `Đơn ${saleNo}`
    if (debtAmount > 0) {
      cashNote += ` | Nợ: ${debtAmount.toLocaleString('vi-VN')}đ`
      if (customerName) cashNote += ` — KH: ${customerName}`
    }
    await supabase.from('cash_transactions').insert({
      txn_type: 'in',
      category: 'Bán hàng',
      amount: paidAmount,
      note: cashNote,
    })
  }

  return { saleId: sale.id, totalAmount, paidAmount, debtAmount }
}

// ========== List Orders ==========
export async function listOrders(opts?: { limit?: number; offset?: number }) {
  const supabase = getSupabaseAdmin()
  const limit = opts?.limit ?? 20
  const offset = opts?.offset ?? 0

  // Get total count
  const { count } = await supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })

  const { data, error } = await supabase
    .from('sales')
    .select('id, sale_no, customer_id, created_at, subtotal, total_amount, paid_amount, debt_amount, status, note')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new SalesCoreError({ code: 'SALE_CREATE_FAILED', status: 400, message: error.message })
  }

  const sales = data ?? []
  const total = count ?? 0

  // Get unique customer IDs
  const custIds = [...new Set(sales.map((s) => s.customer_id).filter(Boolean) as string[])]
  const custMap = new Map<string, { id: string; name: string; phone: string | null }>()
  if (custIds.length > 0) {
    const { data: custs } = await supabase.from('customers').select('id, name, phone').in('id', custIds)
    for (const c of custs ?? []) custMap.set(c.id, c)
  }

  // Get sale items with product names
  const saleIds = sales.map((s) => s.id)
  const itemMap = new Map<string, Array<{ id: string; productName: string; qty: number; unitPrice: number; lineTotal: number }>>()
  if (saleIds.length > 0) {
    const { data: items } = await supabase
      .from('sale_items')
      .select('id, sale_id, product_id, qty, unit_price, line_total')
      .in('sale_id', saleIds)

    // Get product names
    const prodIds = [...new Set((items ?? []).map((i) => i.product_id))]
    const prodMap = new Map<string, string>()
    if (prodIds.length > 0) {
      const { data: prods } = await supabase.from('products').select('id, name').in('id', prodIds)
      for (const p of prods ?? []) prodMap.set(p.id, p.name)
    }

    for (const item of items ?? []) {
      const arr = itemMap.get(item.sale_id) ?? []
      arr.push({
        id: item.id,
        productName: prodMap.get(item.product_id) ?? '—',
        qty: Number(item.qty),
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total),
      })
      itemMap.set(item.sale_id, arr)
    }
  }

  const items = sales.map((s) => ({
    id: s.id,
    saleNo: s.sale_no,
    soldAt: s.created_at,
    subtotal: Number(s.subtotal),
    totalAmount: Number(s.total_amount),
    paidAmount: Number(s.paid_amount),
    debtAmount: Number(s.debt_amount),
    status: s.status,
    note: s.note,
    customer: s.customer_id ? custMap.get(s.customer_id) ?? null : null,
    items: itemMap.get(s.id) ?? [],
  }))

  return { data: items, total, hasMore: offset + limit < total }
}

// ========== Update Sale (payment info) ==========
export async function updateSale(saleId: string, updates: {
  paidAmount?: number
  customerId?: string | null
  note?: string | null
}) {
  const supabase = getSupabaseAdmin()

  // Get current sale
  const { data: current, error: fetchErr } = await supabase
    .from('sales')
    .select('id, sale_no, total_amount, paid_amount, status')
    .eq('id', saleId)
    .single()

  if (fetchErr || !current) {
    throw new SalesCoreError({ code: 'INVALID_PAYLOAD', status: 404, message: 'Không tìm thấy đơn hàng' })
  }
  if (current.status === 'cancelled') {
    throw new SalesCoreError({ code: 'INVALID_PAYLOAD', status: 400, message: 'Đơn đã huỷ, không thể sửa' })
  }

  const totalAmount = Number(current.total_amount)
  const updateData: Record<string, unknown> = {}

  if (updates.paidAmount !== undefined) {
    const paid = Math.min(Math.max(0, updates.paidAmount), totalAmount)
    updateData.paid_amount = paid
    updateData.debt_amount = totalAmount - paid
  }
  if (updates.customerId !== undefined) {
    updateData.customer_id = updates.customerId || null
  }
  if (updates.note !== undefined) {
    updateData.note = updates.note || null
  }

  const { error: updateErr } = await supabase
    .from('sales')
    .update(updateData)
    .eq('id', saleId)

  if (updateErr) {
    throw new SalesCoreError({ code: 'SALE_CREATE_FAILED', status: 400, message: updateErr.message })
  }

  // Sync cashflow: update or create/delete
  const newPaid = updates.paidAmount !== undefined
    ? Math.min(Math.max(0, updates.paidAmount), totalAmount)
    : Number(current.paid_amount)

  // Delete old cashflow for this sale
  await supabase.from('cash_transactions').delete().ilike('note', `%${current.sale_no}%`)

  // Re-create if paid > 0
  if (newPaid > 0) {
    const debtAmount = totalAmount - newPaid
    let cashNote = `Đơn ${current.sale_no}`
    if (debtAmount > 0) {
      // Get customer name
      const custId = updates.customerId !== undefined ? updates.customerId : null
      if (custId) {
        const { data: cust } = await supabase.from('customers').select('name').eq('id', custId).single()
        if (cust?.name) cashNote += ` | Nợ: ${debtAmount.toLocaleString('vi-VN')}đ — KH: ${cust.name}`
        else cashNote += ` | Nợ: ${debtAmount.toLocaleString('vi-VN')}đ`
      } else {
        cashNote += ` | Nợ: ${debtAmount.toLocaleString('vi-VN')}đ`
      }
    }
    await supabase.from('cash_transactions').insert({
      txn_type: 'in',
      category: 'Bán hàng',
      amount: newPaid,
      note: cashNote,
    })
  }

  return { success: true }
}

// ========== Cancel Sale ==========
export async function cancelSale(saleId: string) {
  const supabase = getSupabaseAdmin()

  const { data: current, error: fetchErr } = await supabase
    .from('sales')
    .select('id, sale_no, status')
    .eq('id', saleId)
    .single()

  if (fetchErr || !current) {
    throw new SalesCoreError({ code: 'INVALID_PAYLOAD', status: 404, message: 'Không tìm thấy đơn hàng' })
  }
  if (current.status === 'cancelled') {
    throw new SalesCoreError({ code: 'INVALID_PAYLOAD', status: 400, message: 'Đơn đã huỷ rồi' })
  }

  // Set paid=0, debt=0 first (to satisfy constraint), then set status
  const { error: updateErr } = await supabase
    .from('sales')
    .update({ status: 'cancelled', paid_amount: 0, debt_amount: 0, total_amount: 0, subtotal: 0 })
    .eq('id', saleId)

  if (updateErr) {
    throw new SalesCoreError({ code: 'SALE_CREATE_FAILED', status: 400, message: updateErr.message })
  }

  // Delete cashflow entries
  await supabase.from('cash_transactions').delete().ilike('note', `%${current.sale_no}%`)

  return { success: true }
}
