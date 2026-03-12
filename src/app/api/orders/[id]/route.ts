import { NextRequest, NextResponse } from 'next/server'

import { SalesCoreError, updateSale, cancelSale } from '@/lib/server/salesCore'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: { message: 'Invalid body' } }, { status: 422 })
    }

    const result = await updateSale(id, {
      paidAmount: body.paidAmount !== undefined ? Number(body.paidAmount) : undefined,
      customerId: body.customerId !== undefined ? (body.customerId ? String(body.customerId) : null) : undefined,
      note: body.note !== undefined ? (body.note ? String(body.note) : null) : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SalesCoreError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.status })
    }
    return NextResponse.json({ error: { message: 'Unexpected error' } }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await cancelSale(id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SalesCoreError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.status })
    }
    return NextResponse.json({ error: { message: 'Unexpected error' } }, { status: 500 })
  }
}
