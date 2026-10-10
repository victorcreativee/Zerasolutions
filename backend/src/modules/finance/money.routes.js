import {buildDateFilter} from '../../utils/reportDates.js';
import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { getBusinessAccess } from '../../utils/businessAccess.js';
import { HttpError } from '../../utils/httpError.js';
import { money } from '../../utils/productPricing.js';
import { accountDefinitions, balance, decimal, fingerprint, lockMoney, paidAmount, positiveAmount, postMoney } from '../../utils/moneyLedger.js';

export const moneyRouter=Router();
moneyRouter.use(requireAuth);
moneyRouter.use('/business/:businessId',async(req,res,next)=>{
  try {
    const {business,roleName}=await getBusinessAccess(req.user,req.params.businessId);
    if(roleName!=='Owner') throw new HttpError(403,'Only the owner can manage money accounts.');
    if(!business.modules.some(item=>item.key==='FINANCE'&&item.active)) throw new HttpError(403,'Finance module is not active.');
    req.moneyBusiness=business; next();
  } catch(error){next(error);}
});
function viewFilter(view){if(view==='income')return {kind:{in:['SALE','OTHER_INCOME','CAPITAL','LOAN']}};if(view==='payments')return {kind:{in:['EXPENSE','PURCHASE']}};return {};}
function historyFilter(query){
 const createdAt=buildDateFilter(query),search=String(query.search||'').trim().slice(0,200);
 return {...viewFilter(query.view),...(createdAt?{createdAt}:{}),...(search?{OR:[{note:{contains:search,mode:'insensitive'}},{id:{contains:search,mode:'insensitive'}}]}:{})};
}
async function branchAccess(tx,businessId,branchId) {
  if(typeof branchId!=='string'||!branchId)throw new HttpError(400,'Choose an active branch.');
  const branch=await tx.branch.findFirst({where:{id:branchId,businessId,status:'ACTIVE'}});
  if(!branch)throw new HttpError(400,'Choose an active branch.');
  return branch;
}
function identity(body) {
  if(typeof body.requestKey!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(body.requestKey))throw new HttpError(400,'A valid request key is required.');
  const {requestKey,...payload}=body;
  return {requestKey,requestHash:fingerprint(payload)};
}
async function replay(tx,businessId,id) {
  const previous=await tx.moneyPosting.findUnique({where:{businessId_requestKey:{businessId,requestKey:id.requestKey}}});
  if(previous&&previous.requestHash!==id.requestHash)throw new HttpError(409,'This request was already used for a different payment.');
  return previous;
}

moneyRouter.get('/business/:businessId',async(req,res,next)=>{
  try {
    const businessId=req.params.businessId, branchId=String(req.query.branchId||'');
    await branchAccess(prisma,businessId,branchId);
    const page=Math.max(1,Math.min(100000,Number.parseInt(req.query.page,10)||1));
    const data=await prisma.$transaction(async tx=>{
      const accounts=await tx.moneyAccount.findMany({where:{businessId,branchId,kind:'ASSET'},orderBy:{code:'asc'}});
      const totals=await tx.moneyEntry.groupBy({by:['accountId'],where:{accountId:{in:accounts.map(item=>item.id)}},_sum:{amount:true}});
      const accountId=String(req.query.accountId||'');
      if(accountId&&!accounts.some(account=>account.id===accountId))throw new HttpError(400,'Choose an account belonging to this branch.');
      const where={businessId,branchId};
      const historyWhere={...where,...historyFilter(req.query),...(accountId?{entries:{some:{accountId}}}:{})};
      const [postings,total,expenses,purchases,payments]=await Promise.all([
        tx.moneyPosting.findMany({where:historyWhere,include:{entries:{include:{account:true}},recordedBy:{select:{name:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:10,skip:(page-1)*10}),
        tx.moneyPosting.count({where:historyWhere}),
        tx.expense.findMany({where:{...where,status:'APPROVED'},select:{id:true,title:true,amount:true,createdAt:true},orderBy:{createdAt:'desc'}}),
        tx.purchaseOrder.findMany({where:{...where,status:{in:['ORDERED','PARTIALLY_RECEIVED','RECEIVED']}},select:{id:true,number:true,total:true,createdAt:true,supplier:{select:{name:true}}},orderBy:{createdAt:'desc'}}),
        tx.moneyPosting.groupBy({by:['kind','sourceId'],where:{...where,kind:{in:['EXPENSE','PURCHASE']}},_sum:{amount:true}})
      ]);
      const reversals=await tx.moneyPosting.findMany({where:{businessId,reversesId:{in:postings.map(item=>item.id)}},select:{id:true,reversesId:true}});
      const history=postings.map(item=>({...item,correctedById:reversals.find(row=>row.reversesId===item.id)?.id||null}));
      const documents=[...expenses.map(item=>({id:item.id,label:item.title,total:item.amount,createdAt:item.createdAt,kind:'EXPENSE'})),...purchases.map(item=>({id:item.id,label:`${item.number} · ${item.supplier.name}`,total:item.total,createdAt:item.createdAt,kind:'PURCHASE'}))].map(item=>{
        const paid=decimal(payments.find(row=>row.kind===item.kind&&row.sourceId===item.id)?._sum.amount);
        return {...item,predatesTracking:accounts.length>0&&item.createdAt<accounts[0].createdAt,paid:paid.toFixed(2),outstanding:decimal(item.total).minus(paid).toFixed(2)};
      }).filter(item=>decimal(item.outstanding).gt(0));
      return {accounts:accounts.map(item=>({...item,balance:decimal(totals.find(row=>row.accountId===item.id)?._sum.amount).toFixed(2)})),postings:history,total,page,documents};
    },{isolationLevel:'RepeatableRead'});
    res.json(data);
  }catch(error){next(error);}
});

// Export every recorded asset entry, independent of the on-screen page.
moneyRouter.get('/business/:businessId/export',async(req,res,next)=>{
  try {
    const businessId=req.params.businessId,branchId=String(req.query.branchId||''),accountId=String(req.query.accountId||'');
    const branch=await branchAccess(prisma,businessId,branchId);
    const accounts=await prisma.moneyAccount.findMany({where:{businessId,branchId,kind:'ASSET'}});
    if(accountId&&!accounts.some(item=>item.id===accountId))throw new HttpError(400,'Choose an account belonging to this branch.');
    const entries=await prisma.moneyEntry.findMany({where:{posting:historyFilter(req.query),accountId:{in:accounts.filter(item=>!accountId||item.id===accountId).map(item=>item.id)}},include:{account:true,posting:{include:{recordedBy:{select:{name:true}}}}},orderBy:[{posting:{createdAt:'asc'}},{postingId:'asc'},{id:'asc'}],take:50001});
    if(entries.length>50000)throw new HttpError(422,'This export exceeds 50,000 entries. Select one account and try again.');
    const cell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
    const rows=[['Date (UTC)','Branch','Currency','Account','Movement','Reference','Money in','Money out','Recorded by','Posting ID','Reverses posting ID']];
    for(const entry of entries){const p=entry.posting,amount=decimal(entry.amount);rows.push([p.createdAt.toISOString(),branch.name,req.moneyBusiness.currency,entry.account.name,p.kind,p.note,amount.gt(0)?amount.toFixed(2):'0.00',amount.lt(0)?amount.negated().toFixed(2):'0.00',p.recordedBy.name,p.id,p.reversesId||'']);}
    res.set('Content-Type','text/csv; charset=utf-8');
    res.set('Content-Disposition','attachment; filename="zera-money-history.csv"');
    res.set('Cache-Control','no-store');
    res.send('\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n');
  }catch(error){next(error);}
});

moneyRouter.post('/business/:businessId/start',async(req,res,next)=>{
  try {
    const businessId=req.params.businessId,{branchId,opening={}}=req.body;
    const result=await prisma.$transaction(async tx=>{
      await branchAccess(tx,businessId,branchId); await lockMoney(tx,businessId,branchId);
      if(await tx.moneyAccount.count({where:{businessId,branchId}}))throw new HttpError(409,'Money tracking has already started for this branch.');
      const accounts={};
      for(const [code,name,kind] of accountDefinitions) accounts[code]=await tx.moneyAccount.create({data:{businessId,branchId,code,name,kind}});
      for(const code of ['CASH','BANK','MOMO','CARD_CLEARING']) {
        const amount=decimal(money(opening[code]??'0',`${code} opening balance`));
        if(amount.isZero())continue;
        await postMoney(tx,{businessId,branchId,recordedById:req.user.id,requestKey:`opening:${branchId}:${code}`,requestHash:fingerprint(opening),kind:'OPENING',amount,note:`Opening ${accounts[code].name}`,entries:[{accountId:accounts[code].id,amount},{accountId:accounts.OPENING.id,amount:amount.negated()}]});
      }
      return {started:true};
    });
    res.status(201).json(result);
  }catch(error){next(error);}
});

moneyRouter.post('/business/:businessId/movements',async(req,res,next)=>{
  try {
    const businessId=req.params.businessId,{branchId,kind,fromAccountId,toAccountId,sourceId,note}=req.body;
    const id=identity(req.body),amount=positiveAmount(req.body.amount);
    if(!['TRANSFER','CAPITAL','LOAN','OTHER_INCOME','WITHDRAWAL','EXPENSE','PURCHASE'].includes(kind))throw new HttpError(400,'Choose a valid money movement.');
    if(['EXPENSE','PURCHASE'].includes(kind)&&(typeof sourceId!=='string'||!sourceId))throw new HttpError(400,'Choose the expense or purchase to pay.');
    if(typeof note!=='string'||!note.trim()||note.length>1000)throw new HttpError(400,'Enter a reference or reason (up to 1,000 characters).');
    const posting=await prisma.$transaction(async tx=>{
      await branchAccess(tx,businessId,branchId);
      // Document locks also serialize approval/cancellation with payment.
      if(kind==='EXPENSE')await tx.$queryRaw`SELECT id FROM "Expense" WHERE id=${String(sourceId)} AND "businessId"=${businessId} FOR UPDATE`;
      if(kind==='PURCHASE')await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${String(sourceId)} AND "businessId"=${businessId} FOR UPDATE`;
      await lockMoney(tx,businessId,branchId);
      const previous=await replay(tx,businessId,id); if(previous)return previous;
      const accounts=await tx.moneyAccount.findMany({where:{businessId,branchId}});
      if(!accounts.length)throw new HttpError(409,'Start money tracking for this branch first.');
      const asset=accountId=>{
        const account=accounts.find(item=>item.id===accountId&&item.kind==='ASSET');
        if(!account)throw new HttpError(400,'Choose an account belonging to this branch.');
        return account;
      };
      let debit,credit;
      if(['CAPITAL','LOAN','OTHER_INCOME'].includes(kind)) {
        debit=asset(toAccountId); credit=accounts.find(item=>item.code===kind);
        if(debit.code==='CARD_CLEARING')throw new HttpError(400,'Choose Cash, Bank or Mobile Money for additional funds.');
      } else {
        credit=asset(fromAccountId);
        if(kind==='TRANSFER')debit=asset(toAccountId);
        else if(kind==='WITHDRAWAL'){if(credit.code==='CARD_CLEARING')throw new HttpError(400,'Settle card funds before withdrawing.');debit=accounts.find(item=>item.code==='CAPITAL');}
        else {
          if(credit.code==='CARD_CLEARING')throw new HttpError(400,'Settle card funds into Bank before spending them.');
          const document=kind==='EXPENSE'?await tx.expense.findFirst({where:{id:sourceId,businessId,branchId,status:'APPROVED'}}):await tx.purchaseOrder.findFirst({where:{id:sourceId,businessId,branchId,status:{in:['ORDERED','PARTIALLY_RECEIVED','RECEIVED']}}});
          if(!document)throw new HttpError(409,'The expense or purchase is not approved for payment in this branch.');
          const remaining=decimal(kind==='EXPENSE'?document.amount:document.total).minus(await paidAmount(tx,businessId,kind,sourceId));
          if(amount.gt(remaining))throw new HttpError(409,'Payment exceeds the outstanding amount.');
          debit=accounts.find(item=>item.code===kind);
        }
        if((await balance(tx,credit.id)).lt(amount))throw new HttpError(409,'Insufficient funds. Record the actual additional funding or transfer first.');
      }
      return postMoney(tx,{businessId,branchId,recordedById:req.user.id,...id,kind,sourceId:['EXPENSE','PURCHASE'].includes(kind)?sourceId:null,amount,note:note.trim(),entries:[{accountId:debit.id,amount},{accountId:credit.id,amount:amount.negated()}]});
    });
    res.status(201).json({posting});
  }catch(error){next(error);}
});

moneyRouter.post('/business/:businessId/postings/:postingId/reverse',async(req,res,next)=>{
  try {
    const {businessId,postingId}=req.params;
    if(typeof req.body.note!=='string'||!req.body.note.trim()||req.body.note.length>1000)throw new HttpError(400,'Enter the reason for correction.');
    const result=await prisma.$transaction(async tx=>{
      const original=await tx.moneyPosting.findFirst({where:{id:postingId,businessId},include:{entries:{include:{account:true}}}});
      if(!original||original.kind==='SALE'||original.reversesId)throw new HttpError(400,'Use the sales void workflow for receipts; only original money movements can be corrected here.');
      await lockMoney(tx,businessId,original.branchId);
      const existing=await tx.moneyPosting.findUnique({where:{reversesId:postingId}}); if(existing)return existing;
      for(const line of original.entries)if(line.account.kind==='ASSET'&&decimal(line.amount).gt(0)&&(await balance(tx,line.accountId)).lt(line.amount))throw new HttpError(409,'These funds have been used. Restore them before reversing this entry.');
      return postMoney(tx,{businessId,branchId:original.branchId,recordedById:req.user.id,requestKey:`reverse:${postingId}`,requestHash:fingerprint(postingId),kind:original.kind,sourceId:original.sourceId,reversesId:postingId,amount:decimal(original.amount).negated(),note:req.body.note.trim(),entries:original.entries.map(line=>({accountId:line.accountId,amount:decimal(line.amount).negated()}))});
    });
    res.json({posting:result});
  }catch(error){next(error);}
});
