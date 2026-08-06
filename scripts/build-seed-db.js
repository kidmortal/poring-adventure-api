/**
 * Rebuilds the tracked seed.db from nothing: every migration, then `yarn seed`.
 *
 *   yarn db:seed-file
 *
 * Run it when a migration or a seed file changes, and commit the result — the
 * point of seed.db is that a clone gets a database matching the code beside it.
 * It never touches dev.db, and the database it writes has no players in it.
 *
 * Prisma's datasource url is hard-coded in schema.prisma rather than read from
 * the environment, so this drops a throwaway schema next to the real one — the
 * migrations directory is resolved relative to the schema file, which is why
 * the copy cannot live in /tmp.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const prismaDir = path.join(root, 'src', 'core', 'prisma');
const schema = path.join(prismaDir, 'schema.prisma');
const tempSchema = path.join(prismaDir, 'seed-db.schema.prisma');
const target = path.join(root, 'seed.db');

const source = fs.readFileSync(schema, 'utf8');
const swapped = source.replace(/url\s*=\s*"file:[^"]*"/, 'url      = "file:../../../seed.db"');
if (swapped === source) throw new Error('could not find the sqlite url in schema.prisma');

for (const suffix of ['', '-shm', '-wal']) fs.rmSync(target + suffix, { force: true });
fs.writeFileSync(tempSchema, swapped);

try {
  execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema', tempSchema], { stdio: 'inherit', cwd: root });
  execFileSync('yarn', ['seed'], {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, TURSO_DATABASE_URL: 'file:seed.db', TURSO_AUTH_TOKEN: '' },
  });
} finally {
  fs.rmSync(tempSchema, { force: true });
  // sqlite leaves these beside the file it just wrote; committing them would
  // commit a half-applied transaction.
  for (const suffix of ['-shm', '-wal']) fs.rmSync(target + suffix, { force: true });
}

console.log('seed.db rebuilt — commit it');
