import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index.js';
import { parseEnvelope } from '../src/registry.js';

// A fill-and-stop recipe tells a browser worker which fields of an expert
// network's form to fill, which to leave for the owner, and what to capture
// and hand back before it stops. It can never say "submit": the contract has
// no way to express that, and the readback cannot claim it happened.
const read = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
const Recipe = (contracts as Record<string, any>).ExternalFormFillSchema;
const Readback = (contracts as Record<string, any>).ExternalFormFillReadbackSchema;
const recipe = () => read('ctx.external-form-fill.v1');
const readback = () => read('ctx.external-form-fill-readback.v1');
const ok = (schema: any, value: unknown) => schema.safeParse(value).success;

describe('ctx.external-form-fill.v1', () => {
  it('is a registered contract whose golden fixtures parse unchanged', () => {
    expect(Recipe, 'ExternalFormFillSchema is exported').toBeTruthy();
    expect(Recipe.parse(recipe())).toEqual(recipe());
    expect(parseEnvelope(recipe())).toEqual(recipe());
    expect(Recipe.parse(read('ctx.external-form-fill.v1.officehours'))).toEqual(read('ctx.external-form-fill.v1.officehours'));
    expect((contracts as Record<string, any>).EXTERNAL_FORM_FILL_KINDS).toEqual(['google_form', 'officehours_apply', 'tegus_form']);
  });

  it('cannot say submit: must_not_submit is always true and there is no field for an action', () => {
    expect(recipe().must_not_submit).toBe(true);
    expect(ok(Recipe, { ...recipe(), must_not_submit: false })).toBe(false);
    const { must_not_submit: _dropped, ...without } = recipe();
    expect(ok(Recipe, without)).toBe(false);
    for (const extra of [{ submit: true }, { submit: { by: 'role', role: 'button', name: 'Submit' } }, { action: 'submit' }, { then: 'click Submit' }, { authorized: true }])
      expect(ok(Recipe, { ...recipe(), ...extra }), JSON.stringify(extra)).toBe(false);
    // The worker is told what to stop before, and that list is never empty.
    expect(recipe().stop_before.length).toBeGreaterThan(0);
    expect(ok(Recipe, { ...recipe(), stop_before: [] })).toBe(false);
  });

  it('marks every blank as the owner\'s: no answer, and the reason; a filled field has an answer', () => {
    const fields = recipe().fields;
    expect(fields.some((field: any) => field.needs_owner)).toBe(true);
    expect(fields.some((field: any) => !field.needs_owner)).toBe(true);
    const withField = (patch: Record<string, unknown>, index = 0) => ({ ...recipe(), fields: fields.map((field: any, i: number) => (i === index ? { ...field, ...patch } : field)) });
    const blank = fields.findIndex((field: any) => field.needs_owner);
    const filled = fields.findIndex((field: any) => !field.needs_owner);
    expect(ok(Recipe, withField({ answer: 'a guess' }, blank))).toBe(false);
    expect(ok(Recipe, withField({ reason: undefined }, blank))).toBe(false);
    expect(ok(Recipe, withField({ reason: '   ' }, blank))).toBe(false);
    expect(ok(Recipe, withField({ answer: '' }, filled))).toBe(false);
    expect(ok(Recipe, withField({ answer: '   ' }, filled))).toBe(false);
    expect(ok(Recipe, withField({ key: fields[1].key }, 0))).toBe(false);
    // A field the recipe does not name is always left blank and reported, never guessed.
    expect(recipe().unmapped_fields).toBe('leave_blank_and_report');
    expect(ok(Recipe, { ...recipe(), unmapped_fields: 'best_effort' })).toBe(false);
  });

  it('is never written for a network that bans AI-written answers', () => {
    expect((contracts as Record<string, any>).EXPERT_NETWORKS_BANNING_AI_ANSWERS).toEqual(['glg', 'guidepoint']);
    for (const provider of ['glg', 'guidepoint'])
      expect(ok(Recipe, { ...recipe(), provider }), provider).toBe(false);
    for (const provider of ['alphasights', 'tegus', 'coleman', 'thirdbridge'])
      expect(ok(Recipe, { ...recipe(), provider }), provider).toBe(true);
    expect(ok(Recipe, { ...recipe(), provider: 'unknown' })).toBe(false);
  });

  it('names a form of its kind, over HTTPS, with no credentials in the URL', () => {
    const at = (kind: string, provider: string, url: string) => ok(Recipe, { ...recipe(), kind, provider, url });
    // Google Forms: the short link or the form itself.
    expect(at('google_form', 'alphasights', 'https://forms.gle/uaB8WecpevwYX4Ck9')).toBe(true);
    expect(at('google_form', 'alphasights', 'https://docs.google.com/forms/d/e/1FAIpQLSfixture/viewform')).toBe(true);
    expect(at('google_form', 'alphasights', 'https://docs.google.com/document/d/1/edit')).toBe(false);
    expect(at('google_form', 'alphasights', 'https://forms.gle.evil.example/uaB8WecpevwYX4Ck9')).toBe(false);
    expect(at('google_form', 'alphasights', 'http://forms.gle/uaB8WecpevwYX4Ck9')).toBe(false);
    expect(at('google_form', 'alphasights', 'https://user:pass@forms.gle/uaB8WecpevwYX4Ck9')).toBe(false);
    // The Office Hours apply page, for Office Hours only, and never its opt-out page.
    expect(at('officehours_apply', 'officehours', 'https://officehours.com/opportunity/qF1_ND?prospectId=p1')).toBe(true);
    expect(at('officehours_apply', 'officehours', 'https://officehours.com/opportunity/qF1_ND/opt-out?prospectId=p1')).toBe(false);
    expect(at('officehours_apply', 'officehours', 'https://officehours.com/unsubscribe?prospectId=p1')).toBe(false);
    expect(at('officehours_apply', 'alphasights', 'https://officehours.com/opportunity/qF1_ND')).toBe(false);
    expect(at('officehours_apply', 'officehours', 'https://forms.gle/uaB8WecpevwYX4Ck9')).toBe(false);
    // A Tegus form, on a Tegus or AlphaSense host, for Tegus only.
    expect(at('tegus_form', 'tegus', 'https://forms.tegus.com/screener/abc123')).toBe(true);
    expect(at('tegus_form', 'tegus', 'https://emails.tegus.co/629654f0/l/RALNXSnICsixVDDiY')).toBe(true);
    expect(at('tegus_form', 'tegus', 'https://research.alpha-sense.com/expert/form/1')).toBe(true);
    expect(at('tegus_form', 'tegus', 'https://nottegus.com/form')).toBe(false);
    expect(at('tegus_form', 'alphasights', 'https://forms.tegus.com/screener/abc123')).toBe(false);
  });

  it('says what the worker must capture and return before it stops: the whole list, and a full-page screenshot', () => {
    const captures = (contracts as Record<string, any>).EXTERNAL_FORM_FILL_CAPTURES;
    expect(captures).toEqual(['final_url', 'page_title', 'field_values', 'unmapped_fields', 'submit_controls', 'validation_errors', 'screenshot']);
    expect(recipe().readback).toEqual({ contract: 'ctx.external-form-fill-readback.v1', screenshot: 'full_page_after_fill', capture: captures });
    expect(ok(Recipe, { ...recipe(), readback: { ...recipe().readback, capture: captures.slice(0, -1) } })).toBe(false);
    expect(ok(Recipe, { ...recipe(), readback: { ...recipe().readback, screenshot: 'none' } })).toBe(false);
    const { readback: _dropped, ...without } = recipe();
    expect(ok(Recipe, without)).toBe(false);
  });
});

describe('ctx.external-form-fill-readback.v1', () => {
  it('is a registered contract whose golden fixture parses unchanged and binds the recipe by digest', async () => {
    expect(Readback, 'ExternalFormFillReadbackSchema is exported').toBeTruthy();
    expect(Readback.parse(readback())).toEqual(readback());
    expect(parseEnvelope(readback())).toEqual(readback());
    expect(readback().recipe_digest).toBe(await contracts.sha256(recipe()));
  });

  it('cannot claim a submit: submitted is always false', () => {
    expect(readback().submitted).toBe(false);
    expect(ok(Readback, { ...readback(), submitted: true })).toBe(false);
    const { submitted: _dropped, ...without } = readback();
    expect(ok(Readback, without)).toBe(false);
    for (const extra of [{ passed: true }, { confirmation_text: 'Your response has been recorded.' }, { phase: 'submitted' }])
      expect(ok(Readback, { ...readback(), ...extra }), JSON.stringify(extra)).toBe(false);
  });

  it('carries the screenshot by digest, the values it left in each field, and every field the recipe did not name', () => {
    const value = readback();
    expect(value.screenshot).toMatchObject({ media_type: 'image/png' });
    expect(value.screenshot.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(value.fields.map((field: any) => field.key)).toEqual(recipe().fields.map((field: any) => field.key));
    expect(value.unmapped_fields.length).toBeGreaterThan(0);
    const { screenshot: _dropped, ...without } = value;
    expect(ok(Readback, without)).toBe(false);
    expect(ok(Readback, { ...value, screenshot: { ...value.screenshot, sha256: 'not-a-digest' } })).toBe(false);
    expect(ok(Readback, { ...value, screenshot: { ...value.screenshot, media_type: 'text/html' } })).toBe(false);
    expect(ok(Readback, { ...value, recipe_digest: 'short' })).toBe(false);
    expect(ok(Readback, { ...value, url: 'http://forms.gle/x' })).toBe(false);
  });
});
