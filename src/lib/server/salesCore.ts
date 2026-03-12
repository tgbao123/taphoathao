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

  // 1. Create sale record
  const saleNo = `SO-${Date.now()}`
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      sale_no: saleNo,
      subtotal: totalAmount,
      total_amount: totalAmount,
      paid_amount: totalAmount,
      debt_amount: 0,
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

  // 4. Record cashflow entry (Thu - income from sale)
  await supabase.from('cash_transactions').insert({
    txn_type: 'in',
    category: 'Bán hàng',
    amount: totalAmount,
    note: `Đơn ${saleNo}`,
  })

  return { saleId: sale.id, totalAmount }
}
