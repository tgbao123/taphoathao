import { NextRequest, NextResponse } from 'next/server'

import { createUnit, listUnits } from '@/lib/server/inventory'
import { parseCreateUnitInput } from '@/lib/server/inventoryValidation'

type ApiError = { message?: string; code?: string }

function mapError(err: ApiError) {
  if (err.code === '23505') {
    return { status: 409, code: 'DUPLICATE', message: err.message ?? 'Duplicate unit code' }
  }

  return { status: 400, code: 'BAD_REQUEST', message: err.message ?? 'Request failed' }
}

export async function GET() {
  const { data, error } = await listUnits()

  if (error) {
    const mapped = mapError(error)
    return NextResponse.json({ error: mapped }, { status: mapped.status })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = parseCreateUnitInput(body)
    const { data, error } = await createUnit(input)

    if (error) {
      const mapped = mapError(error)
      return NextResponse.json({ error: mapped }, { status: mapped.status })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message } },
      { status: 422 }
    )
  }
}
