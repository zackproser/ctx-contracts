import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import {
  COMPLETION_GRAPH_STATES, COMPLETION_NODE_KINDS, COMPLETION_POLICIES, COMPLETION_STATUSES,
  ENVELOPES, GetWorkStatusInputSchema, parseEnvelope, WORK_EXECUTORS, WORK_RUN_STATES,
  WORK_STATUS_ACTIONS, WorkStatusSchema, type GetWorkStatusInput, type WorkStatus,
} from '../src/index.js';

const fixture: WorkStatus = JSON.parse(readFileSync(
  new URL('../fixtures/ctx.work-status.v1.json', import.meta.url), 'utf8',
));
const jsonSchema = JSON.parse(readFileSync(
  new URL('../schemas/ctx.work-status.v1.json', import.meta.url), 'utf8',
));
const validate = addFormats.default(new Ajv2020({ strict: true, allErrors: true })).compile(jsonSchema);

function accepts(value: unknown) {
  expect(WorkStatusSchema.safeParse(value).success).toBe(true);
  expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
}

function rejects(value: unknown) {
  expect(WorkStatusSchema.safeParse(value).success).toBe(false);
  expect(validate(value), JSON.stringify(validate.errors)).toBe(false);
}

function replace(path: string, value: unknown): WorkStatus {
  const changed = structuredClone(fixture);
  const segments = path.split('.');
  let parent = changed as unknown as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) parent = parent[segment] as Record<string, unknown>;
  parent[segments.at(-1)!] = value;
  return changed;
}

describe('compact work status', () => {
  it('exports and registers the bounded snapshot without conflating delivery and completion', () => {
    const status: WorkStatus = WorkStatusSchema.parse(fixture);
    expect(ENVELOPES['ctx.work-status.v1']).toBe(WorkStatusSchema);
    expect(parseEnvelope(fixture)).toEqual(status);
    expect(status.nodes[1]?.execution?.state).toBe('delivered');
    expect(status.nodes[1]?.status).toBe('running');
    expect(status.nodes[2]?.execution).toBeNull();
    accepts(status);
  });

  it('accepts only the task UUID as read input', () => {
    const input: GetWorkStatusInput = { task_item_id: fixture.task.item_id };
    expect(GetWorkStatusInputSchema.parse(input)).toEqual(input);
    for (const invalid of [{}, { task_item_id: 'not-a-uuid' }, { ...input, job_id: input.task_item_id },
      { ...input, claim: true }, { ...input, status: 'verified' }]) {
      expect(GetWorkStatusInputSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it.each(['', 'task', 'progress', 'nodes.1', 'nodes.1.execution', 'nodes.1.next_tool',
    'nodes.1.next_tool.arguments'])('rejects unknown fields at %s in both validators', (path) => {
    rejects(replace(path ? `${path}.unexpected` : 'unexpected', true));
  });

  it.each([
    ['get_work_instructions', 'job_id'], ['inspect_work_run', 'job_id'],
    ['inspect_work_state', 'task_item_id'], ['evaluate_work_gate', 'task_item_id'],
  ])('pairs %s with only its %s argument', (name, argument) => {
    const id = argument === 'job_id' ? fixture.nodes[1]!.execution!.job_id : fixture.task.item_id;
    accepts(replace('nodes.1.next_tool', { name, arguments: { [argument!]: id } }));
    const wrongArgument = argument === 'job_id' ? 'task_item_id' : 'job_id';
    rejects(replace('nodes.1.next_tool', { name, arguments: { [wrongArgument]: id } }));
    rejects(replace('nodes.1.next_tool', { name, arguments: { [argument!]: id, [wrongArgument]: id } }));
  });

  it('rejects invented or authority-bearing next-tool calls', () => {
    for (const name of ['unknown', 'claim_work_run', 'checkpoint_work_run', 'record_verification']) {
      rejects(replace('nodes.1.next_tool', { name, arguments: { job_id: fixture.nodes[1]!.execution!.job_id } }));
    }
  });

  it('allows stale evaluations, absent execution, and null tool suggestions as observations', () => {
    const status = replace('task.evaluation_current', false);
    status.nodes[1]!.execution = null;
    status.nodes[1]!.action = 'refresh';
    status.nodes[1]!.next_tool = null;
    accepts(status);
  });

  it('accepts canonical vocabularies without inventing status/execution coupling', () => {
    const vocabularies = [
      ['task.state', COMPLETION_GRAPH_STATES], ['nodes.1.kind', COMPLETION_NODE_KINDS],
      ['nodes.1.policy', COMPLETION_POLICIES], ['nodes.1.status', COMPLETION_STATUSES],
      ['nodes.1.execution.state', WORK_RUN_STATES], ['nodes.1.execution.executor', WORK_EXECUTORS],
      ['nodes.1.action', WORK_STATUS_ACTIONS],
    ] as const;
    for (const [path, values] of vocabularies) {
      for (const value of values) accepts(replace(path, value));
      rejects(replace(path, 'invented'));
    }
  });

  it('accepts exact size bounds and rejects the first oversized value', () => {
    for (const [path, limit] of [['task.title', 160], ['nodes.1.title', 160], ['nodes.1.node_key', 120],
      ['nodes.1.reason', 240]] as const) {
      accepts(replace(path, 'x'.repeat(limit)));
      rejects(replace(path, 'x'.repeat(limit + 1)));
    }
    accepts(replace('nodes', Array.from({ length: 40 }, () => structuredClone(fixture.nodes[0]!))));
    rejects(replace('nodes', Array.from({ length: 41 }, () => structuredClone(fixture.nodes[0]!))));
    accepts(replace('nodes.1.blocked_by', Array.from({ length: 40 }, () => fixture.nodes[0]!.item_id)));
    rejects(replace('nodes.1.blocked_by', Array.from({ length: 41 }, () => fixture.nodes[0]!.item_id)));
  });

  it('requires integer counts and attempts, with a positive graph revision', () => {
    for (const path of ['progress.total', 'progress.required', 'progress.required_clear',
      'progress.required_remaining', 'nodes.1.execution.attempt']) {
      accepts(replace(path, 0));
      rejects(replace(path, -1));
      rejects(replace(path, 0.5));
    }
    for (const invalid of [0, -1, 1.5]) rejects(replace('task.revision', invalid));
  });

  it('requires valid identifiers and exact shape hashes', () => {
    for (const path of ['task.item_id', 'nodes.1.item_id', 'nodes.1.execution.job_id',
      'nodes.1.next_tool.arguments.job_id', 'nodes.2.blocked_by.0']) rejects(replace(path, 'not-a-uuid'));
    for (const invalid of ['a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64)]) rejects(replace('task.shape_hash', invalid));
  });

  it('validates nullable execution times and timezone-bearing snapshot times', () => {
    for (const path of ['generated_at', 'nodes.1.execution.lease_expires_at', 'nodes.1.execution.deadline_at']) {
      accepts(replace(path, '2026-09-04T15:00:00.123456-04:00'));
      rejects(replace(path, '2026-09-04T15:00:00'));
      rejects(replace(path, 'yesterday'));
    }
    accepts(replace('nodes.1.execution.lease_expires_at', null));
    accepts(replace('nodes.1.execution.deadline_at', null));
    rejects(replace('generated_at', null));
  });

  it('requires explicit nullable fields rather than silently omitting them', () => {
    for (const path of ['task.evaluation_current', 'nodes.1.execution', 'nodes.1.next_tool',
      'nodes.1.execution.lease_expires_at', 'nodes.1.execution.deadline_at']) {
      // JSON serialization models a wire payload with the field missing.
      rejects(JSON.parse(JSON.stringify(replace(path, undefined))));
    }
  });
});
