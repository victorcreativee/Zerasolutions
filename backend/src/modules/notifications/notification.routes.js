import { Router } from 'express';
import { createHash } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { getBusinessAccess } from '../../utils/businessAccess.js';
import { HttpError } from '../../utils/httpError.js';
export const notificationRouter=Router();
notificationRouter.use(requireAuth);
notificationRouter.get('/business/:businessId',async(req,res,next)=>{
  try{
    const {businessId}=req.params;
    const {business,roleName}=await getBusinessAccess(req.user,businessId);
    const branchId=req.query.branchId;
    if(typeof branchId!=='string'||!await prisma.branch.findFirst({where:{id:branchId,businessId}}))throw new HttpError(404,'Branch was not found.');
    const modules=await prisma.businessModule.findMany({where:{businessId,active:true},select:{key:true}});
    const active=new Set(modules.map(item=>item.key));
    const alerts=[];
    function add(kind,title,path,values){
      const revision=createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0,24);
      alerts.push({id:`${branchId}:${kind}:${revision}`,kind,title,path});
    }
    if(business.features.stockNotifications&&['Owner','Manager','Store Keeper','Pharmacist','SYSTEM_ADMIN'].includes(roleName)){
      const products=await prisma.product.findMany({where:{businessId,status:'ACTIVE',type:'PHYSICAL'},orderBy:{id:'asc'},select:{id:true,inventoryStocks:{where:{branchId,businessId},select:{quantity:true,reorderLevel:true}}}});
      const out=[],low=[];
      for(const product of products){
        const stock=product.inventoryStocks[0];const quantity=stock?.quantity || 0;
        if(quantity<=0)out.push([product.id,quantity]);
        else if(stock?.reorderLevel>0&&quantity<=stock.reorderLevel)low.push([product.id,quantity,stock.reorderLevel]);
      }
      if(out.length)add('OUT_OF_STOCK',`${out.length} product${out.length===1?'':'s'} out of stock`,'/inventory',out);
      if(low.length)add('LOW_STOCK',`${low.length} product${low.length===1?'':'s'} low on stock`,'/inventory?view=low',low);
    }
    if(business.features.cashNotifications&&['Owner','Manager','SYSTEM_ADMIN'].includes(roleName)){
      const latest=await prisma.cashCount.findFirst({where:{businessId,branchId},orderBy:[{createdAt:'desc'},{id:'desc'}],select:{id:true,date:true,difference:true}});
      if(latest&&Number(latest.difference)!==0)add('CASH_DIFFERENCE',`Cash-count difference · ${latest.date}`,`/operations?date=${latest.date}`,[latest.id]);
    }
    res.json({alerts});
  }catch(error){next(error);}
});
