import {Router} from 'express';
import {prisma} from '../../config/prisma.js';
import {requireAuth} from '../../middleware/authMiddleware.js';
import {getBusinessAccess} from '../../utils/businessAccess.js';
import {HttpError} from '../../utils/httpError.js';
import {positiveAmount,lockMoney,decimal} from '../../utils/moneyLedger.js';
export const payrollRouter=Router();
payrollRouter.use(requireAuth);
payrollRouter.use('/business/:businessId',async(req,res,next)=>{try{const {business,roleName}=await getBusinessAccess(req.user,req.params.businessId);if(roleName!=='Owner'||!business.modules.some(m=>m.key==='FINANCE'&&m.active))throw new HttpError(403,'Only the owner with Finance enabled can access payroll.');next();}catch(e){next(e);}});
function period(value){if(typeof value!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))throw new HttpError(400,'Choose a payroll month.');return value;}
payrollRouter.get('/business/:businessId',async(req,res,next)=>{try{
 const businessId=req.params.businessId,month=period(req.query.period);
 const [profiles,employees,entries]=await Promise.all([
  prisma.salaryProfile.findMany({where:{businessId},include:{employee:{select:{id:true,name:true}},branch:{select:{name:true}}},orderBy:{employee:{name:'asc'}}}),
  prisma.businessUser.findMany({where:{businessId,user:{status:'ACTIVE'}},select:{user:{select:{id:true,name:true}}}}),
  prisma.payrollEntry.findMany({where:{businessId,period:month},include:{profile:{include:{employee:{select:{name:true}}}},expense:true},orderBy:{createdAt:'asc'}})
 ]);
 const payments=await prisma.moneyPosting.groupBy({by:['sourceId'],where:{businessId,kind:'EXPENSE',sourceId:{in:entries.map(e=>e.expenseId)}},_sum:{amount:true}});
 res.json({profiles,employees:employees.map(e=>e.user),entries:entries.map(e=>({...e,paid:decimal(payments.find(p=>p.sourceId===e.expenseId)?._sum.amount).toFixed(2)}))});
}catch(e){next(e);}});
payrollRouter.put('/business/:businessId/profiles/:employeeId',async(req,res,next)=>{try{
 const {businessId,employeeId}=req.params,{branchId}=req.body,monthlyAmount=positiveAmount(req.body.monthlyAmount).toFixed(2);
 if(typeof req.body.active!=='boolean'||typeof branchId!=='string')throw new HttpError(400,'Choose a branch and salary status.');
 const profile=await prisma.$transaction(async tx=>{
  await lockMoney(tx,businessId);
  if(!await tx.businessUser.findFirst({where:{businessId,userId:employeeId,user:{status:'ACTIVE'}}}))throw new HttpError(400,'Choose an active team member.');
  if(!await tx.branch.findFirst({where:{businessId,id:branchId,status:'ACTIVE'}}))throw new HttpError(400,'Choose an active branch.');
  const before=await tx.salaryProfile.findUnique({where:{businessId_employeeId:{businessId,employeeId}}});
  const result=await tx.salaryProfile.upsert({where:{businessId_employeeId:{businessId,employeeId}},create:{businessId,employeeId,branchId,monthlyAmount,active:req.body.active},update:{branchId,monthlyAmount,active:req.body.active}});
  await tx.financeEvent.create({data:{businessId,entityId:result.id,actorId:req.user.id,action:'SALARY_UPDATED',details:{before:before?{amount:String(before.monthlyAmount),active:before.active,branchId:before.branchId}:null,after:{amount:monthlyAmount,active:req.body.active,branchId}}}});return result;
 });res.json({profile});
}catch(e){next(e);}});
payrollRouter.post('/business/:businessId/process',async(req,res,next)=>{try{
 const businessId=req.params.businessId,month=period(req.body.period);
 const result=await prisma.$transaction(async tx=>{
  await lockMoney(tx,businessId);
  const profiles=await tx.salaryProfile.findMany({where:{businessId,active:true,employee:{status:'ACTIVE',memberships:{some:{businessId}}},branch:{status:'ACTIVE'}},include:{employee:{select:{name:true}}}});
  if(!profiles.length)throw new HttpError(400,'Set up at least one active employee salary.');
  let created=0;
  for(const profile of profiles){
   if(await tx.payrollEntry.findUnique({where:{profileId_period:{profileId:profile.id,period:month}}}))continue;
   const expense=await tx.expense.create({data:{businessId,branchId:profile.branchId,recordedById:req.user.id,title:`Salary · ${profile.employee.name} · ${month}`,category:'Salary',amount:profile.monthlyAmount,note:`Payroll ${month}`}});
   const entry=await tx.payrollEntry.create({data:{businessId,profileId:profile.id,period:month,expenseId:expense.id}});
   await tx.financeEvent.create({data:{businessId,entityId:expense.id,actorId:req.user.id,action:'PAYROLL_CREATED',details:{entryId:entry.id,period:month,amount:String(profile.monthlyAmount)}}});created++;
  }return {created};
 },{timeout:30000});res.status(201).json(result);
}catch(e){next(e);}});
