import { type NextRequest, NextResponse } from 'next/server'

import { SalesCoreError, listOrders } from '@/lib/server/salesCore'

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl
    const limit = Math.min(Number(url.searchParams.get('limit') || 20), 100)
    const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0)

    const result = await listOrders({ limit, offset })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SalesCoreError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.status })
    }
    return NextResponse.json({ error: { message: 'Unexpected error' } }, { status: 500 })
  }
}
