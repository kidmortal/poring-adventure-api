/**
 * The connection and the upsert helpers every seed module shares.
 *
 * Seeds address rows by their natural key — a name, or the pair of names on a
 * join row — and never by id. Autoincrement ids differ between the local
 * dev.db and the deployed Turso database, so a seed that hard-coded them would
 * write the right numbers into the wrong rows.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

// Blank the two TURSO vars to seed the local dev.db instead of the remote one.
const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:dev.db',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

export const prisma = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });

/**
 * Several content models — Item, Skill, Monster, Map — carry a name that is
 * unique in practice but not in the schema, so `upsert` is not available to
 * them and the lookup has to be spelled out.
 */
type NamedDelegate = {
  findFirst(args: { where: { name: string } }): Promise<{ id: number } | null>;
  update(args: { where: { id: number }; data: any }): Promise<{ id: number }>;
  create(args: { data: any }): Promise<{ id: number }>;
};

/**
 * Pass the model's create input as the type argument — `upsertByName<Prisma
 * .ItemUncheckedCreateInput>(prisma.item, …)` — since the delegate itself is
 * matched structurally and cannot carry the shape of its own row.
 */
export async function upsertByName<Data extends { name: string }>(delegate: NamedDelegate, data: Data) {
  const existing = await delegate.findFirst({ where: { name: data.name } });
  if (existing) {
    await delegate.update({ where: { id: existing.id }, data });
    return existing.id;
  }
  const created = await delegate.create({ data });
  return created.id;
}

/**
 * Resolves the content a seed points at by name. A miss is fatal rather than
 * skipped: a recipe whose ingredient vanished is a broken recipe, and finding
 * out here beats finding out when a player tries to craft it.
 */
export async function itemIdByName(name: string) {
  const item = await prisma.item.findFirst({ where: { name } });
  if (!item) throw new Error(`no item named "${name}" — seed items first`);
  return item.id;
}

export async function mapIdByName(name: string) {
  const map = await prisma.map.findFirst({ where: { name } });
  if (!map) throw new Error(`no map named "${name}" — seed monsters first`);
  return map.id;
}
