import { NextRequest, NextResponse } from 'next/server'

import { getSummaryKpis } from '@/lib/server/customerCashflowCore'

type ApiError = { message?: string; code?: string }

function mapError(err: ApiError) {
  return { status: 400, code: 'BAD_REQUEST', message: err.message ?? 'Request failed' }
}

export async function GET(request: NextRequest) {
  const { data, error } = await getSummaryKpis(new URL(request.url).searchParams)

  if (error) {
    const mapped = mapError(error)
    return NextResponse.json({ error: mapped }, { status: mapped.status })
  }

  return NextResponse.json({ data: data ?? { revenue: 0, debt: 0, products: 0, cashflowNet: 0 } })
}
