import {createHash} from 'node:crypto';
import {HttpError} from './httpError.js';
export async function stockMutation(prisma,req,execute) {
  const {requestKey,...body}=req.body;
  // Legacy callers remain compatible. Current UI always supplies a key.
  if(requestKey===undefined)return prisma.$transaction(execute);
  if(typeof requestKey!=='string'|| !/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey))throw new HttpError(400,'Invalid stock request key.');
  const businessId=req.params.businessId;
  const sorted=Object.fromEntries(Object.entries(body).sort(([a],[b])=>a.localeCompare(b)));
  const hash=createHash('sha256').update(JSON.stringify({path:req.path,method:req.method,actor:req.user.id,body:sorted})).digest('hex');
  return prisma.$transaction(async tx=>{
    const lock=`stock:${businessId}:${requestKey}`;
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${lock},0))`;
    const previous=await tx.stockRequest.findUnique({where:{businessId_requestKey:{businessId,requestKey}}});
    if(previous){
      if(previous.requestHash!==hash)throw new HttpError(409,'This request was already used for a different stock action.');
      req.stockReplayed=true;return previous.response;
    }
    const response=await execute(tx);
    await tx.stockRequest.create({data:{businessId,requestKey,requestHash:hash,response:JSON.parse(JSON.stringify(response))}});
    return response;
  });
}
