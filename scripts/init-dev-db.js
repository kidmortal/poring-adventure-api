/**
 * Makes the local dev.db by copying the committed seed.db.
 *
 * seed.db is the content — items, monsters, skills, dungeons — with no players
 * in it, so it is safe to track. dev.db is whatever your machine has done since
 * then, and is ignored. Run this once after cloning:
 *
 *   yarn db:init          # creates dev.db if it is missing
 *   yarn db:init --force  # throws the local database away and starts over
 *
 * Everything the seed writes can be refreshed later with `yarn seed`; this is
 * only about getting a schema on disk without asking anyone to run migrations
 * by hand.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const seed = path.join(root, 'seed.db');
const dev = path.join(root, 'dev.db');
const force = process.argv.includes('--force');

if (!fs.existsSync(seed)) {
  console.error('no seed.db beside package.json — it is tracked, so a clone should have one');
  process.exit(1);
}

if (fs.existsSync(dev) && !force) {
  console.log('dev.db already exists, leaving it alone (pass --force to replace it)');
  process.exit(0);
}

// The journal files belong to the database being replaced, and a stale pair
// will happily undo the copy the next time sqlite opens it.
for (const suffix of ['-shm', '-wal']) {
  fs.rmSync(dev + suffix, { force: true });
}

fs.copyFileSync(seed, dev);
console.log(force ? 'dev.db reset from seed.db' : 'dev.db created from seed.db');
