import { NextResponse } from 'next/server'

import { SalesCoreError, listOrders } from '@/lib/server/salesCore'

export async function GET() {
  try {
    const orders = await listOrders()
    return NextResponse.json({ data: orders })
  } catch (error) {
    if (error instanceof SalesCoreError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.status })
    }
    return NextResponse.json({ error: { message: 'Unexpected error' } }, { status: 500 })
  }
}
