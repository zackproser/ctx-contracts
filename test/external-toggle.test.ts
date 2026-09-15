import { expect, it } from 'vitest';
import { ExternalFormPlanSchema } from '../src/envelopes.js';
import { readFileSync } from 'node:fs';

const base = JSON.parse(readFileSync(new URL('../fixtures/ctx.external-form-plan.v1.json', import.meta.url), 'utf8'));
it('keeps existing form plans byte-compatible while requiring declared toggle state', () => {
  expect(ExternalFormPlanSchema.parse(base)).toEqual(base);
  const toggle = { key: 'slot', control: 'toggle', locator: { by: 'role', role: 'button', name: '01:00 PM' },
    selected: { attribute: 'class', value: 'tab-active' },
    navigate: { locator: { by: 'text', text: '16 Wed' }, selected: { attribute: 'class', value: 'tab-active' } } };
  expect(ExternalFormPlanSchema.parse({ ...base, fields: [toggle] }).fields[0]).toMatchObject(toggle);
  expect(ExternalFormPlanSchema.safeParse({ ...base, fields: [{ ...toggle, selected: undefined }] }).success).toBe(false);
  expect(ExternalFormPlanSchema.safeParse({ ...base, fields: [{ ...toggle, selected: { attribute: 'onclick', value: 'run()' } }] }).success).toBe(false);
});
