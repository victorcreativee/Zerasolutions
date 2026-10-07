import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { buildDateFilter, csvCell } from '../../utils/reportDates.js';
import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { getBusinessAccess } from '../../utils/businessAccess.js';
import { ensureInventoryStock } from '../../utils/inventoryStock.js';
import { isDesktopSyncEnabled } from '../../utils/syncQueue.js';
import { HttpError } from '../../utils/httpError.js';

export const purchasingRouter = Router();
purchasingRouter.use(requireAuth);
const roles = ['Owner', 'Manager', 'Store Keeper', 'Pharmacist'];
const managers = ['Owner', 'Manager'];
const include = { receipts: { orderBy: { createdAt: 'desc' }, include: { receivedBy: { select: { id: true, name: true } } } }, supplier: true, branch: { select: { id: true, name: true } }, items: true,
  createdBy: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } }, receivedBy: { select: { id: true, name: true } } };
async function access(req, approve = false) {
  const result = await getBusinessAccess(req.user, req.params.businessId);
  if (req.user.systemRole !== 'SYSTEM_ADMIN' && !(approve ? managers : roles).includes(result.roleName)) throw new HttpError(403, approve ? 'Only an owner or manager can approve or cancel purchase orders.' : 'You do not have purchasing access.');
  const module = await prisma.businessModule.findUnique({ where: { businessId_key: { businessId: req.params.businessId, key: 'INVENTORY' } } });
  if (!module?.active) throw new HttpError(403, 'Inventory must be enabled for purchasing.');
  return result.business;
}
function text(value, label, max, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new HttpError(400, `${label} must be ${required ? 'non-empty ' : ''}text up to ${max} characters.`);
  return value.trim() || null;
}
function supplierData(body) {
  const email = text(body.email, 'Email', 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid supplier email.');
  if (body.active !== undefined && typeof body.active !== 'boolean') throw new HttpError(400, 'Active must be true or false.');
  return { name: text(body.name, 'Name', 150, true), email, phone: text(body.phone, 'Phone', 60), address: text(body.address, 'Address', 500), notes: text(body.notes, 'Notes', 2000), ...(body.active !== undefined ? { active: body.active } : {}) };
}
async function queue(tx, req, entityType, entity, operation) {
  if (!isDesktopSyncEnabled()) return;
  await tx.syncOperation.create({ data: { businessId: req.params.businessId, entityType, entityId: entity.id, operation,
    method: req.method, endpoint: req.originalUrl, userId: req.user.id, payload: JSON.parse(JSON.stringify(entity)) } });
}
purchasingRouter.get('/business/:businessId/suppliers', async (req,res,next) => {
  try { await access(req); res.json({ suppliers: await prisma.supplier.findMany({ where: { businessId: req.params.businessId }, orderBy: { name: 'asc' } }) }); } catch(error) { next(error); }
});
purchasingRouter.post('/business/:businessId/suppliers', async (req,res,next) => {
  try {
    await access(req); const data = supplierData(req.body);
    const supplier = await prisma.$transaction(async tx => {
      const row = await tx.supplier.create({ data: { ...data, businessId: req.params.businessId } });
      await queue(tx, req, 'supplier', row, 'create'); return row;
    });
    res.status(201).json({ supplier });
  } catch(error) { next(error); }
});
purchasingRouter.patch('/business/:businessId/suppliers/:supplierId', async (req,res,next) => {
  try {
    await access(req); const data = supplierData(req.body);
    const supplier = await prisma.$transaction(async tx => {
      const result = await tx.supplier.updateMany({ where: { id: req.params.supplierId, businessId: req.params.businessId }, data });
      if (!result.count) throw new HttpError(404, 'Supplier was not found.');
      const row = await tx.supplier.findUnique({ where: { id: req.params.supplierId } });
      await queue(tx, req, 'supplier', row, 'update'); return row;
    });
    res.json({ supplier });
  } catch(error) { next(error); }
});
function orderFilters(req) {
    const status = req.query.status;
    if (status && !['DRAFT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'].includes(status)) throw new HttpError(400, 'Invalid order status.');
    const search = text(req.query.search, 'Search', 150);
    const supplierId = text(req.query.supplierId, 'Supplier filter', 100);
    const branchId = text(req.query.branchId, 'Branch filter', 100);
    const createdAt = buildDateFilter(req.query);
    return { businessId: req.params.businessId, ...(status ? { status } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(supplierId ? { supplierId } : {}), ...(branchId ? { branchId } : {}),
      ...(search ? { OR: [
        { number: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { items: { some: { productName: { contains: search, mode: 'insensitive' } } } }
      ] } : {})
    };
}
purchasingRouter.get('/business/:businessId/orders', async (req,res,next) => {
  try {
    await access(req);
    const page = Number(req.query.page || 1);
    if (!Number.isInteger(page) || page < 1 || page > 100000) throw new HttpError(400, 'Invalid page.');
    const where = orderFilters(req);
    const [orders, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({ where, include, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 25, skip: (page-1)*25 }),
      prisma.purchaseOrder.count({ where })
    ]);
    res.json({ orders, total, page, pageSize: 25 });
  } catch(error) { next(error); }
});
purchasingRouter.get('/business/:businessId/orders/export', async (req,res,next) => {
  try {
    await access(req);
    const where = { AND: [orderFilters(req), { createdAt: { lte: new Date() } }] };
    async function* rows() {
      yield '\ufeff' + ['Order','Created (UTC)','Supplier','Branch','Status','Currency','Order total','Ordered units','Received units','Outstanding units','Cancelled units','Note'].map(csvCell).join(',') + '\r\n';
      let cursor;
      while (!res.destroyed) {
        const orders = await prisma.purchaseOrder.findMany({
          where: cursor ? { AND: [where, { id: { gt: cursor } }] } : where,
          orderBy: { id: 'asc' }, take: 250,
          select: { id: true, number: true, createdAt: true, status: true, currency: true, total: true, note: true,
            supplier: { select: { name: true } }, branch: { select: { name: true } },
            items: { select: { quantity: true, receivedQuantity: true } } }
        });
        if (!orders.length) break;
        for (const order of orders) {
          const ordered = order.items.reduce((sum,item) => sum+item.quantity,0);
          const received = order.items.reduce((sum,item) => sum+item.receivedQuantity,0);
          yield [order.number, order.createdAt.toISOString(), order.supplier.name, order.branch.name, order.status,
            order.currency, String(order.total), ordered, received, order.status === 'CANCELLED' ? 0 : ordered-received,
            order.status === 'CANCELLED' ? ordered-received : 0, order.note].map(csvCell).join(',') + '\r\n';
        }
        cursor = orders.at(-1).id;
      }
    }
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="zera-purchase-orders.csv"');
    await pipeline(Readable.from(rows()),res);
  } catch(error) {
    if (res.headersSent || res.destroyed) { res.destroy(error); return; }
    next(error);
  }
});
async function saveOrder(req,res,next) {
  try {
    const business = await access(req); const { businessId } = req.params;
    const { supplierId, branchId, items } = req.body;
    const note = text(req.body.note, 'Note', 2000);
    if (typeof supplierId !== 'string' || typeof branchId !== 'string' || !Array.isArray(items) || items.length < 1 || items.length > 100) throw new HttpError(400, 'Choose a supplier, branch and 1–100 products.');
    const [supplier, branch] = await Promise.all([
      prisma.supplier.findFirst({ where: { id: supplierId, businessId, active: true } }),
      prisma.branch.findFirst({ where: { id: branchId, businessId, status: 'ACTIVE' } })
    ]);
    if (!supplier || !branch) throw new HttpError(400, 'Supplier and branch must be active in this business.');
    let totalCents = 0;
    const lines = items.map(item => {
      if (!item || typeof item.productId !== 'string' || !Number.isInteger(Number(item.quantity)) || !['number','string'].includes(typeof item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 2147483647) throw new HttpError(400, 'Each product needs a positive whole quantity.');
      if (!['number','string'].includes(typeof item.unitCost) || !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(String(item.unitCost))) throw new HttpError(400, 'Unit cost must be non-negative with at most two decimal places.');
      const cents = Math.round(Number(item.unitCost)*100), quantity = Number(item.quantity), lineCents = cents*quantity;
      totalCents += lineCents;
      if (!Number.isSafeInteger(totalCents) || totalCents > 999999999999) throw new HttpError(400, 'Order value exceeds the supported amount.');
      return { productId: item.productId, quantity, unitCost: (cents/100).toFixed(2), lineTotal: (lineCents/100).toFixed(2) };
    });
    if (new Set(lines.map(item => item.productId)).size !== lines.length) throw new HttpError(400, 'Each product may appear only once.');
    const products = await prisma.product.findMany({ where: { businessId, id: { in: lines.map(item => item.productId) }, status: 'ACTIVE', type: 'PHYSICAL' } });
    if (products.length !== lines.length) throw new HttpError(400, 'Choose active physical products from this business.');
    const order = await prisma.$transaction(async tx => {
      if (req.params.orderId) {
        const orderId = req.params.orderId;
        await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${orderId} AND "businessId" = ${businessId} FOR UPDATE`;
        const existing = await tx.purchaseOrder.findFirst({ where: { id: orderId, businessId } });
        if (!existing) throw new HttpError(404, 'Purchase order was not found.');
        if (existing.status !== 'DRAFT') throw new HttpError(409, 'Only draft orders can be edited.');
        if (req.body.updatedAt !== existing.updatedAt.toISOString()) throw new HttpError(409, 'This draft has changed. Close it and refresh before editing again.');
        const row = await tx.purchaseOrder.update({ where: { id: orderId }, data: {
          branchId, supplierId, note, total: (totalCents/100).toFixed(2),
          items: { deleteMany: {}, create: lines.map(item => ({ ...item, productName: products.find(product => product.id === item.productId).name })) }
        }, include });
        await queue(tx, req, 'purchase_order', row, 'update'); return row;
      }
      const row = await tx.purchaseOrder.create({ data: { businessId, branchId, supplierId, createdById: req.user.id, number: `PO-${randomUUID().slice(0,18).toUpperCase()}`, currency: business.currency,
        note, total: (totalCents/100).toFixed(2), items: { create: lines.map(item => ({ ...item, productName: products.find(product => product.id === item.productId).name })) } }, include });
      await queue(tx, req, 'purchase_order', row, 'create'); return row;
    });
    res.status(req.params.orderId ? 200 : 201).json({ order });
  } catch(error) { next(error); }
}
purchasingRouter.post('/business/:businessId/orders', saveOrder);
purchasingRouter.patch('/business/:businessId/orders/:orderId', saveOrder);
purchasingRouter.post('/business/:businessId/orders/:orderId/:action', async (req,res,next) => {
  try {
    const { businessId, orderId, action } = req.params;
    if (!['approve','receive','cancel'].includes(action)) throw new HttpError(404, 'Unknown purchase action.');
    await access(req, action !== 'receive');
    const receiptInput = action === 'receive' ? normalizeReceipt(req.body || {}) : null;
    const order = await prisma.$transaction(async tx => {
      // Serialize receipt, approval and cancellation before reading outstanding amounts.
      await tx.$queryRaw`SELECT "id" FROM "PurchaseOrder" WHERE "id" = ${orderId} AND "businessId" = ${businessId} FOR UPDATE`;
      const existing = await tx.purchaseOrder.findFirst({ where: { id: orderId, businessId }, include });
      if (!existing) throw new HttpError(404, 'Purchase order was not found.');
      if (receiptInput?.requestKey) {
        const previous = await tx.purchaseReceipt.findUnique({ where: { orderId_requestKey: { orderId, requestKey: receiptInput.requestKey } } });
        if (previous) {
          if (previous.requestHash !== receiptInput.requestHash) throw new HttpError(409, 'This receipt request was already used with different quantities or notes.');
          return existing;
        }
      }
      const allowed = action === 'approve' ? ['DRAFT'] : action === 'receive' ? ['ORDERED','PARTIALLY_RECEIVED'] : ['DRAFT','ORDERED','PARTIALLY_RECEIVED'];
      if (!allowed.includes(existing.status)) throw new HttpError(409, 'This order has already changed. Refresh before continuing.');
      if (action !== 'cancel') {
        const branch = await tx.branch.findFirst({ where: { id: existing.branchId, businessId, status: 'ACTIVE' } });
        if (!branch) throw new HttpError(409, 'Activate the receiving branch before continuing.');
        if (action === 'approve' && !existing.supplier.active) throw new HttpError(409, 'Activate the supplier before approval.');
      }
      if (action === 'receive') {
        const requested = receiptInput.items || existing.items.filter(item => item.receivedQuantity < item.quantity).map(item => ({ orderItemId: item.id, quantity: item.quantity-item.receivedQuantity }));
        const lines = requested.map(line => {
          const item = existing.items.find(item => item.id === line.orderItemId);
          if (!item) throw new HttpError(400, 'A receipt item does not belong to this order.');
          if (line.quantity > item.quantity-item.receivedQuantity) throw new HttpError(409, `Only ${item.quantity-item.receivedQuantity} ${item.productName} remain outstanding. Refresh the order.`);
          return { orderItemId: item.id, productId: item.productId, productName: item.productName, quantity: line.quantity, unitCost: String(item.unitCost) };
        });
        if (!lines.length) throw new HttpError(409, 'No items remain to receive.');
        const receipt = await tx.purchaseReceipt.create({ data: { orderId, reference: `PR-${randomUUID()}`, receivedById: req.user.id, requestKey: receiptInput.requestKey, requestHash: receiptInput.requestHash, note: receiptInput.note, items: lines } });
        for (const item of [...lines].sort((a,b) => a.productId.localeCompare(b.productId))) {
          const stock = await ensureInventoryStock(tx, { businessId, branchId: existing.branchId, productId: item.productId });
          const changed = await tx.inventoryStock.updateMany({ where: { id: stock.id, quantity: { lte: 2147483647-item.quantity } }, data: { quantity: { increment: item.quantity } } });
          if (!changed.count) throw new HttpError(409, 'Receiving this order would exceed the supported stock quantity.');
          const updated = await tx.inventoryStock.findUnique({ where: { id: stock.id } });
          await tx.purchaseOrderItem.update({ where: { id: item.orderItemId }, data: { receivedQuantity: { increment: item.quantity } } });
          await tx.stockAdjustment.create({ data: { businessId, branchId: existing.branchId, productId: item.productId, userId: req.user.id, purchaseReceiptId: receipt.id, type: 'INCREASE', quantityBefore: updated.quantity-item.quantity, quantityChange: item.quantity, quantityAfter: updated.quantity, note: `Purchase ${existing.number}` } });
        }
        const complete = existing.items.every(item => item.receivedQuantity + (lines.find(line => line.orderItemId === item.id)?.quantity || 0) === item.quantity);
        await tx.purchaseOrder.update({ where: { id: orderId }, data: { status: complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED', ...(complete ? { receivedAt: receipt.createdAt, receivedById: req.user.id } : {}) } });
      } else {
        await tx.purchaseOrder.update({ where: { id: orderId }, data: action === 'approve' ? { status: 'ORDERED', approvedAt: new Date(), approvedById: req.user.id } : { status: 'CANCELLED' } });
      }
      const row = await tx.purchaseOrder.findUnique({ where: { id: orderId }, include });
      await queue(tx, req, 'purchase_order', row, action); return row;
    });
    res.json({ order });
  } catch(error) { next(error); }
});

function normalizeReceipt(body) {
  const note = text(body.note, 'Delivery note', 2000);
  const requestKey = body.requestKey ?? null;
  if (requestKey !== null && (typeof requestKey !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey))) throw new HttpError(400, 'Provide a valid receipt request key.');
  let items = null;
  if (body.items !== undefined) {
    if (!requestKey || !Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new HttpError(400, 'Choose 1–100 received products and provide a receipt request key.');
    items = body.items.map(item => {
      if (!item || typeof item.orderItemId !== 'string' || !['number','string'].includes(typeof item.quantity) || !/^[1-9]\d*$/.test(String(item.quantity)) || Number(item.quantity) > 2147483647) throw new HttpError(400, 'Received quantities must be positive whole numbers.');
      return { orderItemId: item.orderItemId, quantity: Number(item.quantity) };
    }).sort((a,b) => a.orderItemId.localeCompare(b.orderItemId));
    if (new Set(items.map(item => item.orderItemId)).size !== items.length) throw new HttpError(400, 'Each order item may appear only once in a receipt.');
  }
  return { requestKey, note, items, requestHash: createHash('sha256').update(JSON.stringify({ items, note })).digest('hex') };
}
