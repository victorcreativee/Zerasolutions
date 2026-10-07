import { HttpError } from './httpError.js';

export function saleUnitPrice(product, enteredPrice) {
  const saved = Number(product.price);
  if (enteredPrice === undefined && saved > 0) enteredPrice = saved;
  const value = typeof enteredPrice === 'number' || typeof enteredPrice === 'string' ? String(enteredPrice).trim() : '';
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number(value) > 9999999999.99) {
    throw new HttpError(400, `Enter a positive selling price with up to two decimal places for ${product.name}.`);
  }
  if (Number(value) < Number(product.minimumPrice || 0)) throw new HttpError(400, `Selling price for ${product.name} must be at least ${product.minimumPrice}.`);
  return Number(value);
}

export function enforceMinimumTotal(items, totals) {
  const minimum = items.reduce((sum,item)=>sum + Number(item.minimumPrice || 0) * item.quantity,0);
  if (Math.round((totals.subtotal - totals.discountAmount)*100) < Math.round(minimum*100)) throw new HttpError(400,'The discount would take this sale below its minimum selling total.');
}
