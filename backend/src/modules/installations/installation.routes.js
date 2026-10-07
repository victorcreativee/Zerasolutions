import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/httpError.js';
import { tokenDigest } from '../../utils/installationStatus.js';

export const installationRouter = Router();
installationRouter.use((_req,_res,next) => env.desktopMode ? next(new HttpError(404,'Not available on local installations.')) : next());
// Enrollment secrets are high-entropy, short-lived, single-use and scoped to one business.
installationRouter.post('/enroll', async (req,res,next) => {
  try {
    const {code,deviceToken,businessId,name,platform,architecture,appVersion} = req.body;
    if (!/^[a-f0-9]{64}$/.test(code || '') || !/^[a-f0-9]{64}$/.test(deviceToken || '') || typeof businessId !== 'string' || typeof name !== 'string' || !name.trim() || name.length > 80 || !['mac','windows'].includes(platform) || !['x64','arm64'].includes(architecture) || !/^\d+\.\d+\.\d+$/.test(appVersion || '')) throw new HttpError(400,'Invalid enrollment details.');
    const hash = tokenDigest(deviceToken);
    const device = await prisma.$transaction(async tx => {
      const ticket = await tx.installationEnrollment.findUnique({where:{codeHash:tokenDigest(code)}});
      if (!ticket || ticket.businessId !== businessId || ticket.expiresAt <= new Date()) throw new HttpError(401,'Enrollment code is invalid or expired.');
      // The client persists its secret before enrollment, making a lost response safe to retry.
      if (ticket.consumedAt) {
        const existing = await tx.installation.findUnique({where:{tokenHash:hash}});
        if (existing?.enrollmentId === ticket.id && !existing.revokedAt) return existing;
        throw new HttpError(401,'Enrollment code has already been used.');
      }
      const claimed = await tx.installationEnrollment.updateMany({where:{id:ticket.id,consumedAt:null},data:{consumedAt:new Date()}});
      if (!claimed.count) throw new HttpError(409,'Enrollment is already being processed. Retry.');
      return tx.installation.create({data:{businessId,enrollmentId:ticket.id,tokenHash:hash,name:name.trim(),platform,architecture,appVersion}});
    });
    res.status(201).json({id:device.id});
  } catch(error) { next(error); }
});

export async function requireInstallation(req,_res,next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /,'');
    if (!/^[a-f0-9]{64}$/.test(token || '')) throw new HttpError(401,'Device authentication required.');
    const device = await prisma.installation.findUnique({where:{tokenHash:tokenDigest(token)}});
    if (!device || device.revokedAt) throw new HttpError(401,'Device registration has been revoked or is invalid.');
    req.installation = device;
    next();
  } catch(error) { next(error); }
}
installationRouter.post('/heartbeat',requireInstallation,async (req,res,next) => {
  try {
    const {appVersion,mode,healthy} = req.body;
    if (!/^\d+\.\d+\.\d+$/.test(appVersion || '') || !['DESKTOP','SHARED_SERVER'].includes(mode) || typeof healthy !== 'boolean') throw new HttpError(400,'Invalid health report.');
    await prisma.installation.update({where:{id:req.installation.id},data:{appVersion,mode,healthy,lastSeenAt:new Date()}});
    res.json({ok:true,intervalSeconds:60});
  } catch(error) { next(error); }
});

export function newEnrollmentCode() { return randomBytes(32).toString('hex'); }
