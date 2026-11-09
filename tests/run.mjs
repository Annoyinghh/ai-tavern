import './register.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const load = createRequire(import.meta.url);
const directory = path.dirname(fileURLToPath(import.meta.url));
const selected = process.argv.slice(2);
for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.test.ts'))) {
  if (!selected.length || selected.some(name => file.includes(name))) load(path.join(directory, file));
}
