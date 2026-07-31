# GitBlocks evaluation harness

The harness owns offline, bounded evaluation validation and deterministic
scoring. `pilot-v1` remains the target-repository ranking authority. The
separate `repository-interviews-v1` modules validate candidate-owned interview
audit authority and never reinterpret pilot gold.

Repository-interview evaluation support includes an independently named JSON
Schema registry, bounded corpus loader, exact catalog/artifact authority
closure, content-minimized audit workflow validation, deterministic secondary
sampling, pure gate scoring, and synthetic adversarial/boundary fixtures. It
does not call a provider, grade with a model, write production persistence,
create production review state, or select an interview for ranking.

The schemas under `schemas/evaluation/repository-interviews/` are evaluation
schemas, not product contracts. Production packages are forbidden from
importing the harness, evaluation schemas, or `evals/` data. The harness may
exercise public contracts and interview utilities only in the inward,
evaluation-consumer direction.

Ordinary validation is read-only and uses the existing 256 KiB file, bounded
JSON depth/node, safe path, and no-symlink boundary. CLI output contains only
corpus identities/counts/digests and fixture scenario names/results; it never
prints candidate rationale, hostile fixture text, semantic content, reviewer
values, prompts, or provider data.
