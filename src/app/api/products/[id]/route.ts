import { NextRequest, NextResponse } from 'next/server'

import { deleteProduct, getProductById, updateProduct } from '@/lib/server/inventory'
import { parseUpdateProductInput } from '@/lib/server/inventoryValidation'

type ApiError = { message?: string; code?: string }

function mapError(err: ApiError) {
  if (err.code === 'PGRST116') {
    return { status: 404, code: 'NOT_FOUND', message: 'Product not found' }
  }

  if (err.code === '23505') {
    return { status: 409, code: 'DUPLICATE', message: err.message ?? 'Duplicate product field' }
  }

  if (err.code === '23503') {
    return { status: 422, code: 'INVALID_REFERENCE', message: err.message ?? 'Invalid reference' }
  }

  return { status: 400, code: 'BAD_REQUEST', message: err.message ?? 'Request failed' }
}

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { data, error } = await getProductById(id)

  if (error) {
    const mapped = mapError(error)
    return NextResponse.json({ error: mapped }, { status: mapped.status })
  }

  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const input = parseUpdateProductInput(body)
    const { data, error } = await updateProduct(id, input)

    if (error) {
      const mapped = mapError(error)
      return NextResponse.json({ error: mapped }, { status: mapped.status })
    }

    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request'
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message } },
      { status: 422 }
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { error } = await deleteProduct(id)

  if (error) {
    const mapped = mapError(error)
    return NextResponse.json({ error: mapped }, { status: mapped.status })
  }

  return NextResponse.json({ ok: true })
}
