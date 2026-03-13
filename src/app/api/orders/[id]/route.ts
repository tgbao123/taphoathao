import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { SalesCoreError, updateSale, cancelSale } from '@/lib/server/salesCore'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { data: sale, error } = await supabase
    .from('sales')
    .select('id, sale_no, customer_id, created_at, subtotal, total_amount, paid_amount, debt_amount, status, note')
    .eq('id', id)
    .single()

  if (error || !sale) {
    return NextResponse.json({ error: { message: error?.message ?? 'Không tìm thấy đơn hàng' } }, { status: 404 })
  }

  // Items
  const { data: rawItems } = await supabase
    .from('sale_items')
    .select('id, product_id, qty, unit_price, line_total')
    .eq('sale_id', id)

  const items = rawItems ?? []
  const productIds = [...new Set(items.map((i) => i.product_id))]
  let productMap: Record<string, string> = {}
  if (productIds.length > 0) {
    const { data: products } = await supabase.from('products').select('id, name').in('id', productIds)
    productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p.name]))
  }

  // Customer
  let customer: { id: string; name: string; phone: string | null } | null = null
  if (sale.customer_id) {
    const { data: c } = await supabase.from('customers').select('id, name, phone').eq('id', sale.customer_id).single()
    customer = c
  }

  return NextResponse.json({
    data: {
      id: sale.id,
      saleNo: sale.sale_no,
      createdAt: sale.created_at,
      subtotal: Number(sale.subtotal),
      totalAmount: Number(sale.total_amount),
      paidAmount: Number(sale.paid_amount),
      debtAmount: Number(sale.debt_amount),
      status: sale.status,
      note: sale.note,
      customer,
      items: items.map((i) => ({
        id: i.id,
        productName: productMap[i.product_id] ?? '(đã xoá)',
        qty: i.qty,
        unitPrice: Number(i.unit_price),
        lineTotal: Number(i.line_total),
      })),
    },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: { message: 'Invalid body' } }, { status: 422 })
    }

    const result = await updateSale(id, {
      paidAmount: body.paidAmount !== undefined ? Number(body.paidAmount) : undefined,
      customerId: body.customerId !== undefined ? (body.customerId ? String(body.customerId) : null) : undefined,
      note: body.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SalesCoreError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.status })
    }
    return NextResponse.json({ error: { message: 'Unexpected error' } }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await cancelSale(id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SalesCoreError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.status })
    }
    return NextResponse.json({ error: { message: 'Unexpected error' } }, { status: 500 })
  }
}
