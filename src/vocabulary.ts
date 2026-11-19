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

// A task family describes the owner's outcome, independently of executor jobs.
// Classification is never an authorization or a promise of provider support.
export const EXPERT_CALL_TASK = {
  id: 'expert_consultation', label: 'Expert calls',
  description: 'Prepare an expert consultation, complete required packets, and arrange the call.',
} as const;
// A network in this list can be filed as a case. Being listed never grants
// authority to send a reply, accept a project or submit a form. New networks are
// appended, so the first four keep their order.
export const EXPERT_NETWORK_PROVIDERS = [
  'alphasights', 'glg', 'tegus', 'guidepoint', 'officehours', 'coleman', 'thirdbridge',
] as const;
export type ExpertNetworkProvider = typeof EXPERT_NETWORK_PROVIDERS[number];
export const EXPERT_NETWORK_LABELS: Record<ExpertNetworkProvider, string> = {
  alphasights: 'AlphaSights', glg: 'GLG', tegus: 'Tegus', guidepoint: 'Guidepoint',
  officehours: 'Office Hours', coleman: 'Coleman', thirdbridge: 'Third Bridge',
};
// Registered authenticated sender domains. Link domains are separately constrained by
// each adapter; recognizing a provider never grants authority to submit a form.
export const EXPERT_NETWORK_DOMAINS: Record<ExpertNetworkProvider, readonly string[]> = {
  alphasights: ['alphasights.com'], glg: ['glgroup.com', 'glg.it'],
  tegus: ['tegus.com'], guidepoint: ['guidepointglobal.com', 'guidepoint.com'],
  officehours: ['officehours.com'], coleman: ['colemanrg.com'], thirdbridge: ['thirdbridge.com'],
};
// Networks that send from subdomains of a registered domain: Office Hours mail
// comes from onboarding.officehours.com, and Coleman's from
// outreach.colemanrg.com (its mail system rewrites the From onto that
// subdomain and keeps the person's own address in Reply-To). For every other
// network the sender domain must equal a registered domain exactly.
export const EXPERT_NETWORK_SUBDOMAIN_SENDERS: readonly ExpertNetworkProvider[] = ['officehours', 'coleman'];

/** One DNS label: letters, digits and inner hyphens, 1 to 63 characters. */
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * The network a sender domain belongs to, or null. Exact match on a registered
 * domain for every network; a subdomain counts only for a network listed in
 * `EXPERT_NETWORK_SUBDOMAIN_SENDERS`. A domain that merely ends the same way
 * ("notofficehours.com", "colemanrg.com.evil.example", "evilcolemanrg.com") is
 * no network, and neither is anything that is not a domain name: an empty or
 * damaged label (".colemanrg.com", "a..colemanrg.com"), a trailing dot, an
 * address. The caller still has to authenticate the mail: this only names the
 * sender.
 */
export function expertNetworkForSenderDomain(domain: string): ExpertNetworkProvider | null {
  const sender = domain.trim().toLowerCase();
  if (!sender || !sender.split('.').every((label) => DOMAIN_LABEL.test(label))) return null;
  for (const provider of EXPERT_NETWORK_PROVIDERS) {
    const subdomains = EXPERT_NETWORK_SUBDOMAIN_SENDERS.includes(provider);
    if (EXPERT_NETWORK_DOMAINS[provider].some((registered) =>
      sender === registered || (subdomains && sender.endsWith(`.${registered}`)))) return provider;
  }
  return null;
}

// Networks whose policy bans AI-written answers. The owner accepts and answers
// these himself: nothing drafts an answer for them, and no assisted form fill is
// ever written for them (`ExternalFormFillSchema` refuses both).
export const EXPERT_NETWORKS_BANNING_AI_ANSWERS: readonly ExpertNetworkProvider[] = ['glg', 'guidepoint'];

// Forms a browser worker may fill and then stop at, never submit.
// - google_form: a Google Form (an AlphaSights screener behind a forms.gle link).
// - officehours_apply: the Office Hours apply page for one opportunity.
// - tegus_form: a form on a Tegus (AlphaSense) host.
export const EXTERNAL_FORM_FILL_KINDS = ['google_form', 'officehours_apply', 'tegus_form'] as const;
export type ExternalFormFillKind = typeof EXTERNAL_FORM_FILL_KINDS[number];
// What a fill-and-stop readback captures before the worker stops. A recipe
// asks for all of it, in this order; there is no shorter list to ask for.
export const EXTERNAL_FORM_FILL_CAPTURES = [
  'final_url', 'page_title', 'field_values', 'unmapped_fields', 'submit_controls', 'validation_errors', 'screenshot',
] as const;
export type ExternalFormFillCapture = typeof EXTERNAL_FORM_FILL_CAPTURES[number];

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

// Advisory next actions in the compact work-status snapshot. These do not
// confer execution custody or verification authority.
export const WORK_STATUS_ACTIONS = [
  'inspect_assignment', 'wait_for_dependencies', 'wait_for_agent',
  'wait_for_verification', 'request_owner', 'refresh', 'complete',
] as const;
export type WorkStatusAction = typeof WORK_STATUS_ACTIONS[number];

// --- Run dispatch ---------------------------------------------------------
export const WORK_EXECUTORS = ['orb', 'codex_api', 'claude_agent_sdk', 'mac_codex', 'mcp'] as const;
export type WorkExecutor = typeof WORK_EXECUTORS[number];

// report_only never publishes or pushes; pull_request authorizes repository
// delivery. publish_after_verify keeps the executor report-only: after CTX
// verifies the run, CTX itself publishes the run's retained output with
// server-held credentials. Existing values keep their order and meaning.
export const DELIVERY_MODES = ['report_only', 'pull_request', 'publish_after_verify'] as const;
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
