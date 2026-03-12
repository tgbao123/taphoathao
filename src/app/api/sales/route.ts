import { NextRequest, NextResponse } from 'next/server'

import { SalesCoreError, createSale } from '@/lib/server/salesCore'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: NextRequest) {
  try {
    const idempotencyKey = request.headers.get('idempotency-key')
    const body = await request.json()

    if (!isRecord(body)) {
      return NextResponse.json({ error: { code: 'INVALID_PAYLOAD', message: 'Body must be an object' } }, { status: 422 })
    }

    const items = body.items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: { code: 'INVALID_PAYLOAD', message: 'items must be non-empty array' } }, { status: 422 })
    }

    const parsedItems = items.map((item, idx) => {
      if (!isRecord(item)) throw new Error(`items[${idx}] must be object`)
      const skuId = String(item.skuId ?? '').trim()
      if (!skuId) throw new Error(`items[${idx}].skuId is required`)
      const qty = Number(item.qty)
      if (!Number.isFinite(qty) || qty <= 0) throw new Error(`items[${idx}].qty must be > 0`)
      const unitPrice = Number(item.unitPrice)
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`items[${idx}].unitPrice must be >= 0`)
      return { skuId, qty, unitPrice }
    })

    const data = await createSale({
      payload: {
        items: parsedItems,
        note: body.note ? String(body.note) : undefined,
        customerId: body.customerId ? String(body.customerId) : undefined,
      },
      idempotencyKey,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof SalesCoreError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.status }
      )
    }

    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json(
      { error: { code: 'INVALID_PAYLOAD', message } },
      { status: 422 }
    )
  }
}
