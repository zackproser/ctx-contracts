// Zod → JSON Schema 2020-12. Pure function so the test suite can diff the
// committed files against a fresh generation without touching disk.
import { zodToJsonSchema } from 'zod-to-json-schema';

export const SCHEMA_ID_BASE = 'https://github.com/zackproser/ctx-contracts/schemas/';

export function generateSchemas(envelopes) {
  const out = {};
  for (const [contract, schema] of Object.entries(envelopes)) {
    // draft-07 output with no $ref indirection is a valid 2020-12 document as
    // long as no tuple `items`/`definitions` appear; the tests assert that and that
    // Ajv2020 compiles every file.
    const generated = zodToJsonSchema(schema, {
      target: 'jsonSchema7', $refStrategy: 'none', removeAdditionalStrategy: 'strict',
    });
    delete generated.$schema;
    out[contract] = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `${SCHEMA_ID_BASE}${contract}.json`,
      title: contract,
      ...generated,
    };
  }
  return out;
}
