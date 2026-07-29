# Observability and reliability

## Purpose and current status

Every future production execution path must be diagnosable from deployed
telemetry and durable audit evidence without adding emergency instrumentation
or reproducing the user's sensitive content. GitBlocks currently has no
services, workers, deployments, SLOs, or telemetry pipeline. Its persistence
adapter returns stable value-free errors. The Phase 5 operator-run ingester
accepts an injected observer and emits bounded request/candidate/batch events
plus a durable secret-free receipt; it is not a deployed telemetry system. A
future application/composition layer must select and instrument an export path
before handling production traffic. This document sets the policy for those
paths.

The first stack and deployment ADRs must select instrumentation libraries,
export path, sampling, retention, access, redaction, dashboards, and runbook
ownership. Prefer vendor-neutral
[OpenTelemetry signals](https://opentelemetry.io/docs/concepts/signals/) and
[semantic conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
where stable and applicable.

## Production-path instrumentation

A production path is an inbound request, MCP operation, webhook, scheduled or
queued job, ingestion task, ranking/evidence operation, external-provider call,
data migration, or approval-gated effect that processes real user, repository,
or catalog data.

Before release, each path must emit:

- a trace or equivalent correlation context across accepted asynchronous and
  synchronous boundaries;
- metrics for demand, success/failure, latency, saturation, and rejected work;
- structured logs for decision-relevant discrete events not represented by
  metrics or span attributes; and
- a security audit event when the path authenticates, authorizes, crosses an
  approval boundary, changes security configuration, or accesses sensitive
  objects as defined by the
  [security baseline](security-baseline.md#auditability-and-security-telemetry).

Instrumentation is part of the behavior change, tested in the same PR, and
included in cost and performance budgets. A production path cannot be declared
done with “add logging later.”

## Correlation and stable names

- Propagate a trace/correlation identifier through MCP/HTTP, application calls,
  queues, workers, provider adapters, and outcome processing. Validate inbound
  context and start a new trace when it is malformed or untrusted.
- Name operations by stable product behavior, not routes, function names,
  repository names, model prompts, or customer values. Examples:
  `discovery.evaluate`, `evidence.retrieve`, `ingestion.process`,
  `outcome.record`, and `webhook.accept`.
- Use a bounded stable error taxonomy shared with public error mapping, such as
  `validation_failed`, `unauthenticated`, `forbidden`,
  `hard_constraint_unsatisfied`, `deadline_exceeded`, `provider_unavailable`,
  `rate_limited`, and `internal`.
- Record provider-specific detail only in access-controlled, redacted fields;
  do not make provider strings part of the stable public or metric taxonomy.
- Version telemetry schemas and dashboard/alert queries when names or
  attributes change. A migration must avoid blind periods.

Tests assert correlation across owned boundaries, stable operation/error names,
and safe behavior when incoming correlation metadata is invalid.

## Telemetry data contract

Allowed baseline attributes include service and operation version,
environment, result/error category, bounded capability family, evidence source
type, retry attempt bucket, status, and coarse deployment/runtime identifiers.

Telemetry must not contain:

- credentials, tokens, cookies, private keys, signatures, or `.env` values;
- raw or proprietary repository source and documentation;
- prompts, complete model output, MCP payload bodies, webhook bodies, or
  unbounded error/provider bodies;
- customer database data, sensitive configuration values, or adoption-plan
  content;
- unnecessary personal data, email addresses, IP addresses, or user-agent
  strings; or
- repository, tenant, request, evidence, job, or user identifiers as metric
  label values.

When diagnosis requires an identifier, use an access-controlled log/trace
reference or approved opaque identifier with documented retention, not a
metric label. Redaction occurs at instrumentation before export and uses an
allowlist of fields. Tests inject representative secrets and source snippets
and prove they are absent from all emitted signals.

## Cardinality and volume

Metric dimensions must have a finite reviewed value set or an explicit maximum
bound. Paths, error text, repository/package names, commit SHAs, URLs, user
identifiers, trace identifiers, model output, and payload-derived strings are
prohibited labels.

The plan for a new metric states:

- name, type, unit, description, and owner;
- each label and its bounded value set;
- expected series count per service/environment;
- collection and retention cost;
- dashboard, SLO, alert, or capacity decision it supports; and
- removal or migration behavior.

High-volume logs and spans define sampling and aggregation without discarding
all errors or security audit events. Sampling decisions must not be based on
attacker-controlled high-cardinality values. Deployment tests or canaries
confirm expected telemetry volume before broad rollout.

## Request and external-call reliability

Every request and provider call has an end-to-end deadline, per-attempt timeout,
cancellation propagation, response/body size limit, concurrency limit, and
defined overload response. Pagination has a stable order and maximum page size.

Retries apply only to classified transient failures and idempotent operations,
use exponential backoff with jitter, honor provider guidance and the caller's
remaining deadline, and stop after a configured maximum. Metrics distinguish
initial attempts from retries and expose retry exhaustion. Circuit breaking,
hedging, caching, or fallback requires measured need and must preserve
authorization, freshness, and error semantics.

Partial evidence, source unavailability, stale evidence, and timeouts are
visible results. The system must not convert them into a complete successful
recommendation.

Database callers provide deadlines and cancellation signals. The adapter
applies bounded statement and lock timeouts inside explicit transactions and
maps failures to stable error categories without exposing SQL, parameters,
payloads, connection strings, URLs, driver details, or stack traces. Migration
commands report only version, name, checksum, and PostgreSQL version.
Application telemetry may record bounded operation/result categories,
durations, and counts, but never SQL statements or persisted evidence content.

## Worker and job observability

Each job type defines a versioned payload, owner, idempotency key, maximum
attempts, deadline, concurrency, ordering requirement, retryable errors,
backoff, poison-message policy, and dead-letter/recovery procedure.

For every attempt, emit or derive:

- stable job type and contract version;
- correlation and safe job reference;
- queue wait and execution duration;
- attempt number or bounded attempt bucket;
- result/error category;
- retry decision and scheduled delay;
- cancellation or deadline result;
- idempotency/deduplication result; and
- terminal, abandoned, or dead-letter state.

Dashboards show accepted, started, completed, failed, retried, saturated, stale,
and dead-letter work; queue depth/age; concurrency utilization; and provider
limiting. Alerts target sustained user-impacting symptoms and dead-letter
growth, not every individual retry. Runbooks describe safe replay, quarantine,
and forward recovery without bypassing authorization or approval controls.

## Health, readiness, and graceful lifecycle

Future services expose separate health and readiness semantics:

- **Health/liveness** answers whether the process can make progress. It does not
  perform expensive dependency checks or expose diagnostic detail.
- **Readiness** answers whether the instance should receive new work. It becomes
  false during incomplete initialization, unsafe configuration, inability to
  meet required dependency contracts, or graceful drain.
- Optional dependency degradation is represented separately and in user-facing
  results; it must not make readiness green when the advertised operation would
  silently return invalid results.

Endpoints require no sensitive payloads and reveal only minimal status to
unauthenticated callers. Orchestrators use conservative timeouts. Shutdown
stops accepting work, propagates cancellation, gives bounded in-flight work a
documented drain period, returns unfinished work safely to its queue where
possible, flushes telemetry within a bound, and exits. Startup, shutdown, and
dependency-transition behavior require integration tests.

## SLOs and alerting

Before the first user-facing service launches, define service-level indicators
(SLIs) from the user's perspective and set initial service-level objectives
(SLOs) from measured preproduction or alpha baselines. At minimum consider:

- successful discovery/MCP operation availability;
- latency to a useful recommendation or explicit responsible failure;
- evidence freshness and traceability;
- ingestion/outcome processing completion time;
- hard-constraint violation rate; and
- privacy/security invariants, which are not traded against availability.

Each SLO states population, good event, threshold, window, exclusions,
measurement source, owner, and error-budget policy. Do not invent targets before
a representative baseline. Alerts are actionable, symptom-based, deduplicated,
severity-labeled, tied to a runbook and owner, and tested. Page only for urgent
user or security impact; route capacity trends and individual recoverable
failures to non-page workflows.

Error-budget exhaustion pauses risk-increasing feature rollout for the affected
path until reliability is restored or maintainers record an explicit
risk-acceptance decision. SLOs do not excuse known data loss, tenant escape,
secret exposure, or unsafe recommendation behavior.

## Incident diagnosis and evidence

A responder must be able to determine, without a code change:

- which stable operation and version failed;
- start, duration, dependency path, and final state;
- validated authorization-safe object references involved;
- authorization and approval decision category;
- evidence/source freshness state;
- timeout, retry, cancellation, saturation, and queue/dead-letter history;
- deployment/configuration version; and
- the runbook and owner for recovery.

Dashboards link metrics to traces and redacted logs using correlation, while
audit records remain access-controlled and purpose-specific. Runbooks include
detection, triage, containment, safe retry/replay, rollback or forward
recovery, user communication, evidence preservation, and escalation.

After an incident, record impact, timeline, contributing system conditions,
detection gaps, recovery, and owned preventive actions. Focus on system
improvement. Material gaps become linked issues; emergency instrumentation is a
signal that the relevant path did not meet this policy.

## Validation and review evidence

An applicable PR includes:

- instrumentation and redaction tests;
- telemetry schema and cardinality review;
- expected volume/cost and performance impact;
- correlation and async propagation tests;
- updated dashboard, alert, SLO, and runbook references when deployed;
- health/readiness and lifecycle tests for services;
- worker retry, dead-letter, replay, and idempotency evidence; and
- the exact local/preproduction commands and observed results.

Missing telemetry may be accepted only for a path that cannot execute in any
shared or production environment. Once deployed, an exception needs an owner,
expiration, compensating diagnostic control, and remediation issue under the
[security exception process](security-baseline.md#security-exceptions).
