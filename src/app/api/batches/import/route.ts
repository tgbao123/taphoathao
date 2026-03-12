import { NextRequest, NextResponse } from 'next/server'

import { importBatches } from '@/lib/server/inventory'
import { parseImportBatchesInput } from '@/lib/server/inventoryValidation'

type ApiError = { message?: string; code?: string }

function mapError(err: ApiError) {
  if (err.code === '23503') {
    return { status: 422, code: 'INVALID_PRODUCT', message: err.message ?? 'Some product_id values are invalid' }
  }

  return { status: 400, code: 'BAD_REQUEST', message: err.message ?? 'Request failed' }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const inputs = parseImportBatchesInput(body)
    const { data, error } = await importBatches(inputs)

    if (error) {
      const mapped = mapError(error)
      return NextResponse.json({ error: mapped }, { status: mapped.status })
    }

    return NextResponse.json({ data: data ?? [] }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message } },
      { status: 422 }
    )
  }
}
