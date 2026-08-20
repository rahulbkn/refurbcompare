import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'generated', 'client');
const dest = join(here, '..', 'dist', 'generated', 'client');

if (!existsSync(src)) {
  console.error('Generated Prisma client not found. Run `npm run generate -w @refurbcompare/db` first.');
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied generated Prisma client -> ${dest}`);
