import { describe, expect, it } from 'vitest';
import { ManagedBrowserAcceptanceSchema, ManagedJobSchema, SubmitManagedJobInputSchema } from '../src/envelopes.js';

const request = { idempotency_key: 'managed-retry-test', title: 'A game', prompt: 'Build a game' };
const assertion = { action: 'assert', locator: { by: 'testId', testId: 'score' }, check: 'textEquals', expected: '0' };
describe('managed build admission and owner acceptance', () => {
  it('defaults to six attempts and permits an explicit bounded ceiling of eight', () => {
    expect(SubmitManagedJobInputSchema.parse(request).max_build_attempts).toBe(6);
    expect(SubmitManagedJobInputSchema.parse({ ...request, max_build_attempts: 8 }).max_build_attempts).toBe(8);
    expect(SubmitManagedJobInputSchema.safeParse({ ...request, max_build_attempts: 9 }).success).toBe(false);
  });
  it('accepts the existing journey actions while preserving explicit legacy limits', () => {
    const acceptance = { steps: [
      { action: 'click', locator: { by: 'testId', testId: 'restart' } },
      { action: 'press', locator: { by: 'css', css: 'body' }, key: 'ArrowRight' }, assertion,
    ] };
    expect(SubmitManagedJobInputSchema.parse({ ...request, max_build_attempts: 3, acceptance }).max_build_attempts).toBe(3);
    expect(ManagedBrowserAcceptanceSchema.parse(acceptance).steps).toHaveLength(3);
  });
  it('requires observable, typed assertions and bounded steps', () => {
    for (const steps of [[], [{ action: 'click', locator: { by: 'testId', testId: 'restart' } }],
      [{ ...assertion, expected: undefined }], [{ ...assertion, check: 'count', expected: '2' }],
      [{ ...assertion, timeoutMs: 6000 }], Array(81).fill(assertion)])
      expect(ManagedBrowserAcceptanceSchema.safeParse({ steps }).success).toBe(false);
  });
  it('refuses arbitrary navigation, network requests, script fields and oversized payloads', () => {
    for (const step of [{ action: 'navigate', url: 'https://example.com' },
      { action: 'http', url: 'https://example.com', status: 200 },
      { ...assertion, script: 'return true' },
      { ...assertion, expected: 'x'.repeat(17000) }])
      expect(ManagedBrowserAcceptanceSchema.safeParse({ steps: [step, assertion] }).success).toBe(false);
  });
});

describe('managed output accounting', () => {
  const base = {
    contract: 'ctx.managed-job.v1', job_id: '10000000-0000-4000-8000-000000000001', task_item_id: '10000000-0000-4000-8000-000000000001',
    title: 't', state: 'running', status_url: 'https://ctx.test/s', accepted_at: '2026-10-28T00:00:00.000Z', deadline_at: '2026-10-28T01:00:00.000Z',
    last_contact_at: null, last_progress_at: null, last_checkpoint_at: null, recent_events: [], build: null, deployment: null,
    notification: { configured: false, pending: 0 }, error: null,
  };
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, requests: 0, priced_usd: 0, reserved_usd: 0, budget_usd: 5,
    pricing_version: 'p', billing_status: 'priced_usage_not_invoice', compute_usd: null, interface_usage: 'unavailable' };
  it('keeps open, uncertain and no-output spend through a parse', () => {
    const parsed = ManagedJobSchema.parse({ ...base, usage: { ...usage, priced_usd: 0.33, reserved_usd: 0.9, unknown_reserved_usd: 0.4, open_reserved_usd: 0.5, exposure_usd: 1.23, no_output_usd: 0.33, no_output_turns: 1, consecutive_no_output_turns: 1 } });
    expect(parsed.usage).toMatchObject({ open_reserved_usd: 0.5, exposure_usd: 1.23, no_output_usd: 0.33, no_output_turns: 1, consecutive_no_output_turns: 1 });
  });
  it('accepts older snapshots without the fields and rejects negative or fractional counts', () => {
    expect(ManagedJobSchema.parse({ ...base, usage }).usage.no_output_usd).toBeUndefined();
    expect(() => ManagedJobSchema.parse({ ...base, usage: { ...usage, no_output_usd: -1 } })).toThrow();
    expect(() => ManagedJobSchema.parse({ ...base, usage: { ...usage, no_output_turns: 1.5 } })).toThrow();
  });
});
