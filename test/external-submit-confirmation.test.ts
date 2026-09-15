import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ExternalFormPlanSchema, sha256 } from '../src/index.js';
const read = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
const old = read('ctx.external-form-plan.v1');
const next = read('ctx.external-form-plan.v1.submit-confirmation');
it('preserves old authorized bytes and binds the optional second confirmation into the digest', async () => {
  expect(ExternalFormPlanSchema.parse(old)).toEqual(old);
  expect(await sha256(ExternalFormPlanSchema.parse(old))).toEqual(await sha256(old));
  expect(ExternalFormPlanSchema.parse(next)).toEqual(next);
  expect(await sha256(next)).not.toEqual(await sha256(old));
  for (const patch of [{ prompt: { ...next.submit_confirmation.prompt, text: 'Other prompt' } },
    { submit: { ...next.submit_confirmation.submit, text: 'Other action' } }]) {
    expect(await sha256({ ...next, submit_confirmation: { ...next.submit_confirmation, ...patch } })).not.toEqual(await sha256(next));
  }
});
it('requires a bounded declared prompt, submit label and guard; rejects arbitrary scripts and step loops', () => {
  for (const step of [null, [], {...next.submit_confirmation, prompt: undefined},
    {...next.submit_confirmation, submit: {locator: next.submit_confirmation.submit.locator}},
    {...next.submit_confirmation, guards: []}, {...next.submit_confirmation, guards: Array(11).fill(next.submit_confirmation.guards[0])},
    {...next.submit_confirmation, script: 'click anything'}, {...next.submit_confirmation, repeat: true}]) {
    expect(ExternalFormPlanSchema.safeParse({...next, submit_confirmation: step}).success).toBe(false);
  }
});
