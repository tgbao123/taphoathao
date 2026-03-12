# Spec API: Tạo Sale với 2 mode allocate tồn kho

## 1) Mục tiêu

API tạo đơn bán (`sale`) và trừ tồn theo 2 cơ chế:

1. **`MANUAL_LOT`**: client chỉ định rõ batch/lot và số lượng lấy từ từng batch.
2. **`AUTO_FIFO`** (retail): server tự allocate theo FIFO (batch nhập sớm trước xuất trước).

Yêu cầu:
- ACID transaction.
- Chặn race condition khi nhiều request cùng xuất cùng SKU.
- Trả chi tiết allocation theo lot.
- Xử lý thiếu tồn rõ ràng.

---

## 2) Endpoint & Contract

### Endpoint
`POST /v1/sales`

### Headers
- `Authorization: Bearer <token>`
- `Idempotency-Key: <uuid>` (khuyến nghị mạnh để chống tạo trùng khi retry)

### Body (high-level)
- Thông tin đơn hàng: `storeId`, `customerId`, `currency`, `items[]`
- Mỗi item có:
- `skuId`
- `qty`
- `unitPrice`
- `allocationMode`: `MANUAL_LOT` | `AUTO_FIFO`
- `manualLots[]` (bắt buộc nếu mode manual)

---

## 3) Validation Rules

## 3.1 Common
- `qty > 0`, `unitPrice >= 0`.
- Không cho phép duplicate SKU nhiều dòng (hoặc normalize server-side).
- `storeId`, `skuId`, `lotId` phải tồn tại và active.
- Đơn vị tính phải đồng nhất (nếu có UOM conversion thì convert trước transaction).

## 3.2 `MANUAL_LOT`
- `manualLots` bắt buộc, không rỗng.
- `sum(manualLots.qty) == item.qty`.
- Mỗi `manualLots.qty > 0`.
- Lot phải thuộc đúng `storeId` + `skuId`.
- Lot hết hạn / bị lock / không cho bán => reject theo policy.

## 3.3 `AUTO_FIFO`
- Không nhận `manualLots` (hoặc ignore có cảnh báo, tùy policy).
- Server tự tìm các lot còn tồn theo `receivedAt ASC, lotId ASC`.

---

## 4) Data model tối thiểu (gợi ý)

- `inventory_lot`
- `lot_id`, `store_id`, `sku_id`
- `received_at`, `expiry_at`
- `qty_in`, `qty_out`, `qty_reserved`
- `version` (optimistic lock) hoặc dùng row lock
- `sales`
- `sale_id`, `store_id`, `status`, `total_amount`, `created_at`, `idempotency_key`
- `sale_items`
- `sale_item_id`, `sale_id`, `sku_id`, `qty`, `unit_price`, `line_amount`
- `sale_allocations`
- `sale_item_id`, `lot_id`, `qty`, `cost_unit` (optional)

`available_qty = qty_in - qty_out - qty_reserved`

---

## 5) Transaction Flow (chuẩn)

1. Bắt đầu DB transaction (`READ COMMITTED` hoặc `REPEATABLE READ`).
2. Check idempotency key:
- Nếu key đã xử lý thành công => trả response cũ.
3. Validate request schema + business rules.
4. Với từng line item, lock tồn cần dùng (`SELECT ... FOR UPDATE`).
5. Allocate theo mode.
6. Nếu item nào thiếu tồn => rollback toàn bộ.
7. Insert `sales`, `sale_items`, `sale_allocations`.
8. Update `inventory_lot.qty_out += allocatedQty` (và `version++` nếu dùng optimistic).
9. Commit.
10. Publish event async sau commit: `sale.created`.

---

## 6) Pseudo-code

```pseudo
function createSale(request, idempotencyKey):
begin transaction

existing = findSaleByIdempotencyKey(idempotencyKey)
if existing:
commit
return existing.response

validateRequest(request)

allocationsByItem = {}

for item in request.items:
if item.allocationMode == "MANUAL_LOT":
allocs = allocateManual(item, request.storeId)
else if item.allocationMode == "AUTO_FIFO":
allocs = allocateAutoFIFO(item, request.storeId)
else:
rollback
throw ERROR_INVALID_ALLOCATION_MODE

allocationsByItem[item.clientLineId] = allocs

sale = insertSaleHeader(request, idempotencyKey)

for item in request.items:
saleItem = insertSaleItem(sale.id, item)
for alloc in allocationsByItem[item.clientLineId]:
insertSaleAllocation(saleItem.id, alloc.lotId, alloc.qty, alloc.costUnit)
updateInventoryLotOut(alloc.lotId, alloc.qty) // qty_out += qty

commit

response = buildResponse(sale.id)
persistIdempotencyResponse(idempotencyKey, response)

return response
```

### `allocateManual`
```pseudo
function allocateManual(item, storeId):
assert item.manualLots not empty
assert sum(item.manualLots.qty) == item.qty

result = []
for ml in item.manualLots:
lot = select * from inventory_lot
where lot_id = ml.lotId
and store_id = storeId
and sku_id = item.skuId
for update

if lot not found:
throw ERROR_LOT_NOT_FOUND

available = lot.qty_in - lot.qty_out - lot.qty_reserved
if available < ml.qty:
throw ERROR_INSUFFICIENT_STOCK_LOT(lotId=ml.lotId, requested=ml.qty, available=available)

result.append({lotId: lot.lot_id, qty: ml.qty, costUnit: computeCost(lot)})
return result
```

### `allocateAutoFIFO`
```pseudo
function allocateAutoFIFO(item, storeId):
need = item.qty
result = []

lots = select * from inventory_lot
where store_id = storeId
and sku_id = item.skuId
and (qty_in - qty_out - qty_reserved) > 0
and status = 'ACTIVE'
order by received_at asc, lot_id asc
for update

for lot in lots:
if need == 0: break
available = lot.qty_in - lot.qty_out - qty_reserved

take = min(available, need)
if take > 0:
result.append({lotId: lot.lot_id, qty: take, costUnit: computeCost(lot)})
need -= take

if need > 0:
throw ERROR_INSUFFICIENT_STOCK_SKU(skuId=item.skuId, missing=need)

return result
```

---

## 7) Concurrency Strategy

### Option A: Pessimistic lock
- `SELECT ... FOR UPDATE` trên các lot liên quan.

### Option B: Optimistic lock (`version`)
- update với điều kiện version; conflict thì retry.

Khuyến nghị retail: bắt đầu Option A.

---

## 8) Edge cases
- Thiếu tồn SKU (AUTO_FIFO) → 409
- Thiếu tồn lot (MANUAL_LOT) → 409
- manualLots sum != qty → 422
- Lot mismatch → 422
- Retry/idempotency
- Deadlock → retry 2–3 lần

---

## 9) JSON mẫu

### Request
```json
{
  "storeId": "store_hcm_01",
  "customerId": "cus_123",
  "currency": "VND",
  "note": "Bán tại quầy",
  "items": [
    {
      "clientLineId": "line-1",
      "skuId": "sku_milk_1l",
      "qty": 6,
      "unitPrice": 32000,
      "allocationMode": "MANUAL_LOT",
      "manualLots": [
        { "lotId": "lot_milk_20260201", "qty": 4 },
        { "lotId": "lot_milk_20260215", "qty": 2 }
      ]
    },
    {
      "clientLineId": "line-2",
      "skuId": "sku_bread",
      "qty": 3,
      "unitPrice": 18000,
      "allocationMode": "AUTO_FIFO"
    }
  ]
}
```

### Success response
```json
{
  "saleId": "sale_20260311_000123",
  "status": "COMPLETED",
  "storeId": "store_hcm_01",
  "currency": "VND",
  "subTotal": 246000,
  "discountTotal": 0,
  "taxTotal": 0,
  "grandTotal": 246000,
  "createdAt": "2026-03-11T09:10:02Z",
  "items": [
    {
      "saleItemId": "sitem_1",
      "clientLineId": "line-1",
      "skuId": "sku_milk_1l",
      "qty": 6,
      "unitPrice": 32000,
      "lineAmount": 192000,
      "allocations": [
        { "lotId": "lot_milk_20260201", "qty": 4 },
        { "lotId": "lot_milk_20260215", "qty": 2 }
      ]
    }
  ]
}
```
