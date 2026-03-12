import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const [{ data: imports }, { data: sales }] = await Promise.all([
    supabase
      .from('import_items')
      .select('id, qty, import_price, note, created_at')
      .eq('product_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('sale_items')
      .select('id, qty, unit_price, line_total, created_at')
      .eq('product_id', id)
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    imports: imports ?? [],
    sales: sales ?? [],
  })
}
