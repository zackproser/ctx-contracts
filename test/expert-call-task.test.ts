import { expect, it } from 'vitest';
import { ExpertCallTaskMetadataSchema } from '../src/envelopes.js';
import { EXPERT_CALL_TASK, EXPERT_NETWORK_LABELS, EXPERT_NETWORK_PROVIDERS } from '../src/vocabulary.js';

it.each(EXPERT_NETWORK_PROVIDERS)('classifies %s under one task family', (provider) => {
  expect(ExpertCallTaskMetadataSchema.parse({ task_type: EXPERT_CALL_TASK.id, provider }))
    .toEqual({ task_type: 'expert_consultation', provider });
  expect(EXPERT_NETWORK_LABELS[provider]).toBeTruthy();
});
it('rejects unsupported classifications and never carries submission authority', () => {
  expect(() => ExpertCallTaskMetadataSchema.parse({ task_type: 'email', provider: 'alphasights' })).toThrow();
  expect(() => ExpertCallTaskMetadataSchema.parse({ task_type: EXPERT_CALL_TASK.id, provider: 'unknown' })).toThrow();
  expect(() => ExpertCallTaskMetadataSchema.parse({ task_type: EXPERT_CALL_TASK.id, provider: 'glg', authorized: true })).toThrow();
});
