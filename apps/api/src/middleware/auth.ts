import type { UserRole } from '@cf/shared';
import type { NextFunction, Request, Response } from 'express';
import type { UserRow } from '../models/user.model';
import { verifyToken } from '../services/auth.service';
import { forbidden, HttpError } from '../utils/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token as string | undefined);
    if (!token) throw new HttpError(401, 'Entre para continuar.');
    req.user = await verifyToken(token);
    next();
  } catch (e) {
    next(e);
  }
}

/** Permissão verificada no servidor, nunca só na interface. Admin pode tudo. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Entre para continuar.'));
    if (req.user.role !== 'admin' && !roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
