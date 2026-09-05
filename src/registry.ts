// Contract literal → schema. One place to look an envelope up by its
// `contract` field; the JSON Schema generator iterates this map.
import type { z } from 'zod';
import {
  AppHealthSchema, BrowserEvidence, DeploymentEvidence, HealthSchema, ObligationIRSchema, TodoHandleSchema,
  VerifierPlanSchema, WebJourneySchema, WorkCompletionSchema, WorkGraphLintSchema,
  WorkNodeInstructionsSchema, WorkOutcomeDraftSchema, WorkRunDetailSchema, WorkRunLaunchSchema, WorkStatusSchema,
} from './envelopes.js';

export const ENVELOPES = {
  'ctx.web-journey.v1': WebJourneySchema,
  'ctx.work-graph-lint.v1': WorkGraphLintSchema,
  'ctx.work-obligation-ir.v1': ObligationIRSchema,
  'ctx.work-outcome-draft.v1': WorkOutcomeDraftSchema,
  'ctx.todo-handle.v1': TodoHandleSchema,
  'ctx.work-completion.v1': WorkCompletionSchema,
  'ctx.work-status.v1': WorkStatusSchema,
  'ctx.work-run-detail.v1': WorkRunDetailSchema,
  'ctx.work-node-instructions.v1': WorkNodeInstructionsSchema,
  'ctx.verifier-plan.v1': VerifierPlanSchema,
  'ctx.work-run.v1': WorkRunLaunchSchema,
  'ctx.health.v1': HealthSchema,
  'ctx.app-health.v1': AppHealthSchema,
  'ctx.deployment-release-evidence.v1': DeploymentEvidence,
  'ctx.browser-smoke-evidence.v1': BrowserEvidence,
} as const;

export type Contract = keyof typeof ENVELOPES;
export type Envelope<C extends Contract> = z.infer<(typeof ENVELOPES)[C]>;

export const CONTRACTS = Object.keys(ENVELOPES) as Contract[];

/** Parse an unknown value by its own `contract` literal. Throws ZodError, or
 * a plain Error when the literal is missing or unknown. */
export function parseEnvelope(value: unknown): Envelope<Contract> {
  const contract = (value as { contract?: unknown } | null)?.contract;
  if (typeof contract !== 'string' || !(contract in ENVELOPES)) {
    throw new Error(`unknown CTX contract: ${JSON.stringify(contract ?? null)}`);
  }
  return ENVELOPES[contract as Contract].parse(value) as Envelope<Contract>;
}
