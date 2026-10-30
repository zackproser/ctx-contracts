import { describe, expect, it } from 'vitest';
import { DELIVERY_MODES } from '../src/index.js';

// Launch requests and stored jobs already carry the first two values, so their
// order and meaning are wire-stable; the third is additive.
describe('DELIVERY_MODES', () => {
  it('keeps report_only and pull_request first and adds publish_after_verify', () => {
    expect(DELIVERY_MODES).toEqual(['report_only', 'pull_request', 'publish_after_verify']);
  });
});
