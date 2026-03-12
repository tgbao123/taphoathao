import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET() {
  const supabase = getSupabaseAdmin()

  // Get total debt per customer from sales table
  const { data, error } = await supabase
    .from('sales')
    .select('customer_id, debt_amount')
    .not('customer_id', 'is', null)
    .gt('debt_amount', 0)

  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 400 })
  }

  const debtMap: Record<string, number> = {}
  for (const row of data ?? []) {
    const cid = String(row.customer_id)
    debtMap[cid] = (debtMap[cid] ?? 0) + Number(row.debt_amount ?? 0)
  }

  return NextResponse.json({ data: debtMap })
}
