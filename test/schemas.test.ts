// Conformance: the committed JSON Schema files are exactly what the Zod source
// generates, every file compiles under JSON Schema 2020-12, and every golden
// fixture is accepted by BOTH validators (and rejected by both when broken).
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { CONTRACTS, ENVELOPES, parseEnvelope } from '../src/registry.js';
// @ts-expect-error plain ESM script shared with the generator CLI
import { generateSchemas } from '../scripts/schema-gen.mjs';

const root = resolve(import.meta.dirname, '..');
const generated = generateSchemas(ENVELOPES) as Record<string, Record<string, unknown>>;
const ajv = addFormats.default(new Ajv2020({ strict: true, allErrors: true }));

function validator(contract: string) {
  const schema = committed(contract);
  return ajv.getSchema(schema.$id) ?? ajv.compile(schema);
}

function committed(contract: string) {
  return JSON.parse(readFileSync(resolve(root, 'schemas', `${contract}.json`), 'utf8'));
}

describe('generated JSON Schema 2020-12', () => {
  it('covers every registered contract and nothing else', () => {
    const files = readdirSync(resolve(root, 'schemas')).filter((name) => name !== 'index.json').map((name) => name.replace(/\.json$/, ''));
    expect(files.sort()).toEqual([...CONTRACTS].sort());
    expect(JSON.parse(readFileSync(resolve(root, 'schemas/index.json'), 'utf8'))).toEqual({ contracts: CONTRACTS });
  });

  it.each(CONTRACTS)('%s: committed file is fresh, is 2020-12, and compiles', (contract) => {
    expect(committed(contract)).toEqual(generated[contract]);
    expect(committed(contract).$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(JSON.stringify(committed(contract))).not.toMatch(/"items":\s*\[|"definitions"/); // no draft-07-only forms
    expect(() => validator(contract)).not.toThrow();
  });
});

describe('golden fixtures', () => {
  const fixtures = readdirSync(resolve(root, 'fixtures')).filter((name) => name.endsWith('.json'));

  it('exist for every contract', () => {
    expect(fixtures.map((name) => name.replace(/\.json$/, '')).sort()).toEqual([...CONTRACTS].sort());
  });

  it.each(fixtures)('%s validates under Zod and Ajv alike', (file) => {
    const fixture = JSON.parse(readFileSync(resolve(root, 'fixtures', file), 'utf8'));
    const contract = file.replace(/\.json$/, '');
    expect(fixture.contract).toBe(contract);
    expect(() => parseEnvelope(fixture)).not.toThrow();
    const validate = validator(contract);
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);
    const wrong = { ...fixture, contract: 'ctx.not-a-contract.v1' };
    expect(() => ENVELOPES[contract as keyof typeof ENVELOPES].parse(wrong)).toThrow();
    expect(validate(wrong)).toBe(false);
  });
});
