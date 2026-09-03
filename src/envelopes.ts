// Zod schemas for every `ctx.*.v1` envelope that crosses the wire between the
// CTX control plane and its clients. Zod is the authored source; the JSON
// Schema 2020-12 files under schemas/ are generated from these and checked in
// CI (`npm run schemas` must be a no-op). Cross-field refinements (superRefine)
// live only here — JSON Schema is the structural subset.
import { z } from 'zod';
import {
  CARDINALITY_MODES, CHECK_KINDS, COMPLETION_GRAPH_STATES, COMPLETION_NODE_KINDS, COMPLETION_POLICIES,
  COMPLETION_STATUSES, DELIVERABLE_KINDS, DRAFT_FALLBACK_REASONS, DRAFT_GENERATORS, DRAFT_RECEIPT_VERIFIER_IDS,
  DRAFT_STATUSES, DRAFT_STEP_VERIFIER_IDS, DRAFT_STEP_VERIFIER_LABELS, DRAFT_TEMPLATES, IR_SOURCES,
  REPOSITORY_ROLES, WORK_EXECUTORS, WORK_RUN_STATES,
} from './vocabulary.js';

const NonEmpty = z.string().trim().min(1);

// --- ctx.web-journey.v1 ---------------------------------------------------
export const LocatorSchema = z.discriminatedUnion('by', [
  z.object({ by: z.literal('role'), role: NonEmpty, name: NonEmpty.optional(), exact: z.boolean().default(false) }),
  z.object({ by: z.literal('label'), label: NonEmpty, exact: z.boolean().default(false) }),
  z.object({ by: z.literal('placeholder'), placeholder: NonEmpty, exact: z.boolean().default(false) }),
  z.object({ by: z.literal('text'), text: NonEmpty, exact: z.boolean().default(false) }),
  z.object({ by: z.literal('testId'), testId: NonEmpty }),
  z.object({ by: z.literal('css'), css: NonEmpty }),
]);

const Timeout = z.number().int().min(100).max(120_000).optional();
const Located = { locator: LocatorSchema, timeoutMs: Timeout };

export const JourneyStepSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('navigate'), url: z.string().url().optional(), timeoutMs: Timeout }),
  z.object({ action: z.literal('click'), ...Located }),
  z.object({ action: z.literal('fill'), ...Located, value: z.string() }),
  z.object({ action: z.literal('press'), ...Located, key: NonEmpty }),
  z.object({ action: z.literal('waitFor'), ...Located, state: z.enum(['visible', 'hidden', 'attached', 'detached']).default('visible') }),
  z.object({
    action: z.literal('assert'), ...Located,
    check: z.enum(['visible', 'hidden', 'textEquals', 'textIncludes', 'valueEquals', 'count']),
    expected: z.union([z.string(), z.number().int().nonnegative()]).optional(),
  }),
  z.object({ action: z.literal('screenshot'), name: NonEmpty.regex(/^[a-zA-Z0-9._-]+$/) }),
  z.object({ action: z.literal('http'), url: z.string().url(), status: z.number().int().min(100).max(599), timeoutMs: Timeout }),
]);

export const FixtureSchema = z.object({
  name: NonEmpty.regex(/^[a-zA-Z0-9._-]+$/),
  width: z.number().int().min(240).max(7680),
  height: z.number().int().min(320).max(7680),
  deviceScaleFactor: z.number().min(0.5).max(4).default(1),
});

export const WebJourneySchema = z.object({
  contract: z.literal('ctx.web-journey.v1'),
  name: NonEmpty.max(120),
  url: z.string().url(),
  fixtures: z.array(FixtureSchema).min(2).max(12),
  steps: z.array(JourneyStepSchema).min(1).max(200),
  timeoutMs: z.number().int().min(500).max(120_000).default(15_000),
  settleMs: z.number().int().min(50).max(10_000).default(300),
  allowConsoleErrorPatterns: z.array(NonEmpty).max(20).default([]),
  allowPageErrorPatterns: z.array(NonEmpty).max(20).default([]),
  allowNetworkFailurePatterns: z.array(NonEmpty).max(20).default([]),
}).superRefine((journey, ctx) => {
  if (!journey.fixtures.some((fixture) => fixture.width > 720)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fixtures'], message: 'a desktop fixture wider than 720px is required' });
  }
  if (!journey.fixtures.some((fixture) => fixture.width <= 480)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fixtures'], message: 'a phone fixture at or below 480px is required' });
  }
  if (!journey.steps.some((step) => step.action === 'assert')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps'], message: 'at least one observable assertion is required' });
  }
  for (const [index, step] of journey.steps.entries()) {
    if (step.action === 'assert' && !['visible', 'hidden'].includes(step.check) && step.expected === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps', index, 'expected'], message: `${step.check} requires expected` });
    }
  }
});

export type WebJourney = z.infer<typeof WebJourneySchema>;
export type JourneyStep = z.infer<typeof JourneyStepSchema>;
export type JourneyLocator = z.infer<typeof LocatorSchema>;

// --- Shared atoms ---------------------------------------------------------
const UUID = z.string().uuid();
const ShapeHash = z.string().regex(/^[a-f0-9]{64}$/);
const JsonObject = z.record(z.string(), z.unknown());
const Repo = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
const WorkRunState = z.enum(WORK_RUN_STATES);
const CompletionStatus = z.enum(COMPLETION_STATUSES);
const GraphState = z.enum(COMPLETION_GRAPH_STATES);

// --- ctx.work-graph-lint.v1 -----------------------------------------------
export const WorkGraphLintSchema = z.object({
  contract: z.literal('ctx.work-graph-lint.v1'),
  valid: z.boolean(),
  diagnostics: z.array(z.object({
    severity: z.enum(['error', 'warning']),
    code: NonEmpty,
    path: z.array(z.union([z.string(), z.number().int()])),
    message: NonEmpty,
  }).passthrough()),
  topology: z.object({
    entry_node_keys: z.array(z.string()),
    terminal_node_keys: z.array(z.string()),
    execution_order: z.array(z.string()),
  }).passthrough(),
}).passthrough();

// --- ctx.work-obligation-ir.v1 --------------------------------------------
// The only thing the compiler's model may propose; lowering derives the graph
// from it. Mirrors @ctx/graph-kernel's ObligationIR field for field (the kernel
// depends on this package, so it can adopt this definition without a cycle).
export const SpanSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  text: z.string(),
}).refine((span) => span.end >= span.start, 'span end precedes start');

const IrKey = z.string().regex(/^[a-z][a-z0-9_]{0,40}$/);
const Provenance = z.array(SpanSchema).min(1);

export const ObligationIRSchema = z.object({
  contract: z.literal('ctx.work-obligation-ir.v1'),
  title: z.string().min(1).max(90),
  repositories: z.array(z.object({
    id: Repo,
    role: z.enum(REPOSITORY_ROLES),
    provenance: Provenance,
  })).max(12),
  deliverables: z.array(z.object({
    key: IrKey,
    kind: z.enum(DELIVERABLE_KINDS),
    repository: Repo.nullable(),
    summary: z.string().min(1).max(300),
    provenance: Provenance,
  })).max(24),
  checks: z.array(z.object({
    kind: z.enum(CHECK_KINDS),
    target: z.string().nullable(),
    provenance: Provenance,
  })).max(24),
  ordering: z.array(z.object({ before: IrKey, after: z.array(IrKey).min(1).max(24) })).max(24),
  join_requested: z.boolean(),
  parallel_requested: z.boolean(),
  questions: z.array(z.object({ text: z.string().min(1).max(600), provenance: Provenance })).max(24),
  source: z.enum(IR_SOURCES),
});

// --- ctx.work-outcome-draft.v1 --------------------------------------------
const WorkOutcomeNodeSchema = z.object({
  key: NonEmpty.regex(/^[a-z][a-z0-9_-]{0,63}$/),
  title: NonEmpty.max(300),
  description: z.string().max(8192),
  kind: z.enum(COMPLETION_NODE_KINDS),
  policy: z.enum(COMPLETION_POLICIES),
  cardinality: z.object({
    mode: z.enum(CARDINALITY_MODES),
    target: z.number().int().nonnegative(),
  }).passthrough(),
  predicate: JsonObject,
  evaluator: NonEmpty.max(120),
  evaluator_version: NonEmpty.max(80),
}).passthrough();

// Compiler v2 output. The contract literal stays `.v1` (clients pin it);
// `schema_version: 2` marks the shape. Version 1 (no schema_version, no ir /
// template / provenance / status) is NOT accepted: the single production server
// has emitted v2 exclusively since 2026-09-03, so there is no N-1 to support.
export const WorkOutcomeDraftSchema = z.object({
  contract: z.literal('ctx.work-outcome-draft.v1'),
  schema_version: z.literal(2),
  registry_version: NonEmpty,
  prompt: NonEmpty,
  outcome: z.object({
    title: NonEmpty.max(300),
    description: z.string().max(8192),
    entities: z.array(NonEmpty),
    // Empty when nothing lowered; launch_ready is false in that case.
    nodes: z.array(WorkOutcomeNodeSchema),
    edges: z.array(z.object({
      from: NonEmpty,
      to: NonEmpty,
      kind: z.literal('depends_on'),
    }).passthrough()),
    initial_memberships: z.array(z.object({
      input_node_key: NonEmpty,
      resource_item_ids: z.array(UUID),
    }).passthrough()),
  }).passthrough(),
  steps: z.array(z.object({
    key: NonEmpty,
    node_key: NonEmpty,
    title: NonEmpty,
    detail: NonEmpty,
    verifier_id: z.enum(DRAFT_STEP_VERIFIER_IDS),
    verifier_version: NonEmpty,
    verifier_label: z.enum(DRAFT_STEP_VERIFIER_LABELS),
    // Repository the lane's work happens in; null for CTX-owned joins/proofs.
    repository: Repo.nullable(),
  }).passthrough()),
  extra_receipts: z.array(z.object({
    id: z.enum(DRAFT_RECEIPT_VERIFIER_IDS),
    version: NonEmpty,
    label: NonEmpty,
    selected: z.boolean(),
  }).passthrough()),
  // Deterministic explicit-obligation inventory the compiler extracted before lowering.
  obligations: z.object({
    repositories: z.array(Repo),
    join_requested: z.boolean(),
    parallel_requested: z.boolean(),
  }).passthrough(),
  graph_lint: WorkGraphLintSchema,
  launch_ready: z.boolean(),
  // `merged` = deterministic floor + accepted model IR; `deterministic` = floor
  // only (see fallback_reason); `model` is reserved for a model-only path.
  generated_by: z.enum(DRAFT_GENERATORS),
  generated_at: z.string().datetime({ offset: true }),
  ir: ObligationIRSchema,
  template: z.enum(DRAFT_TEMPLATES),
  // node key → the IR items and prompt spans that justify it.
  provenance: z.record(z.string(), z.object({
    obligation_keys: z.array(z.string()),
    spans: z.array(SpanSchema),
  }).passthrough()),
  fallback_reason: z.enum(DRAFT_FALLBACK_REASONS).nullable(),
  // Why the model path fell back, bounded and prompt-free (zod issue paths or
  // the upstream error class). Optional: the server adds it in a later release.
  fallback_detail: z.string().max(400).nullable().optional(),
  model_latency_ms: z.number().int().nonnegative().nullable(),
  // sha256 of prompt hash + context hash; stable across replays of one prompt.
  draft_id: ShapeHash,
  // `improving`: the floor was returned on a model timeout and the merged draft
  // is being finished in the background; the next preview replays it as final.
  status: z.enum(DRAFT_STATUSES),
}).passthrough();

// --- ctx.todo-handle.v1 ---------------------------------------------------
const TodoHandleJobSchema = z.object({
  receipt_id: UUID.nullable(),
  job_id: UUID,
  node_item_id: UUID.nullable(),
  node_title: NonEmpty.optional(),
  executor: z.enum(WORK_EXECUTORS),
  state: WorkRunState,
  replayed: z.boolean(),
  // One handle may dispatch several lanes, each in its own repository.
  repo: Repo.nullable().optional(),
}).passthrough();

export const TodoHandleSchema = z.object({
  contract: z.literal('ctx.todo-handle.v1'),
  status: z.enum(['dispatched', 'already_running', 'already_complete', 'needs_owner']),
  task_item_id: UUID,
  graph_created: z.boolean(),
  graph_repaired: z.boolean(),
  graph: z.object({
    revision: z.number().int().positive(),
    shape_hash: ShapeHash,
    state: GraphState,
    satisfied_count: z.number().int().nonnegative(),
    required_count: z.number().int().nonnegative(),
  }).passthrough(),
  node_item_id: UUID.nullable(),
  node_title: NonEmpty.optional(),
  job_id: UUID.nullable(),
  receipt_id: UUID.nullable(),
  jobs: z.array(TodoHandleJobSchema),
  replayed: z.boolean(),
  reason: NonEmpty,
  work_url: NonEmpty,
  fleet_url: NonEmpty.nullable(),
}).passthrough();

// --- Read-model envelopes -------------------------------------------------
// Only the contract literal plus the custody fields clients rely on. Everything
// else passes through unchanged so an N+1 server never breaks an N client.
export const WorkCompletionSchema = z.object({
  contract: z.literal('ctx.work-completion.v1'),
  task: z.object({
    item_id: UUID, revision: z.number().int().positive(), shape_hash: ShapeHash,
    state: GraphState,
  }).passthrough(),
  nodes: z.array(z.object({
    item_id: UUID, node_key: NonEmpty, status: CompletionStatus,
    // Execution is a separate dimension from completion: the latest job holding
    // this node's custody, or null. Status never derives from it.
    execution: z.object({
      job_id: UUID, state: WorkRunState, executor: NonEmpty,
      attempt: z.number().int().nonnegative(), updated_at: NonEmpty,
    }).passthrough().nullable().optional(),
  }).passthrough()),
}).passthrough();

export const WorkRunDetailSchema = z.object({
  contract: z.literal('ctx.work-run-detail.v1'),
  job: z.object({ id: UUID, state: WorkRunState, node_item_id: UUID.nullable() }).passthrough(),
  events: z.array(JsonObject),
}).passthrough();

export const WorkNodeInstructionsSchema = z.object({
  contract: z.literal('ctx.work-node-instructions.v1'),
  custody: z.object({
    task_item_id: UUID, graph_revision: z.number().int().positive(), graph_shape_hash: ShapeHash,
    node_item_id: UUID.nullable(), node_key: z.string().nullable(), node_instructions: z.string().nullable(),
  }).passthrough(),
  execution: z.object({ executable: z.boolean(), code: NonEmpty, reason: NonEmpty }).passthrough(),
}).passthrough();

export const VerifierBindingSchema = z.object({ id: NonEmpty, version: NonEmpty }).passthrough();

export const VerifierPlanSchema = z.object({
  contract: z.literal('ctx.verifier-plan.v1'),
  registry_version: NonEmpty,
  task_item_id: UUID,
  node_item_id: UUID.nullable(),
  graph_revision: z.number().int().positive().nullable(),
  default_bindings: z.array(VerifierBindingSchema),
  launch_ready: z.boolean(),
}).passthrough();

export const WorkRunLaunchSchema = z.object({
  contract: z.literal('ctx.work-run.v1'),
  job_id: UUID,
  task_item_id: UUID,
  node_item_id: UUID.nullable(),
  state: WorkRunState,
  replayed: z.boolean(),
}).passthrough();

// --- Verifier evidence envelopes ------------------------------------------
// CTX stores what the truth functions (in @ctx/verifier-core) compute from
// these, never the caller's `passed`.
export const HttpsUrl = z.string().url().max(2048).refine((value) => new URL(value).protocol === 'https:', {
  message: 'base_url must use HTTPS',
});

export const ErrorList = z.array(z.string().trim().min(1).max(2000)).max(50);

export const HealthSchema = z.object({
  contract: z.literal('ctx.health.v1'),
  ok: z.boolean(),
  release_tag: z.string().trim().min(1).max(200).nullable(),
});

export const AppHealthSchema = z.object({
  contract: z.literal('ctx.app-health.v1'),
  ok: z.boolean(),
  failed_checks: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
});

export const DeploymentEvidence = z.object({
  contract: z.literal('ctx.deployment-release-evidence.v1'),
  base_url: HttpsUrl,
  expected_tag: z.string().trim().min(1).max(200),
  public_health: HealthSchema,
  app_health: AppHealthSchema,
  failure: z.string().trim().min(1).max(2000).nullable().default(null),
});

export const BrowserFixture = z.object({
  name: z.string().trim().min(1).max(120),
  width: z.number().int().min(240).max(7680),
  height: z.number().int().min(320).max(7680),
  assertions_passed: z.number().int().nonnegative().max(10_000),
  overflow: z.boolean(),
});

export const BrowserEvidence = z.object({
  contract: z.literal('ctx.browser-smoke-evidence.v1'),
  base_url: HttpsUrl,
  fixtures: z.array(BrowserFixture).min(1).max(40),
  console_errors: ErrorList,
  page_errors: ErrorList,
  failure: z.string().trim().min(1).max(2000).nullable().default(null),
});

export type WorkGraphLint = z.infer<typeof WorkGraphLintSchema>;
export type WorkOutcomeDraft = z.infer<typeof WorkOutcomeDraftSchema>;
export type ObligationIR = z.infer<typeof ObligationIRSchema>;
export type Span = z.infer<typeof SpanSchema>;
export type TodoHandle = z.infer<typeof TodoHandleSchema>;
export type WorkCompletion = z.infer<typeof WorkCompletionSchema>;
export type WorkRunDetail = z.infer<typeof WorkRunDetailSchema>;
export type WorkNodeInstructions = z.infer<typeof WorkNodeInstructionsSchema>;
export type VerifierPlan = z.infer<typeof VerifierPlanSchema>;
export type WorkRunLaunch = z.infer<typeof WorkRunLaunchSchema>;
export type DeploymentEvidence = z.infer<typeof DeploymentEvidence>;
export type BrowserEvidence = z.infer<typeof BrowserEvidence>;
