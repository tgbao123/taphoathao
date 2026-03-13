import { NextRequest, NextResponse } from 'next/server'
import { getTopCustomers, parseDateRange } from '@/lib/server/reportCore'

export async function GET(request: NextRequest) {
  const range = parseDateRange(new URL(request.url).searchParams)
  const { data, error } = await getTopCustomers(range)
  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 400 })
  return NextResponse.json({ data })
}
