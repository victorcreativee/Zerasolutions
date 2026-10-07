import {HttpError} from './httpError.js';
export function money(value,label) {
  if (!['string','number'].includes(typeof value) || !/^\d+(\.\d{1,2})?$/.test(String(value).trim()) || Number(value)>9999999999.99) throw new HttpError(400,`${label} must be a non-negative amount with up to two decimal places.`);
  return Number(value).toFixed(2);
}
export function pricingChanges(body,existing,owner,platformAdmin) {
  const minimum=body.minimumPrice === undefined ? Number(existing?.minimumPrice || 0) : Number(money(body.minimumPrice,'Minimum price'));
  const suggested=Number(money(body.price,'Suggested price'));
  if (!owner && !platformAdmin && (suggested!==Number(existing?.price || 0) || minimum!==Number(existing?.minimumPrice || 0))) throw new HttpError(403,'Only the owner can change suggested and minimum prices.');
  if (suggested>0 && minimum>suggested) throw new HttpError(400,'Minimum price cannot exceed the suggested price.');
  if ('costPrice' in body && !owner) throw new HttpError(403,'Cost price is private to the business owner.');
  const cost=body.costPrice === '' || body.costPrice === null ? null : body.costPrice === undefined ? undefined : money(body.costPrice,'Cost price');
  if (existing && !owner && !platformAdmin) return {};
  return {price:suggested.toFixed(2),minimumPrice:minimum.toFixed(2),...(cost===undefined?{}:{privateCost:existing?{upsert:{create:{amount:cost},update:{amount:cost}}}:{create:{amount:cost}}})};
}
export function presentProduct(product,owner) {
  const {privateCost,...publicProduct}=product;
  return {...publicProduct,...(owner?{costPrice:privateCost?.amount ?? null}:{})};
}
