import { NextRequest, NextResponse } from 'next/server'

import { createCashflow, listCashflow } from '@/lib/server/customerCashflowCore'
import { parseCashflowQuery, parseCreateCashflowInput } from '@/lib/server/customerCashflowValidation'

type ApiError = { message?: string; code?: string }

function mapError(err: ApiError) {
  return { status: 400, code: 'BAD_REQUEST', message: err.message ?? 'Request failed' }
}

export async function GET(request: NextRequest) {
  try {
    const query = parseCashflowQuery(new URL(request.url).searchParams)
    const { data, error } = await listCashflow(query)

    if (error) {
      const mapped = mapError(error)
      return NextResponse.json({ error: mapped }, { status: mapped.status })
    }

    return NextResponse.json({ data: data?.items ?? [], pagination: data?.pagination ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message } }, { status: 422 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = parseCreateCashflowInput(body)
    const { data, error } = await createCashflow(input)

    if (error) {
      const mapped = mapError(error)
      return NextResponse.json({ error: mapped }, { status: mapped.status })
    }

    const normalized = data
      ? {
          id: data.id,
          txnType: data.txn_type,
          entryType: data.txn_type === 'in' ? 'inflow' : 'outflow',
          category: data.category,
          amount: Number(data.amount),
          occurredAt: data.occurred_at,
          method: data.method,
          note: data.note,
        }
      : null

    return NextResponse.json({ data: normalized }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message } }, { status: 422 })
  }
}
