import { NextRequest, NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const supabase = getSupabaseAdmin()

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.phone !== undefined) updates.phone = body.phone || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: { message: 'No fields to update' } }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 400 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { error } = await supabase.from('customers').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: { message: error.message } }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
