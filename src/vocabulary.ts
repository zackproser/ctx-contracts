// Server-owned vocabulary. CTX (the control plane) is the only writer of these
// lists; ctx-cli and every other client derive option lists and types from
// here instead of copying them. Dependency-free on purpose.

// --- Work graph -----------------------------------------------------------
export const WORK_NODE_KINDS = ['project', 'task', 'decision', 'reference', 'event'] as const;
export type WorkNodeKind = typeof WORK_NODE_KINDS[number];

// Humans may capture the three ordinary work shapes. `event` joins the read
// graph only for typed proof resources and is created through the proof
// service, never as an untyped manual event.
export const CREATABLE_WORK_NODE_KINDS = ['project', 'task', 'reference'] as const;
export type CreatableWorkNodeKind = typeof CREATABLE_WORK_NODE_KINDS[number];

export const WORK_EDGE_KINDS = [
  'contains', 'blocks', 'depends_on', 'relates_to', 'evidence_for', 'delivers',
] as const;
export type WorkEdgeKind = typeof WORK_EDGE_KINDS[number];

export const WORK_RESOURCE_TYPES = [
  'github_issue', 'github_pr', 'repo_file', 'local_file', 'url', 'image',
  'recording', 'commit', 'agent_run', 'build', 'deployment', 'document',
  'email', 'decision', 'connector_action', 'verification_receipt', 'receipt',
] as const;
export type WorkResourceType = typeof WORK_RESOURCE_TYPES[number];
/** Client-facing name for the same list (ctx-cli `artifact --type`). */
export const ARTIFACT_TYPES = WORK_RESOURCE_TYPES;

export const WORK_RUN_STATES = [
  'queued', 'running', 'needs_input', 'failed', 'delivered', 'verified',
] as const;
export type WorkRunState = typeof WORK_RUN_STATES[number];

export const WORK_RESOURCE_HEALTH = ['current', 'stale', 'unknown', 'error'] as const;
export type WorkResourceHealth = typeof WORK_RESOURCE_HEALTH[number];

export interface WorkResource {
  type: WorkResourceType;
  provider: string;
  locator: string;
  reference_mode: 'immutable' | 'live';
  version_ref: string | null;
  run_state: WorkRunState | null;
  health: WorkResourceHealth;
  observed_at: string;
  checked_at: string | null;
  metadata: Record<string, unknown>;
  canonical_key?: string | null;
  storage_locator?: string | null;
  media_type?: string | null;
  content_sha256?: string | null;
  size_bytes?: number | null;
  revision: number;
}

// --- Completion graph -----------------------------------------------------
export const COMPLETION_NODE_KINDS = [
  'input_set', 'action', 'artifact_requirement', 'verification_gate',
] as const;
export type CompletionNodeKind = typeof COMPLETION_NODE_KINDS[number];

export const COMPLETION_STATUSES = [
  'blocked', 'ready', 'running', 'satisfied', 'failed', 'waived',
] as const;
export type CompletionStatus = typeof COMPLETION_STATUSES[number];

export const COMPLETION_POLICIES = ['required', 'optional', 'waived'] as const;
export type CompletionPolicy = typeof COMPLETION_POLICIES[number];

export const CARDINALITY_MODES = ['exact', 'at_least', 'dynamic'] as const;
export type CardinalityMode = typeof CARDINALITY_MODES[number];

export const COMPLETION_GRAPH_STATES = ['active', 'blocked', 'satisfied', 'failed'] as const;
export type CompletionGraphState = typeof COMPLETION_GRAPH_STATES[number];

// --- Run dispatch ---------------------------------------------------------
export const WORK_EXECUTORS = ['orb', 'codex_api', 'claude_agent_sdk', 'mac_codex'] as const;
export type WorkExecutor = typeof WORK_EXECUTORS[number];

export const DELIVERY_MODES = ['report_only', 'pull_request'] as const;
export type DeliveryMode = typeof DELIVERY_MODES[number];

export const EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;
export type Effort = typeof EFFORTS[number];

// --- Compiler (draft_work_outcome) ---------------------------------------
// Mirrors src/service/work-outcome-drafts.ts in ctx and obligation-ir.ts /
// lowering.ts in @ctx/graph-kernel. A new value there is a change here first.
export const DRAFT_GENERATORS = ['deterministic', 'model', 'merged'] as const;
export type DraftGenerator = typeof DRAFT_GENERATORS[number];

export const DRAFT_STATUSES = ['final', 'improving'] as const;
export type DraftStatus = typeof DRAFT_STATUSES[number];

export const DRAFT_FALLBACK_REASONS = ['model_timeout', 'model_invalid', 'model_unconfigured', 'coverage_failed'] as const;
export type DraftFallbackReason = typeof DRAFT_FALLBACK_REASONS[number];

export const DRAFT_TEMPLATES = [
  'single_repo_delivery', 'multi_repo_join', 'report_only', 'research_plan_handoff', 'merge_gate', 'owner_checklist',
] as const;
export type DraftTemplate = typeof DRAFT_TEMPLATES[number];

export const DRAFT_STEP_VERIFIER_IDS = [
  'ctx.github-merge-verifier', 'ctx.work-run-artifact', 'ctx.manual-attestation', 'ctx.declarative', 'ctx.input-membership',
] as const;
export type DraftStepVerifierId = typeof DRAFT_STEP_VERIFIER_IDS[number];

export const DRAFT_STEP_VERIFIER_LABELS = [
  'GITHUB VERIFIES', 'HARNESS RECEIPT', 'HARNESS + VERIFIED', 'YOU ATTEST', 'CTX JOINS', 'EXACT INPUTS',
] as const;
export type DraftStepVerifierLabel = typeof DRAFT_STEP_VERIFIER_LABELS[number];

export const DRAFT_RECEIPT_VERIFIER_IDS = ['ctx.deployment-release-verifier', 'ctx.browser-smoke-verifier', 'ctx.github-ci-verifier'] as const;
export type DraftReceiptVerifierId = typeof DRAFT_RECEIPT_VERIFIER_IDS[number];

// --- Obligation IR (ctx.work-obligation-ir.v1) ---------------------------
export const REPOSITORY_ROLES = ['deployable', 'library', 'unknown'] as const;
export type RepositoryRole = typeof REPOSITORY_ROLES[number];

export const DELIVERABLE_KINDS = ['pull_request', 'commit', 'document', 'artifact', 'deployment', 'message'] as const;
export type DeliverableKind = typeof DELIVERABLE_KINDS[number];

export const CHECK_KINDS = ['deployment_release', 'browser_smoke', 'github_merge', 'github_checks', 'owner_attestation', 'connector'] as const;
export type CheckKind = typeof CHECK_KINDS[number];

export const IR_SOURCES = DRAFT_GENERATORS;
export type IrSource = DraftGenerator;
