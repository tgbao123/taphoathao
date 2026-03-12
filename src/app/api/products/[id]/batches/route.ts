import { NextRequest, NextResponse } from 'next/server'

import { listProductBatches } from '@/lib/server/inventory'

type ApiError = { message?: string; code?: string }

function mapError(err: ApiError) {
  if (err.code === '22P02') {
    return { status: 422, code: 'INVALID_ID', message: 'Invalid product id' }
  }

  return { status: 400, code: 'BAD_REQUEST', message: err.message ?? 'Request failed' }
}

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { data, error } = await listProductBatches(id)

  if (error) {
    const mapped = mapError(error)
    return NextResponse.json({ error: mapped }, { status: mapped.status })
  }

  return NextResponse.json({ data: data ?? [] })
}
