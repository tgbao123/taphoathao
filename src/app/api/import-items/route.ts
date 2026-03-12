import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const items = body.items

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: { message: 'items must be non-empty array' } },
        { status: 422 }
      )
    }

    const supabase = getSupabaseAdmin()

    const rows = items.map((item: { product_id: string; qty: number; import_price: number; note?: string }) => ({
      product_id: item.product_id,
      qty: item.qty,
      import_price: item.import_price ?? 0,
      note: item.note ?? null,
    }))

    const { error } = await supabase.from('import_items').insert(rows)

    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: { message } }, { status: 500 })
  }
}
