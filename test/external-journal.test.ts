import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ExternalFormStepSchema, ExternalFormPlanSchema, sha256, EXPERT_NETWORK_DOMAINS, EXPERT_NETWORK_PROVIDERS } from '../src/index.js';
const read = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
it('bounds the journal and rejects raw page content or claimed pass authority', () => {
  const step = read('ctx.external-form-step.v1');
  expect(ExternalFormStepSchema.parse(step)).toEqual(step);
  for (const patch of [{ sequence: 0 }, { sequence: 1025 }, { step: 'click anything' },
    { passed: true }, { body: 'private text' }, { field_index: 100 }, { url: 'https://secret.example' }])
    expect(ExternalFormStepSchema.safeParse({ ...step, ...patch }).success).toBe(false);
});
it('binds reviewed request fields and radio selectors into the plan digest without changing old plans', async () => {
  const old = read('ctx.external-form-plan.v1');
  expect(ExternalFormPlanSchema.parse(old)).toEqual(old);
  const plan = { ...old, request: {url: old.url, method:'POST', encoding:'json',
    answer_fields:[{key:old.fields[0].key,field:'answer'}], static_fields:{project:'reviewed'} } };
  expect(ExternalFormPlanSchema.parse(plan)).toEqual(plan);
  expect(await sha256(plan)).not.toBe(await sha256(old));
  expect(ExternalFormPlanSchema.parse({...old,fields:[{...old.fields[0],control:'radio'}]}).fields[0]!.control).toBe('radio');
});
it('maps every known provider explicitly without overlapping sender domains', () => {
  expect(Object.keys(EXPERT_NETWORK_DOMAINS)).toEqual([...EXPERT_NETWORK_PROVIDERS]);
  const domains=Object.values(EXPERT_NETWORK_DOMAINS).flat();
  expect(new Set(domains).size).toBe(domains.length);
});
