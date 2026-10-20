import type { UserRole } from '@cf/shared';
import { db } from '../db/client';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export async function listUsers(): Promise<UserRow[]> {
  const { rows } = await db().query<UserRow>('select id, name, email, role from users order by name');
  return rows;
}
export async function getUser(id: string): Promise<UserRow | undefined> {
  const { rows } = await db().query<UserRow>('select id, name, email, role from users where id = $1', [id]);
  return rows[0];
}
export async function upsertUser(u: UserRow) {
  await db().query(
    'insert into users (id, name, email, role) values ($1,$2,$3,$4) on conflict (id) do update set name = excluded.name, email = excluded.email, role = excluded.role',
    [u.id, u.name, u.email, u.role],
  );
}
