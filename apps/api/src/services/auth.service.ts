import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { getUser, type UserRow } from '../models/user.model';
import { HttpError } from '../utils/errors';

/**
 * Autenticação simplificada para o protótipo (usuários sintéticos por perfil).
 * Em produção: Entra ID / SSO corporativo emitindo o mesmo papel (criador, revisor, admin).
 */
const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (payload: string) => createHmac('sha256', env.jwtSecret).update(payload).digest('base64url');

export function issueToken(user: UserRow): string {
  const payload = b64(JSON.stringify({ sub: user.id, role: user.role, exp: Date.now() + 12 * 3600_000 }));
  return `${payload}.${sign(payload)}`;
}

export async function verifyToken(token: string): Promise<UserRow> {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) throw new HttpError(401, 'Sessão inválida.');
  const expected = sign(payload);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) throw new HttpError(401, 'Sessão inválida.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string; exp: number };
  if (data.exp < Date.now()) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  const user = await getUser(data.sub);
  if (!user) throw new HttpError(401, 'Usuário não encontrado.');
  return user;
}
