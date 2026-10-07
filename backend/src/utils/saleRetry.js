import {createHash} from 'node:crypto';
import {HttpError} from './httpError.js';

export function saleRequestIdentity(body, cashierId) {
  if (body.requestKey === undefined) return {};
  if (typeof body.requestKey !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestKey)) throw new HttpError(400,'Invalid checkout request key.');
  const payload = {cashierId,branchId:body.branchId,customerId:body.customerId || null,tableId:body.tableId || null,paymentMethod:body.paymentMethod,discountAmount:Number(body.discountAmount || 0),items:body.items.map(item=>({productId:item.productId,quantity:Number(item.quantity),unitPrice:item.unitPrice === undefined ? null : item.unitPrice}))};
  return {requestKey:body.requestKey,requestHash:createHash('sha256').update(JSON.stringify(payload)).digest('hex')};
}
export async function previousSale(client,businessId,identity,include) {
  if (!identity.requestKey) return null;
  const sale = await client.sale.findUnique({where:{businessId_requestKey:{businessId,requestKey:identity.requestKey}},include});
  if (sale && sale.requestHash !== identity.requestHash) throw new HttpError(409,'This checkout request was already used with different details. Check the sales history before retrying.');
  return sale;
}
