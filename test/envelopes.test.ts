import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ObligationIRSchema, TodoHandleSchema, VerifierPlanSchema, WebJourneySchema, WorkCompletionSchema,
  WorkNodeInstructionsSchema, WorkOutcomeDraftSchema, WorkRunDetailSchema, WorkRunLaunchSchema,
} from '../src/envelopes.js';
import { parseEnvelope } from '../src/registry.js';

const taskId = '11111111-1111-4111-8111-111111111111';
const nodeId = '22222222-2222-4222-8222-222222222222';
const jobId = '33333333-3333-4333-8333-333333333333';
const shapeHash = 'a'.repeat(64);

const base = {
  contract: 'ctx.web-journey.v1', name: 'smoke', url: 'http://127.0.0.1:3000/',
  fixtures: [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }],
  steps: [{ action: 'assert', locator: { by: 'role', role: 'heading', name: 'Ready' }, check: 'visible' }],
};

describe('ctx.web-journey.v1', () => {
  it('requires a desktop, a phone, and a real assertion', () => {
    expect(WebJourneySchema.parse(base).fixtures).toHaveLength(2);
    expect(() => WebJourneySchema.parse({ ...base, fixtures: [base.fixtures[0]] })).toThrow(/phone|at least 2/i);
    expect(() => WebJourneySchema.parse({ ...base, steps: [{ action: 'screenshot', name: 'loaded' }] })).toThrow(/assertion/i);
  });

  it('rejects an assertion with no expected value when the check needs one', () => {
    expect(() => WebJourneySchema.parse({ ...base, steps: [{ action: 'assert', locator: { by: 'text', text: 'x' }, check: 'textEquals' }] })).toThrow(/expected/);
  });
});

const productionDraft = () => JSON.parse(readFileSync(
  resolve(import.meta.dirname, '../fixtures/ctx.work-outcome-draft.v1.multi-repo-join.json'), 'utf8',
));

describe('prompt-to-graph MCP responses', () => {
  it('carries an independently checked GitHub CI obligation and receipt binding', () => {
    const draft = productionDraft();
    draft.ir.checks.push({ kind: 'github_checks', target: draft.ir.repositories[0].id,
      provenance: [{ start: 0, end: 8, text: 'green CI' }] });
    draft.extra_receipts = [{ id: 'ctx.github-ci-verifier', version: '1', label: 'GitHub CI', selected: true }];
    expect(WorkOutcomeDraftSchema.parse(draft).ir.checks.at(-1)?.kind).toBe('github_checks');
    expect(WorkOutcomeDraftSchema.parse(draft).extra_receipts[0]?.id).toBe('ctx.github-ci-verifier');
  });
  it('rejects draft responses without the server-owned contract and graph lint', () => {
    expect(() => WorkOutcomeDraftSchema.parse({
      contract: 'ctx.work-outcome-draft.v0', outcome: { nodes: [] },
    })).toThrow();
  });

  // 2026-09-03: production emitted generated_by "merged" and the contract only
  // knew model | deterministic, so `ctx task draft` threw CTX_PROTOCOL on every draft.
  it('accepts every compiler v2 generator, status, fallback reason and template', () => {
    const draft = productionDraft();
    expect(draft.generated_by).toBe('merged');
    expect(WorkOutcomeDraftSchema.parse(draft)).toEqual(draft);
    for (const generated_by of ['deterministic', 'model', 'merged']) expect(WorkOutcomeDraftSchema.parse({ ...draft, generated_by }).generated_by).toBe(generated_by);
    for (const status of ['final', 'improving']) expect(WorkOutcomeDraftSchema.parse({ ...draft, status }).status).toBe(status);
    for (const fallback_reason of [null, 'model_timeout', 'model_invalid', 'model_unconfigured', 'coverage_failed']) {
      expect(WorkOutcomeDraftSchema.parse({ ...draft, fallback_reason }).fallback_reason).toBe(fallback_reason);
    }
    for (const template of ['single_repo_delivery', 'multi_repo_join', 'report_only', 'research_plan_handoff', 'merge_gate', 'owner_checklist']) {
      expect(WorkOutcomeDraftSchema.parse({ ...draft, template }).template).toBe(template);
    }
    expect(() => WorkOutcomeDraftSchema.parse({ ...draft, generated_by: 'oracle' })).toThrow(/generated_by/);
    expect(() => WorkOutcomeDraftSchema.parse({ ...draft, fallback_reason: 'gremlins' })).toThrow(/fallback_reason/);
    expect(() => WorkOutcomeDraftSchema.parse({ ...draft, status: 'done' })).toThrow(/status/);
    expect(() => WorkOutcomeDraftSchema.parse({ ...draft, launch_ready: 'yes' })).toThrow(/launch_ready/);
  });

  it('requires schema_version 2 and the v2 fields; a v1 draft is not N-1 compatible', () => {
    const draft = productionDraft();
    const { schema_version, ir, template, provenance, fallback_reason, model_latency_ms, draft_id, status, ...v1 } = draft;
    expect(() => WorkOutcomeDraftSchema.parse(v1)).toThrow(/schema_version/);
    expect(() => WorkOutcomeDraftSchema.parse({ ...draft, schema_version: 1 })).toThrow(/schema_version/);
    for (const field of ['ir', 'template', 'provenance', 'draft_id', 'status', 'obligations'] as const) {
      const { [field]: _dropped, ...without } = draft;
      expect(() => WorkOutcomeDraftSchema.parse(without), field).toThrow(new RegExp(field));
    }
    expect(() => WorkOutcomeDraftSchema.parse({ ...draft, ir: { ...draft.ir, source: 'oracle' } })).toThrow(/source/);
    expect(ObligationIRSchema.parse(draft.ir)).toEqual(draft.ir);
    expect(parseEnvelope(draft.ir)).toEqual(draft.ir);
  });

  it('requires canonical handling custody instead of a Mermaid projection', () => {
    expect(() => TodoHandleSchema.parse({
      contract: 'ctx.todo-handle.v1', status: 'dispatched',
      task_item_id: '11111111-1111-4111-8111-111111111111',
      graph_created: true, graph_repaired: false,
      graph: { revision: 1, state: 'active', satisfied_count: 0, required_count: 1 },
      node_item_id: null, job_id: null, receipt_id: null, jobs: [], replayed: false,
      reason: 'Missing shape hash.', work_url: '/app?stage=work', fleet_url: null,
      mermaid: 'flowchart LR',
    })).toThrow(/shape_hash/);
  });
});

describe('read-model envelopes', () => {
  it.each([
    ['ctx.work-completion.v1', WorkCompletionSchema, {
      task: { item_id: taskId, revision: 1, shape_hash: shapeHash, state: 'active' },
      nodes: [{ item_id: nodeId, node_key: 'k', status: 'ready' }],
    }],
    ['ctx.work-run-detail.v1', WorkRunDetailSchema, {
      job: { id: jobId, state: 'verified', node_item_id: null }, events: [{ kind: 'status' }],
    }],
    ['ctx.work-node-instructions.v1', WorkNodeInstructionsSchema, {
      custody: {
        task_item_id: taskId, graph_revision: 2, graph_shape_hash: shapeHash,
        node_item_id: null, node_key: null, node_instructions: null,
      },
      execution: { executable: false, code: 'unmodeled_task_root', reason: 'Root custody.' },
    }],
    ['ctx.verifier-plan.v1', VerifierPlanSchema, {
      registry_version: '1', task_item_id: taskId, node_item_id: null, graph_revision: null,
      default_bindings: [], launch_ready: true,
    }],
    ['ctx.work-run.v1', WorkRunLaunchSchema, {
      job_id: jobId, task_item_id: taskId, node_item_id: nodeId, state: 'queued', replayed: true,
    }],
  ] as const)('%s requires its contract literal and passes extra fields through', (contract, schema, body) => {
    const valid = { contract, ...body, server_extension: 'preserved' };
    expect(schema.parse(valid)).toEqual(valid);
    expect(parseEnvelope(valid)).toEqual(valid);
    expect(() => schema.parse({ ...body, server_extension: 'preserved' })).toThrow(/contract/);
    expect(() => schema.parse({ ...valid, contract: 'ctx.mermaid-projection.v1' })).toThrow(/contract/);
    expect(() => parseEnvelope({ ...valid, contract: 'ctx.mermaid-projection.v1' })).toThrow(/unknown CTX contract/);
  });

  it('types the lane fields the server added: repository, obligations, repo, execution', () => {
    const step = {
      key: 'k', node_key: 'k', title: 'Lane', detail: 'd', verifier_id: 'ctx.work-run-artifact',
      verifier_version: '1', verifier_label: 'HARNESS RECEIPT',
    };
    const steps = WorkOutcomeDraftSchema.shape.steps;
    expect(steps.parse([{ ...step, repository: 'zackproser/ctx-cli' }])[0]?.repository).toBe('zackproser/ctx-cli');
    expect(steps.parse([{ ...step, repository: null }])[0]?.repository).toBeNull();
    expect(() => steps.parse([step])).toThrow(/repository/); // v2 always binds the lane, null for CTX-owned nodes
    expect(() => steps.parse([{ ...step, repository: 'not a repo' }])).toThrow(/repository/);
    const obligations = WorkOutcomeDraftSchema.shape.obligations;
    expect(obligations.parse({ repositories: ['zackproser/ctx', 'zackproser/ctx-cli'], join_requested: true, parallel_requested: true }))
      .toMatchObject({ join_requested: true });
    expect(() => obligations.parse({ repositories: ['ctx'], join_requested: true, parallel_requested: true })).toThrow(/repositories/);
    const job = { receipt_id: null, job_id: jobId, node_item_id: nodeId, executor: 'orb', state: 'queued', replayed: false };
    expect(TodoHandleSchema.shape.jobs.element.parse({ ...job, repo: 'zackproser/ctx' }).repo).toBe('zackproser/ctx');
    expect(TodoHandleSchema.shape.jobs.element.parse(job).repo).toBeUndefined();
    const node = { item_id: nodeId, node_key: 'k', status: 'ready' };
    const nodes = WorkCompletionSchema.shape.nodes;
    expect(nodes.parse([{ ...node, execution: null }])[0]?.execution).toBeNull();
    expect(nodes.parse([{ ...node, execution: { job_id: jobId, state: 'running', executor: 'orb', attempt: 1, updated_at: 'now' } }])[0]?.execution)
      .toMatchObject({ state: 'running' });
    expect(() => nodes.parse([{ ...node, execution: { job_id: jobId, state: 'done', executor: 'orb', attempt: 1, updated_at: 'now' } }])).toThrow(/state/);
  });

  it('accepts every server run state on handled jobs', () => {
    const job = {
      receipt_id: null, job_id: jobId, node_item_id: nodeId, executor: 'orb', replayed: false,
    };
    for (const state of ['queued', 'running', 'needs_input', 'failed', 'delivered', 'verified']) {
      expect(TodoHandleSchema.shape.jobs.element.parse({ ...job, state }).state).toBe(state);
    }
  });
});
