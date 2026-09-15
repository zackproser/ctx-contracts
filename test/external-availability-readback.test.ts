import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ExternalFormPlanSchema, ExternalFormEvidenceSchema, sha256 } from '../src/index.js';
const read = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
it('preserves legacy plan/evidence bytes and binds the provider endpoint and baseline', async () => {
  for (const variant of ['ctx.external-form-plan.v1','ctx.external-form-plan.v1.submit-confirmation']) {
    const old=read(variant);expect(ExternalFormPlanSchema.parse(old)).toEqual(old);
    expect(await sha256(ExternalFormPlanSchema.parse(old))).toBe(await sha256(old));
  }
  const oldEvidence=read('ctx.external-form-evidence.v1');expect(ExternalFormEvidenceSchema.parse(oldEvidence)).toEqual(oldEvidence);
  const plan=read('ctx.external-form-plan.v1.availability-readback');expect(ExternalFormPlanSchema.parse(plan)).toEqual(plan);
  for(const patch of [{url:plan.confirmation.url+'-other'}, {baseline:{...plan.confirmation.baseline,advisor_name:'Another advisor'}}])
    expect(await sha256({...plan,confirmation:{...plan.confirmation,...patch}})).not.toBe(await sha256(plan));
});
it('requires bounded typed state and never accepts a supplied passed flag or visible receipt fallback', () => {
  const plan=read('ctx.external-form-plan.v1.availability-readback');
  for(const confirmation of [{...plan.confirmation,passed:true},{...plan.confirmation,baseline:undefined},
    {...plan.confirmation,locator:{by:'text',text:'Saved'}},
    {...plan.confirmation,locator:{by:'text',text:'Saved'},text:'Saved'}, {...plan.confirmation,baseline:{...plan.confirmation.baseline,slots:Array(1001).fill({starts_at:'2026-09-16T12:00:00.000Z',ends_at:'2026-09-16T13:00:00.000Z'})}}])
    expect(ExternalFormPlanSchema.safeParse({...plan,confirmation}).success).toBe(false);
  const e=read('ctx.external-form-evidence.v1.availability-readback');expect(ExternalFormEvidenceSchema.parse(e)).toEqual(e);
  expect(ExternalFormEvidenceSchema.safeParse({...e,availability_readback:{...e.availability_readback,status:403}}).success).toBe(false);
});
