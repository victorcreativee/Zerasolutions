// INSERT ... ON CONFLICT avoids a read-then-create race on a branch's first stock row.
export async function ensureInventoryStock(tx, { businessId, branchId, productId }) {
  await tx.inventoryStock.createMany({
    data: [{ businessId, branchId, productId, quantity: 0, reorderLevel: 0 }],
    skipDuplicates: true
  });
  return tx.inventoryStock.findUniqueOrThrow({ where: { productId_branchId: { productId, branchId } } });
}
