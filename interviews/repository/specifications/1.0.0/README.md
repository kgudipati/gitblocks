# Repository interview specification 1.0.0

This immutable directory defines the reviewed semantic source and generated
schema snapshots for repository interviews. It contains no candidate content,
prompt instance, model profile, provider response, credential, or live
execution data.

## Authority and files

- `instructions.md` and `questions.json` are reviewed semantic source.
- `packages/interviews/src/provider-output-schema.ts` is the sole executable
  provider-output schema source.
- `provider-output.schema.json` and
  `providers/openai-responses.strict.schema.json` are generated snapshots.
- `specification.json` is a closed generated digest manifest.
- This README is explanatory and excluded from semantic execution digests.

`pnpm interviews:generate` is the only command that writes the generated
snapshots and manifest. `pnpm interviews:validate` is read-only and fails on
source, snapshot, projection, or digest drift. Neither command performs a
network request.

The specification digest binds the exact instruction bytes, exact ordered
question bytes, provider-output schema version and digest, renderer version,
and controlled semantic policy. The OpenAI projection has its own version and
digest, so a provider-only projection correction need not change semantic
specification identity. Candidate, artifact set, model, reasoning effort,
provider request settings, timestamps, and candidate prompt bytes are excluded.

NFC normalization is not required for semantic text. GitBlocks preserves exact
input text, requires exact UTF-8 round trip, and rejects prohibited control or
format characters rather than silently normalizing, trimming, rewriting, or
sanitizing provider output.

Before first live use, generated files may be corrected with review. After any
live execution references this directory, its semantic source and generated
artifacts are immutable; semantic changes require a new specification
directory, while provider-only projection changes require a new projection
version with preserved historical reconstruction.
