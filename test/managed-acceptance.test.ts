import { describe, expect, it } from 'vitest';
import { ManagedBrowserAcceptanceSchema, SubmitManagedJobInputSchema } from '../src/envelopes.js';

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
