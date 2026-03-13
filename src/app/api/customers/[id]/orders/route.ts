import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getSupabaseAdmin()

  // Fetch customer info
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('id', id)
    .single()

  if (custErr || !customer) {
    return NextResponse.json({ error: { message: 'Không tìm thấy khách hàng' } }, { status: 404 })
  }

  // Fetch orders for this customer
  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('id, sale_no, created_at, subtotal, total_amount, paid_amount, debt_amount, status, note')
    .eq('customer_id', id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if (salesErr) {
    return NextResponse.json({ error: { message: salesErr.message } }, { status: 400 })
  }

  // Fetch sale items for all sales
  const saleIds = (sales ?? []).map((s) => s.id)
  let items: Array<{ id: string; sale_id: string; product_id: string; qty: number; unit_price: number; line_total: number }> = []

  if (saleIds.length > 0) {
    const { data: rawItems } = await supabase
      .from('sale_items')
      .select('id, sale_id, product_id, qty, unit_price, line_total')
      .in('sale_id', saleIds)
    items = rawItems ?? []
  }

  // Fetch product names
  const productIds = [...new Set(items.map((i) => i.product_id))]
  let productMap: Record<string, string> = {}
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds)
    productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p.name]))
  }

  // Combine
  const orders = (sales ?? []).map((s) => ({
    id: s.id,
    saleNo: s.sale_no,
    createdAt: s.created_at,
    totalAmount: Number(s.total_amount),
    paidAmount: Number(s.paid_amount),
    debtAmount: Number(s.debt_amount),
    status: s.status,
    note: s.note,
    items: items
      .filter((i) => i.sale_id === s.id)
      .map((i) => ({
        id: i.id,
        productName: productMap[i.product_id] ?? '(đã xoá)',
        qty: i.qty,
        unitPrice: Number(i.unit_price),
        lineTotal: Number(i.line_total),
      })),
  }))

  // Stats
  const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0)
  const totalDebt = orders.reduce((sum, o) => sum + o.debtAmount, 0)
  const orderCount = orders.length

  return NextResponse.json({
    data: {
      customer,
      stats: { totalSpent, totalDebt, orderCount },
      orders,
    },
  })
}
