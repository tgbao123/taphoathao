import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET() {
  const supabase = getSupabaseAdmin()

  // Get total imported per product
  const { data: imports } = await supabase
    .from('import_items')
    .select('product_id, qty')

  // Get total sold per product
  const { data: sales } = await supabase
    .from('sale_items')
    .select('product_id, qty')

  // Calculate stock per product
  const stockMap: Record<string, number> = {}

  for (const item of imports ?? []) {
    stockMap[item.product_id] = (stockMap[item.product_id] ?? 0) + item.qty
  }

  for (const item of sales ?? []) {
    stockMap[item.product_id] = (stockMap[item.product_id] ?? 0) - item.qty
  }

  return NextResponse.json({ data: stockMap })
}
