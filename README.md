<p align="center">
  <img src="docs/hero.png" alt="" width="100%">
</p>

# @ctx/contracts

The wire contracts of [CTX](https://github.com/zackproser/ctx), a personal memory and verification control plane: every `ctx.*.v1` envelope as an authored **Zod** schema, the same envelopes as generated **JSON Schema 2020-12**, the **server-owned vocabulary** (run states, node kinds, executors, resource types), and the **canonical JSON digest** (`stable` + `sha256`) that every CTX ledger, shape hash, and idempotency key is built on.

One source. Two validators that are proven equivalent in CI. Zero copies.

## Why this exists

Before this package, the same envelope lived three times: as TypeScript object literals in the control plane, as hand-copied Zod in [`ctx-cli`](https://github.com/zackproser/ctx-cli), and implicitly in the UI. `stable()`/`sha256()` had been copied into roughly ten files. Each copy drifted independently; `ctx-cli`'s artifact-type list was already missing a value the server accepted.

Now the control plane, the CLI, and anyone writing a CTX client import the same code. When the server adds a field, the Zod passthrough keeps N-1 clients working; when the server renames a contract, both repos fail to typecheck instead of failing at 3 a.m.

## Dependency direction

Protocol packages depend on nothing CTX-specific. Consumers depend downward only; `ctx-cli` never depends on `ctx`.

```
          ┌────────────────────────────────────────┐
          │  ctx  (control plane: DB, secrets,     │
          │        providers, receipts, owner UI)  │
          └───────┬────────────────┬───────────────┘
                  │ exact pin      │ exact pin
                  ▼                ▼
   ┌──────────────────────┐  ┌──────────────────────┐
   │  @ctx/graph-kernel   │  │  @ctx/verifier-core  │
   │  lint · evaluate ·   │  │  evidence truth ·    │
   │  shape hash · IR     │  │  receipts · redaction│
   └──────────┬───────────┘  └──────────┬───────────┘
              │                         │
              ▼                         ▼
          ┌────────────────────────────────────────┐
          │           @ctx/contracts  (this)       │
          │  Zod envelopes · JSON Schema 2020-12   │
          │  vocabulary · stable()/sha256()        │
          └────────────────────────────────────────┘
                          ▲
                          │ N and N-1
          ┌───────────────┴────────────────────────┐
          │  ctx-cli  (agent control plane CLI)    │
          └────────────────────────────────────────┘
```

Rule of thumb for what belongs here: anything both sides must agree on **byte for byte** and that touches no secret, database row, or provider. Everything else stays in `ctx`.

## Install

Not on the public npm registry yet. Pin a commit from GitHub; npm builds `dist/` on install via `prepare`:

```sh
npm install "git+https://github.com/zackproser/ctx-contracts.git#<commit-sha>"
```

`zod ^3.25` is a peer dependency, so the schemas share your app's Zod instance (`instanceof ZodError` works). Node ≥ 20; also runs in Cloudflare Workers and browsers (`crypto.subtle`, no Node built-ins).

## API

### Envelopes

```ts
import { TodoHandleSchema, parseEnvelope, ENVELOPES, type TodoHandle } from '@ctx/contracts';

const body = await response.json();
const handle: TodoHandle = TodoHandleSchema.parse(body);      // one contract you expect
const any = parseEnvelope(body);                               // dispatch on body.contract
Object.keys(ENVELOPES);                                        // every registered contract literal
```

Every read-model envelope is `.passthrough()`: the schema pins the contract literal and the custody fields a client relies on, and forwards everything else untouched. That is what lets a version-N client read a version-N+1 server.

| Contract | Schema | What it is |
|---|---|---|
| `ctx.work-outcome-draft.v1` | `WorkOutcomeDraftSchema` | Compiler v2 output (`schema_version: 2`): outcome graph, lanes, obligations, lint, obligation IR, template, provenance, `generated_by` deterministic/model/merged, `status` final/improving, `fallback_reason` |
| `ctx.work-obligation-ir.v1` | `ObligationIRSchema` | Typed obligation inventory the compiler lowers into the graph (embedded as `ir` in the draft) |
| `ctx.work-graph-lint.v1` | `WorkGraphLintSchema` | Topology + diagnostics for a completion graph shape |
| `ctx.todo-handle.v1` | `TodoHandleSchema` | Governed dispatch result: graph custody, jobs, receipts |
| `ctx.work-completion.v1` | `WorkCompletionSchema` | Completion-graph read model (status ≠ execution) |
| `ctx.work-run.v1` | `WorkRunLaunchSchema` | Run launch acknowledgment |
| `ctx.work-run-detail.v1` | `WorkRunDetailSchema` | One run with its event log |
| `ctx.work-node-instructions.v1` | `WorkNodeInstructionsSchema` | Node custody + executability for an executor |
| `ctx.verifier-plan.v1` | `VerifierPlanSchema` | Default verifier bindings for a node |
| `ctx.web-journey.v1` | `WebJourneySchema` | Browser journey spec (desktop + phone fixtures, assertions) |
| `ctx.deployment-release-evidence.v1` | `DeploymentEvidence` | Release verifier evidence |
| `ctx.browser-smoke-evidence.v1` | `BrowserEvidence` | Browser verifier evidence |
| `ctx.health.v1` / `ctx.app-health.v1` | `HealthSchema` / `AppHealthSchema` | Health probes embedded in evidence |

### JSON Schema

```ts
import schema from '@ctx/contracts/schemas/ctx.todo-handle.v1.json' with { type: 'json' };
// or read schemas/index.json for the list
```

Generated from the Zod source by `npm run schemas`; CI fails if the committed files are stale. Zod is the authored source, JSON Schema is the structural projection: cross-field refinements (`WebJourneySchema` requires a desktop *and* a phone fixture) exist only in Zod. Conformance tests in `test/schemas.test.ts` prove every golden fixture in `fixtures/` is accepted by both Zod and Ajv 2020-12 and rejected by both when the contract literal is wrong.

### Vocabulary

```ts
import { WORK_RUN_STATES, WORK_EXECUTORS, COMPLETION_STATUSES, type WorkRunState } from '@ctx/contracts';

new Option('--executor <executor>').choices([...WORK_EXECUTORS]);
```

`WORK_NODE_KINDS`, `WORK_EDGE_KINDS`, `WORK_RESOURCE_TYPES` (alias `ARTIFACT_TYPES`), `WORK_RUN_STATES`, `WORK_RESOURCE_HEALTH`, `COMPLETION_NODE_KINDS`, `COMPLETION_STATUSES`, `COMPLETION_POLICIES`, `CARDINALITY_MODES`, `COMPLETION_GRAPH_STATES`, `WORK_EXECUTORS`, `DELIVERY_MODES`, `EFFORTS`, the compiler lists (`DRAFT_GENERATORS`, `DRAFT_STATUSES`, `DRAFT_FALLBACK_REASONS`, `DRAFT_TEMPLATES`, `DRAFT_STEP_VERIFIER_IDS`, `DRAFT_STEP_VERIFIER_LABELS`, `DRAFT_RECEIPT_VERIFIER_IDS`, `REPOSITORY_ROLES`, `DELIVERABLE_KINDS`, `CHECK_KINDS`), plus the `WorkResource` interface. The server is the only writer of these lists.

### Canonical digest

```ts
import { stable, sha256 } from '@ctx/contracts';

stable({ b: 1, a: [{ z: 0, y: 1 }] });   // { a: [{ y: 1, z: 0 }], b: 1 }  (keys sorted, arrays kept)
await sha256({ schema: 'ctx.work-completion.v1', nodes, edges }); // 64 hex chars
```

`sha256(value)` is `SHA-256(JSON.stringify(stable(value)))`. Every stored `shape_hash`, `member_hash`, and idempotency digest in CTX depends on this exact byte form, so the test suite pins a known vector. Do not "improve" it.

## Versioning and compatibility

| `@ctx/contracts` | `ctx` (server) | `ctx-cli` | Notes |
|---|---|---|---|
| 0.1.x | pins exact commit | supports N and N-1 | first extraction; identical bytes to the in-repo copies it replaced |

* Envelope literals are versioned in the name (`.v1`). A breaking shape change is a new literal, never a silent edit.
* Adding an optional field or a passthrough-tolerated field is a minor bump. `ctx` pins an exact commit; `ctx-cli` must keep parsing the previous minor too (the `obligations` and `repository` fields show the pattern: optional on the client, present on the newer server).
* `stable`/`sha256` and the vocabulary lists are frozen in place; a change there is a major bump and a data migration in `ctx`.

## Contributing

```sh
npm ci
npm test              # zod + json-schema conformance, 41 tests
npm run schemas       # regenerate schemas/ after editing src/envelopes.ts — commit the result
npm run typecheck
```

1. Edit the Zod in `src/envelopes.ts`; register new contracts in `src/registry.ts`; add a golden fixture in `fixtures/<contract>.json`.
2. `npm run schemas` and commit the generated files. CI runs `git diff --exit-code -- schemas`.
3. Cross-repo conformance runs on the consumer side: `ctx-cli`'s CI has a `contracts-main` job that installs the tip of this repo and runs the CLI's whole suite against it, so drift between the two shows up before a pin is bumped. (`ctx-cli` is a private repository, so the check cannot run from here without a new secret.)
4. Pin the new commit in `ctx` (exact) and, when the CLI needs the change, in `ctx-cli`.

## License

MIT, see [LICENSE](LICENSE). Extracted from `ctx` and `ctx-cli`; see [NOTICE](NOTICE) for the source commits.
