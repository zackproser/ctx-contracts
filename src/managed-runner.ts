// Shared private-runner wire shapes. Authority is derived from the verified
// run credential and server lease, never from a field in these bodies.
import { z } from 'zod';
import { ManagedBrowserAcceptanceSchema } from './envelopes.js';

const Sha = z.string().regex(/^[a-f0-9]{64}$/);
const Id = z.string().uuid();
const Epoch = z.number().int().positive();
const Generation = z.number().int().nonnegative();
const RelativePath = z.string().min(1).max(240).regex(/^(?!\/)(?!.*\/\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!__ctx)[A-Za-z0-9_.@+/-]+$/);

export const ManagedOrbAssignmentSchema = z.object({
  contract: z.literal('ctx.managed-orb-assignment.v1'),
  managed_job_id: Id,
  agent_job_id: Id,
  attempt: Epoch,
  policy_id: z.string().min(1).max(120),
  runner_commit: z.string().regex(/^[a-f0-9]{40}$/),
}).strict();

// A management bridge may recover after losing its local dispatch entry. The
// signed wake must retain the admitted runtime so recovery never starts a
// different coding harness or an unmetered provider turn.
export const OrbSteeringEnvelopeSchema = z.object({
  contract: z.literal('ctx.orb-steer.v1'), idempotency_key: z.string().min(1),
  issued_at: z.string().datetime(),
  job: z.object({
    id: Id, node_item_id: Id.nullable(), attempt: Epoch,
    provider_thread_id: z.string().regex(/^T-[a-f0-9-]+$/),
    runtime: ManagedOrbAssignmentSchema.optional(),
  }).strict(),
  steering: z.object({ event_id: Id, event_key: z.string().min(1),
    sequence_no: Generation, message: z.string().min(1), }).strict(),
  callback: z.object({ events_url: z.string().url(), heartbeat_url: z.string().url(),
    verifier_receipts_url: z.string().url(), token: z.string().min(1), }).strict(),
}).strict();

export const ManagedRunnerCandidateStatusSchema = z.object({
  operation_id: z.string().min(1).max(240), candidate_sha256: Sha,
  source_tree_sha: Sha, status: z.enum(['pending', 'failed', 'passed']),
}).strict();
export const ManagedRunnerCandidateResultSchema = z.union([
  z.object({ operation_id: z.string().min(1).max(240), attempt: Epoch,
    candidate_sha256: Sha }).strict(),
  z.object({ rejected: z.literal(true), reason: z.string().min(1).max(8000),
    code: z.enum(['candidate_failed', 'compiled_unchanged', 'attempts_exhausted', 'input_pending']),
  }).strict(),
]);

export const ManagedRunnerLeaseInputSchema = z.object({ instance_id: Id }).strict();
export const ManagedRunnerCheckpointPointerSchema = z.object({
  git_sha256: Sha, session_sha256: Sha, checkpoint_sha256: Sha.optional(),
}).strict();
// Five retained design references plus two review screenshots fit a 512KB request.
export const MANAGED_DESIGN_IMAGE_MAX_BASE64 = 60_000;
export const ManagedRunnerDesignReferenceSchema = z.object({
  artifact_id: Id, source_sha256: Sha, media_type: z.literal('image/jpeg'),
  content_base64: z.string().min(4).max(MANAGED_DESIGN_IMAGE_MAX_BASE64)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
}).strict();
export const ManagedRunnerLeaseSchema = z.object({
  runner_epoch: Epoch, managed_job_id: Id,
  policy_id: z.string().min(1), deadline_at: z.string().datetime(),
  budget_usd: z.number().positive(), generation: Generation,
  prompt: z.string(), acceptance: ManagedBrowserAcceptanceSchema.nullable(),
  latest_steering: z.string().nullable(), checkpoint: ManagedRunnerCheckpointPointerSchema.nullable(),
  runner_commit: z.string().regex(/^[a-f0-9]{40}$/).optional(),
  design_references: z.array(ManagedRunnerDesignReferenceSchema).max(5).optional(),
  candidate: ManagedRunnerCandidateStatusSchema.nullable().optional(),
}).passthrough();
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
  candidate: ManagedRunnerCandidateStatusSchema.nullable().optional(),
}).passthrough();
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
export type OrbSteeringEnvelope = z.infer<typeof OrbSteeringEnvelopeSchema>;
export type ManagedRunnerCandidateStatus = z.infer<typeof ManagedRunnerCandidateStatusSchema>;
export type ManagedRunnerCandidateResult = z.infer<typeof ManagedRunnerCandidateResultSchema>;

export type ManagedRunnerDesignReference = z.infer<typeof ManagedRunnerDesignReferenceSchema>;
