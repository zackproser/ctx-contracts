import { describe, expect, it } from 'vitest';
import { sha256, stable } from '../src/canonical.js';

describe('canonical JSON', () => {
  it('sorts keys recursively and leaves arrays ordered', () => {
    expect(JSON.stringify(stable({ b: [ { z: 1, a: 2 } ], a: null }))).toBe('{"a":null,"b":[{"a":2,"z":1}]}');
  });

  it('digests the same bytes regardless of key order (pinned vector)', async () => {
    const forward = await sha256({ schema: 'ctx.work-completion.v1', nodes: [], edges: [] });
    const reversed = await sha256({ edges: [], nodes: [], schema: 'ctx.work-completion.v1' });
    expect(forward).toBe(reversed);
    // sha256('{"edges":[],"nodes":[],"schema":"ctx.work-completion.v1"}') — every
    // stored shape_hash in production depends on this exact byte form.
    expect(forward).toBe('cfadbe4601e871ed7c84163e268caf510a1aa03a7c3d338b10e9f7c5572e74ec');
  });
});
