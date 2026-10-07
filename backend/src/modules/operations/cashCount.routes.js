import { Router } from 'express';
import { createHash } from 'node:crypto';
import { Prisma } from '../../config/prisma.js';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { getBusinessAccess } from '../../utils/businessAccess.js';
import { HttpError } from '../../utils/httpError.js';
import { money } from '../../utils/productPricing.js';
import { operationsDay } from '../../utils/operationsDay.js';
export const cashCountRouter=Router();
cashCountRouter.use(requireAuth);
cashCountRouter.post('/business/:businessId/cash-counts',async(req,res,next)=>{
  try {
    const businessId=req.params.businessId;
    const {business,roleName}=await getBusinessAccess(req.user,businessId);
    if (!['Owner','Manager','SYSTEM_ADMIN'].includes(roleName)) throw new HttpError(403,'Only the owner or manager can record cash counts.');
    if(!business.features.cashCounts) throw new HttpError(403,'Cash counts require POS and Operations.');
    const module=await prisma.businessModule.findUnique({where:{businessId_key:{businessId,key:'OPERATIONS'}}});
    if (!module?.active && roleName!=='SYSTEM_ADMIN') throw new HttpError(403,'Operations module is not active.');
    const {branchId,date,requestKey,startOffset=0,endOffset=startOffset}=req.body;
    if (typeof branchId!=='string' || !await prisma.branch.findFirst({where:{id:branchId,businessId,status:'ACTIVE'}})) throw new HttpError(404,'Active branch was not found.');
    if(typeof requestKey!=='string'|| !/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey)) throw new HttpError(400,'Invalid cash-count request.');
    const period=operationsDay(date,startOffset,endOffset);
    if(period.gte>new Date()) throw new HttpError(400,'Cannot count cash for a future date.');
    const amounts=Object.fromEntries(['opening','cashIn','cashOut','counted','previewCashSales'].map(key=>[key,money(req.body[key],key)]));
    if(typeof req.body.note!=='string'||req.body.note.length>1000) throw new HttpError(400,'Note must be at most 1,000 characters.');
    const note=req.body.note.trim();
    const hash=createHash('sha256').update(JSON.stringify({branchId,date,period,amounts,note,actor:req.user.id})).digest('hex');
    const result=await prisma.$transaction(async tx=>{
      const lock=`cash-count:${businessId}:${requestKey}`;
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${lock},0))`;
      const previous=await tx.cashCount.findUnique({where:{businessId_requestKey:{businessId,requestKey}}});
      if(previous){if(previous.requestHash!==hash)throw new HttpError(409,'This request was already used for a different count.');return {record:previous,replayed:true};}
      const sales=await tx.sale.aggregate({where:{businessId,branchId,paymentMethod:'CASH',status:'COMPLETED',createdAt:period},_sum:{total:true}});
      const cashSales=new Prisma.Decimal(sales._sum.total || 0);
      if(!cashSales.equals(amounts.previewCashSales))throw new HttpError(409,'Cash sales changed. Reload the daily summary before recording the count.');
      const expected=new Prisma.Decimal(amounts.opening).plus(cashSales).plus(amounts.cashIn).minus(amounts.cashOut);
      if(expected.isNegative())throw new HttpError(400,'Cash out exceeds available cash.');
      const difference=new Prisma.Decimal(amounts.counted).minus(expected);
      if(!difference.isZero()&&!note)throw new HttpError(400,'Add a note for the cash difference.');
      const record=await tx.cashCount.create({data:{businessId,branchId,recordedById:req.user.id,requestKey,requestHash:hash,date,periodStart:period.gte,periodEnd:period.lt,currency:business.currency,
        opening:amounts.opening,cashIn:amounts.cashIn,cashOut:amounts.cashOut,counted:amounts.counted,cashSales,expected,difference,note:note||null}});
      return {record,replayed:false};
    });
    res.status(result.replayed?200:201).json({cashCount:result.record});
  }catch(error){next(error);}
});
