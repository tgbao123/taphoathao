import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export type Unit = {
  id: string
  code: string
  name: string
  symbol: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Product = {
  id: string
  sku: string
  name: string
  unit_id: string
  barcode: string | null
  default_sell_price: number
  quantity: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ProductWithUnit = Product & {
  unit: Pick<Unit, 'id' | 'code' | 'name' | 'symbol'> | null
}

export type ProductBatch = {
  id: string
  product_id: string
  batch_no: string | null
  import_price: number
  sell_price: number
  qty_in: number
  qty_remaining: number
  imported_at: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type CreateUnitInput = {
  code: string
  name: string
  symbol?: string
}

export type CreateProductInput = {
  sku: string
  name: string
  unit_id: string
  barcode?: string
  default_sell_price?: number
  quantity?: number
  is_active?: boolean
}

export type UpdateProductInput = Partial<{
  sku: string
  name: string
  unit_id: string
  barcode: string | null
  default_sell_price: number
  quantity: number
  is_active: boolean
}>

export type CreateBatchInput = {
  product_id: string
  batch_no?: string
  import_price: number
  sell_price: number
  qty_in: number
  qty_remaining?: number
  imported_at?: string
  expires_at?: string
}

export async function listUnits() {
  const supabase = getSupabaseAdmin()
  return supabase.from('units').select('*').order('name', { ascending: true })
}

export async function createUnit(input: CreateUnitInput) {
  const supabase = getSupabaseAdmin()
  return supabase
    .from('units')
    .insert({
      code: input.code,
      name: input.name,
      symbol: input.symbol ?? null,
    })
    .select('*')
    .single()
}

export async function listProducts(opts?: { limit?: number; offset?: number }) {
  const supabase = getSupabaseAdmin()
  const limit = opts?.limit ?? 1000
  const offset = opts?.offset ?? 0

  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })

  const { data, error } = await supabase
    .from('products')
    .select('*, unit:units(id, code, name, symbol)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { data: null, error }

  return {
    data: data ?? [],
    error: null,
    total: count ?? 0,
    hasMore: offset + limit < (count ?? 0),
  }
}

export async function getProductById(id: string) {
  const supabase = getSupabaseAdmin()
  return supabase
    .from('products')
    .select('*, unit:units(id, code, name, symbol)')
    .eq('id', id)
    .single()
}

export async function createProduct(input: CreateProductInput) {
  const supabase = getSupabaseAdmin()
  return supabase
    .from('products')
    .insert({
      sku: input.sku,
      name: input.name,
      unit_id: input.unit_id,
      barcode: input.barcode ?? null,
      default_sell_price: input.default_sell_price ?? 0,
      quantity: input.quantity ?? 0,
      is_active: input.is_active ?? true,
    })
    .select('*, unit:units(id, code, name, symbol)')
    .single()
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const supabase = getSupabaseAdmin()
  return supabase
    .from('products')
    .update(input)
    .eq('id', id)
    .select('*, unit:units(id, code, name, symbol)')
    .single()
}

export async function deleteProduct(id: string) {
  const supabase = getSupabaseAdmin()
  return supabase.from('products').delete().eq('id', id)
}

export async function listProductBatches(productId: string) {
  const supabase = getSupabaseAdmin()
  return supabase
    .from('product_batches')
    .select('*')
    .eq('product_id', productId)
    .order('imported_at', { ascending: false })
}

export async function createBatch(input: CreateBatchInput) {
  const supabase = getSupabaseAdmin()
  const qtyRemaining = input.qty_remaining ?? input.qty_in

  return supabase
    .from('product_batches')
    .insert({
      product_id: input.product_id,
      batch_no: input.batch_no ?? null,
      import_price: input.import_price,
      sell_price: input.sell_price,
      qty_in: input.qty_in,
      qty_remaining: qtyRemaining,
      imported_at: input.imported_at ?? new Date().toISOString(),
      expires_at: input.expires_at ?? null,
    })
    .select('*')
    .single()
}

export async function importBatches(inputs: CreateBatchInput[]) {
  const supabase = getSupabaseAdmin()

  const payload = inputs.map((input) => ({
    product_id: input.product_id,
    batch_no: input.batch_no ?? null,
    import_price: input.import_price,
    sell_price: input.sell_price,
    qty_in: input.qty_in,
    qty_remaining: input.qty_remaining ?? input.qty_in,
    imported_at: input.imported_at ?? new Date().toISOString(),
    expires_at: input.expires_at ?? null,
  }))

  return supabase.from('product_batches').insert(payload).select('*')
}
