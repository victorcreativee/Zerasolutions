import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { HttpError } from './httpError.js';
import { money } from './productPricing.js';

export const accountDefinitions = [
  ['CASH','Cash','ASSET'], ['BANK','Bank','ASSET'], ['MOMO','Mobile Money','ASSET'],
  ['CARD_CLEARING','Card payments awaiting settlement','ASSET'],
  ['OPENING','Opening balance','EQUITY'], ['CAPITAL','Owner investment','EQUITY'],
  ['LOAN','Loans received','LIABILITY'], ['OTHER_INCOME','Other income','INCOME'],
  ['SALES','Sales','INCOME'], ['TAX','Tax collected','LIABILITY'],
  ['EXPENSE','Expense payments','EXPENSE'], ['PURCHASE','Supplier payments','PURCHASE_CLEARING']
];
export const decimal = value => new Prisma.Decimal(value || 0);
export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function positiveAmount(value) {
  const result = decimal(money(value,'Amount'));
  if (!result.gt(0)) throw new HttpError(400,'Amount must be greater than zero.');
  return result;
}
export async function lockMoney(tx,businessId,branchId) {
  const key = `money:${businessId}`;
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key},0))`;
}
export async function balance(tx,accountId) {
  const result = await tx.moneyEntry.aggregate({where:{accountId},_sum:{amount:true}});
  return decimal(result._sum.amount);
}
export async function paidAmount(tx,businessId,kind,sourceId) {
  const result = await tx.moneyPosting.aggregate({where:{businessId,kind,sourceId},_sum:{amount:true}});
  return decimal(result._sum.amount);
}
export async function postMoney(tx, { entries, ...data }) {
  if (entries.length < 2 || !entries.reduce((sum,line)=>sum.plus(line.amount),decimal(0)).isZero()) throw new Error('Money journal must balance.');
  if (new Set(entries.map(line=>line.accountId)).size !== entries.length) throw new HttpError(400,'Choose different source and destination accounts.');
  return tx.moneyPosting.create({data:{...data,entries:{create:entries.map(line=>({...line,amount:decimal(line.amount).toFixed(2)}))}},include:{entries:{include:{account:true}},recordedBy:{select:{name:true}}}});
}
export async function recordSaleMoney(tx,sale) {
  await lockMoney(tx,sale.businessId,sale.branchId);
  const accounts = await tx.moneyAccount.findMany({where:{businessId:sale.businessId,branchId:sale.branchId}});
  // Tracking starts only after the owner confirms actual opening balances.
  if (!accounts.length) return;
  const account = code => accounts.find(item=>item.code===code).id;
  const method = {CASH:'CASH',CARD:'CARD_CLEARING',MOBILE_MONEY:'MOMO'}[sale.paymentMethod];
  if (!method) throw new HttpError(400,'Payment method has no money account.');
  const total=decimal(sale.total), tax=decimal(sale.taxAmount);
  await postMoney(tx,{businessId:sale.businessId,branchId:sale.branchId,recordedById:sale.cashierId,
    requestKey:`sale:${sale.id}`,requestHash:fingerprint(sale.id),kind:'SALE',sourceId:sale.id,amount:total,
    note:`Receipt ${sale.receiptNumber}`,entries:[
      {accountId:account(method),amount:total}, {accountId:account('SALES'),amount:total.minus(tax).negated()},
      ...(tax.isZero()?[]:[{accountId:account('TAX'),amount:tax.negated()}])
    ]});
}
export async function reverseSaleMoney(tx,sale,userId) {
  await lockMoney(tx,sale.businessId,sale.branchId);
  const original=await tx.moneyPosting.findUnique({where:{businessId_requestKey:{businessId:sale.businessId,requestKey:`sale:${sale.id}`}},include:{entries:true}});
  if (!original) {
    const accounts=await tx.moneyAccount.findMany({where:{businessId:sale.businessId,branchId:sale.branchId}});
    if(!accounts.length)return;
    const code={CASH:'CASH',CARD:'CARD_CLEARING',MOBILE_MONEY:'MOMO'}[sale.paymentMethod];
    const amount=decimal(sale.total);
    await postMoney(tx,{businessId:sale.businessId,branchId:sale.branchId,recordedById:userId,
      requestKey:`sale-void:${sale.id}`,requestHash:fingerprint(sale.id),kind:'SALE',sourceId:sale.id,
      amount:amount.negated(),note:`Refund of pre-tracking receipt ${sale.receiptNumber}`,
      entries:[{accountId:accounts.find(item=>item.code===code).id,amount:amount.negated()},{accountId:accounts.find(item=>item.code==='OPENING').id,amount}]});
    return;
  }
  await postMoney(tx,{businessId:sale.businessId,branchId:sale.branchId,recordedById:userId,
    requestKey:`sale-void:${sale.id}`,requestHash:fingerprint(sale.id),kind:'SALE',sourceId:sale.id,
    reversesId:original.id,amount:decimal(original.amount).negated(),note:`Void ${sale.receiptNumber}`,
    entries:original.entries.map(line=>({accountId:line.accountId,amount:decimal(line.amount).negated()}))});
}
