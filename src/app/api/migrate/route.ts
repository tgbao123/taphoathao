import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function POST() {
  const supabase = getSupabaseAdmin()

  // Try to add quantity column - if already exists, the insert test will work
  const { error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 0;',
  })

  if (error) {
    // If rpc doesn't exist, try a workaround: just test if column exists
    const testResult = await supabase.from('products').select('quantity').limit(1)
    if (testResult.error) {
      return NextResponse.json(
        {
          error: 'quantity column does not exist. Please run this SQL in Supabase Dashboard → SQL Editor:\n\nALTER TABLE products ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 0;',
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ message: 'quantity column already exists' })
  }

  return NextResponse.json({ message: 'quantity column added successfully' })
}
