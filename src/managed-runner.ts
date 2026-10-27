// Shared private-runner wire shapes. Authority is derived from the verified
// run credential and server lease, never from a field in these bodies.
import { z } from 'zod';
import { ManagedBrowserAcceptanceSchema } from './envelopes.js';

const Sha = z.string().regex(/^[a-f0-9]{64}$/);
const Id = z.string().uuid();
const Epoch = z.number().int().positive();
const Generation = z.number().int().nonnegative();
const RelativePath = z.string().min(1).max(240).regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!__ctx)[A-Za-z0-9_.@+/-]+$/);

export const ManagedOrbAssignmentSchema = z.object({
  contract: z.literal('ctx.managed-orb-assignment.v1'),
  managed_job_id: Id,
  agent_job_id: Id,
  attempt: Epoch,
  policy_id: z.string().min(1).max(120),
  runner_commit: z.string().regex(/^[a-f0-9]{40}$/),
}).strict();

export const ManagedRunnerLeaseInputSchema = z.object({ instance_id: Id }).strict();
export const ManagedRunnerCheckpointPointerSchema = z.object({
  git_sha256: Sha, session_sha256: Sha, checkpoint_sha256: Sha.optional(),
}).strict();
export const ManagedRunnerLeaseSchema = z.object({
  runner_epoch: Epoch, managed_job_id: Id,
  policy_id: z.string().min(1), deadline_at: z.string().datetime(),
  budget_usd: z.number().positive(), generation: Generation,
  prompt: z.string(), acceptance: ManagedBrowserAcceptanceSchema.nullable(),
  latest_steering: z.string().nullable(), checkpoint: ManagedRunnerCheckpointPointerSchema.nullable(),
  runner_commit: z.string().regex(/^[a-f0-9]{40}$/).optional(),
}).strict();
export const ManagedRunnerInboxItemSchema = z.object({
  id: z.string().min(1).max(160), kind: z.enum(['steer', 'repair', 'cancel']),
  operation_id: z.string().min(1).max(160), message: z.string().max(32000),
  evidence: z.record(z.unknown()).optional(),
}).strict();
export const ManagedRunnerHeartbeatInputSchema = z.object({
  phase: z.string().min(1).max(80), tree_sha: Sha.nullable(),
  last_command: z.object({ argv0: z.string().min(1).max(120), exit: z.number().int().nullable(), at: z.string().datetime() }).strict().nullable(),
  settled_ops: z.number().int().nonnegative(),
}).strict();
export const ManagedRunnerHeartbeatSchema = z.object({
  state: z.string().min(1), generation: Generation, stop: z.boolean(),
  inbox: z.array(ManagedRunnerInboxItemSchema).max(100),
}).strict();
export const ManagedRunnerCheckpointManifestSchema = z.object({
  git_sha256: Sha, session_sha256: Sha, source_tree_sha: Sha,
  inbox_ids: z.array(z.string().min(1).max(160)).max(100),
}).strict();
export const ManagedRunnerInboxAckSchema = z.object({
  ids: z.array(z.string().min(1).max(160)).max(100), checkpoint_sha256: Sha,
}).strict();
export const ManagedRunnerModuleSchema = z.object({
  name: RelativePath, type: z.enum(['esm', 'text', 'wasm', 'data']),
  content_base64: z.string().max(16 * 1024 * 1024),
}).strict();
export const ManagedRunnerCandidateSchema = z.object({
  source_tree_sha: Sha, main: RelativePath,
  modules: z.array(ManagedRunnerModuleSchema).min(1).max(128),
  logs: z.object({ build: z.string().max(32000), test: z.string().max(32000) }).strict(),
  diff_stat: z.string().max(8000),
}).strict();
export const ManagedRunnerInputSchema = z.object({ question: z.string().min(1).max(8000) }).strict();

export type ManagedOrbAssignment = z.infer<typeof ManagedOrbAssignmentSchema>;
export type ManagedRunnerLease = z.infer<typeof ManagedRunnerLeaseSchema>;
export type ManagedRunnerInboxItem = z.infer<typeof ManagedRunnerInboxItemSchema>;
export type ManagedRunnerHeartbeat = z.infer<typeof ManagedRunnerHeartbeatSchema>;
export type ManagedRunnerCandidate = z.infer<typeof ManagedRunnerCandidateSchema>;
