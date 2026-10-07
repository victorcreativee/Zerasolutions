import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

export function createDeploymentSyncToken(businessId) {
  return createHmac("sha256", env.jwtSecret).update(`zera-sync:${businessId}`).digest("hex");
}

export function verifyDeploymentSyncToken(businessId, token) {
  if (!businessId || !token) {
    return false;
  }

  const expected = createDeploymentSyncToken(businessId);
  const receivedBuffer = Buffer.from(String(token));
  const expectedBuffer = Buffer.from(expected);

  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function exportBusinessSnapshot(businessId) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      suppliers: true,
      purchaseOrders: { include: { items: true, receipts: true } },
      branches: true,
      customers: true,
      expenses: true,
      inventoryStocks: true,
      memberships: {
        include: {
          role: true,
          user: true
        }
      },
      modules: true,
      posOrders: {
        include: {
          items: true
        }
      },
      products: true,
      roles: true,
      sales: {
        include: {
          items: true
        }
      },
      stockAdjustments: true,
      tables: true
    }
  });

  if (!business) {
    return null;
  }

  const usersById = new Map();
  business.memberships.forEach((membership) => {
    if (membership.user) {
      usersById.set(membership.user.id, membership.user);
    }
  });

  return {
    exportedAt: new Date().toISOString(),
    business: stripRelations(business, [
      "suppliers",
      "purchaseOrders",
      "branches",
      "customers",
      "expenses",
      "inventoryStocks",
      "memberships",
      "modules",
      "posOrders",
      "products",
      "roles",
      "sales",
      "stockAdjustments",
      "tables"
    ]),
    suppliers: business.suppliers,
    purchaseOrders: business.purchaseOrders.map(order => stripRelations(order, ["items", "receipts"])),
    purchaseOrderItems: business.purchaseOrders.flatMap(order => order.items),
    purchaseReceipts: business.purchaseOrders.flatMap(order => order.receipts),
    branches: business.branches,
    businessUsers: business.memberships.map((membership) => stripRelations(membership, ["role", "user"])),
    customers: business.customers,
    expenses: business.expenses,
    inventoryStocks: business.inventoryStocks,
    modules: business.modules,
    posOrders: business.posOrders.map((order) => stripRelations(order, ["items"])),
    posOrderItems: business.posOrders.flatMap((order) => order.items),
    products: business.products,
    roles: business.roles,
    saleItems: business.sales.flatMap((sale) => sale.items),
    sales: business.sales.map((sale) => stripRelations(sale, ["items"])),
    stockAdjustments: business.stockAdjustments,
    tables: business.tables,
    users: [...usersById.values()]
  };
}

export async function importBusinessSnapshot(snapshot) {
  const businessId = snapshot?.business?.id;

  if (!businessId) {
    throw new Error("Snapshot business id is required.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.business.upsert({
      where: { id: businessId },
      update: stripUndefined(snapshot.business),
      create: stripUndefined(snapshot.business)
    });

    for (const user of snapshot.users || []) {
      await tx.user.upsert({
        where: { id: user.id },
        update: stripUndefined(user),
        create: stripUndefined(user)
      });
    }

    for (const role of snapshot.roles || []) {
      await tx.role.upsert({
        where: { id: role.id },
        update: stripUndefined(role),
        create: stripUndefined(role)
      });
    }

    for (const branch of snapshot.branches || []) {
      await tx.branch.upsert({
        where: { id: branch.id },
        update: stripUndefined(branch),
        create: stripUndefined(branch)
      });
    }

    for (const moduleItem of snapshot.modules || []) {
      await tx.businessModule.upsert({
        where: { id: moduleItem.id },
        update: stripUndefined(moduleItem),
        create: stripUndefined(moduleItem)
      });
    }

    for (const sourceProduct of snapshot.products || []) {
      const {privateCost, costPrice, ...product} = sourceProduct;
      await tx.product.upsert({
        where: { id: product.id },
        update: stripUndefined(product),
        create: stripUndefined(product)
      });
    }

    for (const supplier of snapshot.suppliers || []) {
      await tx.supplier.upsert({ where: { id: supplier.id }, update: stripUndefined(supplier), create: stripUndefined(supplier) });
    }
    for (const order of snapshot.purchaseOrders || []) {
      await tx.purchaseOrder.upsert({ where: { id: order.id }, update: stripUndefined(order), create: stripUndefined(order) });
      await tx.purchaseOrderItem.deleteMany({ where: { orderId: order.id } });
      const items = (snapshot.purchaseOrderItems || []).filter(item => item.orderId === order.id);
      if (items.length) await tx.purchaseOrderItem.createMany({ data: items.map(item => stripUndefined({ ...item, receivedQuantity: item.receivedQuantity ?? (order.status === "RECEIVED" ? item.quantity : 0) })) });
    }

    for (const receipt of snapshot.purchaseReceipts || []) {
      await tx.purchaseReceipt.upsert({ where: { id: receipt.id }, update: stripUndefined(receipt), create: stripUndefined(receipt) });
    }

    for (const customer of snapshot.customers || []) {
      await tx.customer.upsert({
        where: { id: customer.id },
        update: stripUndefined(customer),
        create: stripUndefined(customer)
      });
    }

    for (const table of snapshot.tables || []) {
      await tx.pOSTable.upsert({
        where: { id: table.id },
        update: stripUndefined(table),
        create: stripUndefined(table)
      });
    }

    for (const membership of snapshot.businessUsers || []) {
      await tx.businessUser.upsert({
        where: { id: membership.id },
        update: stripUndefined(membership),
        create: stripUndefined(membership)
      });
    }

    for (const stock of snapshot.inventoryStocks || []) {
      await tx.inventoryStock.upsert({
        where: { id: stock.id },
        update: stripUndefined(stock),
        create: stripUndefined(stock)
      });
    }

    for (const adjustment of snapshot.stockAdjustments || []) {
      await tx.stockAdjustment.upsert({
        where: { id: adjustment.id },
        update: stripUndefined(adjustment),
        create: stripUndefined(adjustment)
      });
    }

    for (const sale of snapshot.sales || []) {
      await tx.sale.upsert({
        where: { id: sale.id },
        update: stripUndefined(sale),
        create: stripUndefined(sale)
      });

      await tx.saleItem.deleteMany({ where: { saleId: sale.id } });
      const saleItems = (snapshot.saleItems || []).filter((item) => item.saleId === sale.id);

      if (saleItems.length) {
        await tx.saleItem.createMany({
          data: saleItems.map(stripUndefined)
        });
      }
    }

    for (const order of snapshot.posOrders || []) {
      await tx.pOSOrder.upsert({
        where: { id: order.id },
        update: stripUndefined(order),
        create: stripUndefined(order)
      });

      await tx.pOSOrderItem.deleteMany({ where: { orderId: order.id } });
      const orderItems = (snapshot.posOrderItems || []).filter((item) => item.orderId === order.id);

      if (orderItems.length) {
        await tx.pOSOrderItem.createMany({
          data: orderItems.map(stripUndefined)
        });
      }
    }

    for (const expense of snapshot.expenses || []) {
      await tx.expense.upsert({
        where: { id: expense.id },
        update: stripUndefined(expense),
        create: stripUndefined(expense)
      });
    }
  });
}

function stripRelations(record, relationKeys) {
  const copy = { ...record };
  relationKeys.forEach((key) => {
    delete copy[key];
  });
  return copy;
}

function stripUndefined(record) {
  return Object.fromEntries(Object.entries(record || {}).filter(([, value]) => value !== undefined));
}
