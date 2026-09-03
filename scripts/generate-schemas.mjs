import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ENVELOPES } from '../dist/registry.js';
import { generateSchemas } from './schema-gen.mjs';

const dir = resolve(import.meta.dirname, '../schemas');
mkdirSync(dir, { recursive: true });
for (const name of readdirSync(dir)) if (name.endsWith('.json')) rmSync(resolve(dir, name));
const schemas = generateSchemas(ENVELOPES);
for (const [contract, schema] of Object.entries(schemas)) {
  writeFileSync(resolve(dir, `${contract}.json`), `${JSON.stringify(schema, null, 2)}\n`);
}
writeFileSync(resolve(dir, 'index.json'), `${JSON.stringify({ contracts: Object.keys(schemas) }, null, 2)}\n`);
console.log(`wrote ${Object.keys(schemas).length} schemas to ${dir}`);
