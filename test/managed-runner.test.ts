import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ManagedJobSchema, SubmitManagedJobInputSchema } from '../src/envelopes.js';
import { ManagedOrbAssignmentSchema, ManagedRunnerCandidateSchema, ManagedRunnerLeaseSchema, ManagedRunnerLeaseInputSchema, ManagedRunnerCheckpointManifestSchema } from '../src/managed-runner.js';

const id = '11111111-1111-4111-8111-111111111111';
const sha = 'a'.repeat(64);
const legacy = JSON.parse(readFileSync(new URL('../fixtures/ctx.managed-job.v1.json', import.meta.url), 'utf8'));

describe('managed Orb runtime contracts', () => {
  it('keeps legacy job snapshots valid without inventing usage or runtime', () => {
    const parsed = ManagedJobSchema.parse(legacy);
    expect(parsed.runtime).toBeUndefined();
    expect(parsed.health).toBeUndefined();
    expect(parsed.usage.orb).toBeUndefined();
  });
  it('carries pinned runtime, separate observed Orb spend and a later regression', () => {
    const parsed = ManagedJobSchema.parse({ ...legacy,
      runtime: { coder: { harness: 'pi-durable@1.4.0', host: 'amp-orb', model: 'claude-opus-5-5', effort: 'xhigh', policy_id: 'opus-5-5-xhigh-v1' }, bootstrap: { mechanism: 'amp-agent-start-hook', inference_requests: 0 } },
      health: { status: 'degraded', checked_at: '2026-10-27T20:00:00Z', receipt_ids: [id] },
      gates: { functional: { status: 'passed', receipt_id: id }, deployment: { status: 'passed', receipt_id: id }, visual: { status: 'not_required', receipt_id: null } },
      usage: { ...legacy.usage, model_policy: 'opus-5-5-xhigh-v1', cache_write_tokens: 120, unknown_reserved_usd: 1.5,
        orb: { amp_usd: null, runtime_seconds: null, source: 'unavailable', observed_at: null } },
    });
    expect(parsed.runtime?.coder.effort).toBe('xhigh');
    expect(parsed.health?.status).toBe('degraded');
    expect(parsed.gates?.functional.receipt_id).toBe(id);
    expect(parsed.usage.orb?.amp_usd).toBeNull();
    expect(() => ManagedJobSchema.parse({ ...parsed, usage: { ...parsed.usage, unknown_reserved_usd: -1 } })).toThrow();
  });
  it('freezes optional visual criteria and preserves the existing default budget', () => {
    const input = SubmitManagedJobInputSchema.parse({ idempotency_key: 'managed:design:test', title: 'Garden', prompt: 'Build a garden', visual_acceptance: { criteria: ['Readable on phone'], reference_artifact_ids: [id] } });
    expect(input.budget_usd).toBe(5);
    expect(input.visual_acceptance?.reference_artifact_ids).toEqual([id]);
    expect(() => SubmitManagedJobInputSchema.parse({ ...input, visual_acceptance: { criteria: [] } })).toThrow();
  });
  it('rejects caller-supplied lease authority and invalid restore identities', () => {
    expect(ManagedRunnerLeaseInputSchema.parse({ instance_id: id })).toEqual({ instance_id: id });
    expect(() => ManagedRunnerLeaseInputSchema.parse({ instance_id: id, runner_epoch: 99 })).toThrow();
    const lease = { runner_epoch: 1, managed_job_id: id, policy_id: 'opus-5-5-xhigh-v1', deadline_at: '2026-10-27T21:00:00Z', budget_usd: 5, generation: 0, prompt: 'Build', acceptance: null, latest_steering: null, checkpoint: null };
    expect(ManagedRunnerLeaseSchema.parse(lease).checkpoint).toBeNull();
    expect(() => ManagedRunnerLeaseSchema.parse({ ...lease, runner_epoch: 0 })).toThrow();
    expect(() => ManagedRunnerCheckpointManifestSchema.parse({ git_sha256: sha, session_sha256: sha, source_tree_sha: sha, inbox_ids: [], verified: true })).toThrow();
  });
  it('accepts compiled module bytes while rejecting traversal and receipt forgery', () => {
    const candidate = { source_tree_sha: sha, main: 'worker.mjs', modules: [{ name: 'worker.mjs', type: 'esm', content_base64: 'ZXhwb3J0IHt9' }], logs: { build: 'passed', test: 'passed' }, diff_stat: '1 file changed' };
    expect(ManagedRunnerCandidateSchema.parse(candidate).main).toBe('worker.mjs');
    for (const name of ['../worker.mjs', '/worker.mjs', 'nested/../worker.mjs', '__ctx-entry.mjs']) {
      expect(() => ManagedRunnerCandidateSchema.parse({ ...candidate, main: name })).toThrow();
    }
    expect(() => ManagedRunnerCandidateSchema.parse({ ...candidate, passed: true })).toThrow();
  });
  it('requires immutable runner source on signed Orb assignments', () => {
    const assignment = { contract: 'ctx.managed-orb-assignment.v1', managed_job_id: id, agent_job_id: id, attempt: 1, policy_id: 'opus-5-5-xhigh-v1', runner_commit: 'b'.repeat(40) };
    expect(ManagedOrbAssignmentSchema.parse(assignment).runner_commit).toBe('b'.repeat(40));
    expect(() => ManagedOrbAssignmentSchema.parse({ ...assignment, runner_commit: 'main' })).toThrow();
  });
});

it('accepts bounded retained design evidence on a lease and rejects an oversized reference', () => {
  const ref={artifact_id:'10000000-0000-4000-8000-000000000001',source_sha256:'a'.repeat(64),media_type:'image/jpeg',content_base64:'AA=='};
  const lease={runner_epoch:1,managed_job_id:ref.artifact_id,policy_id:'opus-5-5-xhigh-v1',deadline_at:new Date().toISOString(),budget_usd:5,generation:0,prompt:'Build',acceptance:null,latest_steering:null,checkpoint:null,design_references:[ref]};
  expect(ManagedRunnerLeaseSchema.parse(lease).design_references?.[0]?.source_sha256).toBe(ref.source_sha256);
  expect(()=>ManagedRunnerLeaseSchema.parse({...lease,design_references:[{...ref,content_base64:'A'.repeat(60004)}]})).toThrow();
  expect(()=>ManagedRunnerLeaseSchema.parse({...lease,design_references:Array(6).fill(ref)})).toThrow();
});
it('allows an explicit same-page reload in frozen acceptance without granting arbitrary navigation', () => {
  const input={idempotency_key:'managed-reload-proof',title:'Reload persistence',prompt:'Keep progress after reload',acceptance:{steps:[{action:'reload'},{action:'assert',locator:{by:'css',css:'body'},check:'visible'}]}};
  expect(SubmitManagedJobInputSchema.parse(input).acceptance?.steps[0]?.action).toBe('reload');
  expect(()=>SubmitManagedJobInputSchema.parse({...input,acceptance:{steps:[{action:'reload',url:'https://other.example'},{action:'assert',locator:{by:'css',css:'body'},check:'visible'}]}})).toThrow();
});

it('tolerates additive server lease fields without relaxing client lease requests', () => {
  const lease={runner_epoch:1,managed_job_id:'10000000-0000-4000-8000-000000000001',policy_id:'opus-5-5-xhigh-v1',deadline_at:new Date().toISOString(),budget_usd:5,generation:0,prompt:'Build',acceptance:null,latest_steering:null,checkpoint:null,future_server_observation:'retained'};
  expect(ManagedRunnerLeaseSchema.parse(lease).future_server_observation).toBe('retained');
  expect(()=>ManagedRunnerLeaseInputSchema.parse({instance_id:lease.managed_job_id,runner_epoch:1})).toThrow();
});
