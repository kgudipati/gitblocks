create unique index repository_artifact_sets_interview_identity
  on gitblocks.repository_artifact_sets (
    artifact_set_id,
    candidate_id,
    identity_digest
  );

create table gitblocks.repository_interview_requests (
  request_id text primary key,
  candidate_id text not null,
  artifact_set_id text not null,
  contract_version text not null,
  artifact_set_identity_digest text not null,
  specification_version text not null,
  specification_digest text not null,
  renderer_version text not null,
  provider_output_schema_version text not null,
  provider_output_schema_digest text not null,
  prompt_digest text not null,
  identity_digest text not null,
  record_digest text not null,
  canonical_payload jsonb not null,
  constraint repository_interview_requests_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint repository_interview_requests_artifact_set
    foreign key (
      artifact_set_id,
      candidate_id,
      artifact_set_identity_digest
    )
    references gitblocks.repository_artifact_sets (
      artifact_set_id,
      candidate_id,
      identity_digest
    ),
  constraint repository_interview_requests_identity unique (identity_digest),
  constraint repository_interview_requests_context
    unique (
      request_id,
      candidate_id,
      artifact_set_id,
      identity_digest
    ),
  constraint repository_interview_requests_id
    check (request_id ~ '^intreq-[0-9a-f]{48}$'),
  constraint repository_interview_requests_contract
    check (contract_version = '1.0.0'),
  constraint repository_interview_requests_versions
    check (
      pg_catalog.octet_length(specification_version) between 1 and 64
      and pg_catalog.octet_length(renderer_version) between 1 and 64
      and pg_catalog.octet_length(provider_output_schema_version)
        between 1 and 64
    ),
  constraint repository_interview_requests_digests
    check (
      artifact_set_identity_digest ~ '^[0-9a-f]{64}$'
      and specification_digest ~ '^[0-9a-f]{64}$'
      and provider_output_schema_digest ~ '^[0-9a-f]{64}$'
      and prompt_digest ~ '^[0-9a-f]{64}$'
      and identity_digest ~ '^[0-9a-f]{64}$'
      and record_digest ~ '^[0-9a-f]{64}$'
    ),
  constraint repository_interview_requests_payload_object
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint repository_interview_requests_payload
    check (
      canonical_payload ->> 'contractVersion' = contract_version
      and canonical_payload ->> 'requestId' = request_id
      and canonical_payload ->> 'candidateId' = candidate_id
      and canonical_payload ->> 'artifactSetId' = artifact_set_id
      and canonical_payload ->> 'artifactSetIdentityDigest' =
        artifact_set_identity_digest
      and canonical_payload ->> 'specificationVersion' =
        specification_version
      and canonical_payload ->> 'specificationDigest' =
        specification_digest
      and canonical_payload ->> 'rendererVersion' = renderer_version
      and canonical_payload ->> 'providerOutputSchemaVersion' =
        provider_output_schema_version
      and canonical_payload ->> 'providerOutputSchemaDigest' =
        provider_output_schema_digest
      and canonical_payload ->> 'promptDigest' = prompt_digest
      and canonical_payload ->> 'identityDigest' = identity_digest
      and canonical_payload ->> 'recordDigest' = record_digest
    )
);

create table gitblocks.model_executions (
  execution_id text primary key,
  request_id text not null,
  candidate_id text not null,
  artifact_set_id text not null,
  contract_version text not null,
  request_identity_digest text not null,
  execution_nonce text not null,
  execution_mode text not null,
  force_reason text,
  provider text not null,
  model_snapshot text not null,
  reasoning_effort text not null,
  model_profile_digest text not null,
  reuse_key_digest text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  outcome_status text not null,
  failure_code text,
  provider_output_digest text,
  identity_digest text not null,
  record_digest text not null,
  canonical_payload jsonb not null,
  constraint model_executions_request
    foreign key (
      request_id,
      candidate_id,
      artifact_set_id,
      request_identity_digest
    )
    references gitblocks.repository_interview_requests (
      request_id,
      candidate_id,
      artifact_set_id,
      identity_digest
    ),
  constraint model_executions_identity unique (identity_digest),
  constraint model_executions_context
    unique (
      execution_id,
      request_id,
      candidate_id,
      artifact_set_id,
      identity_digest
    ),
  constraint model_executions_id
    check (execution_id ~ '^modelexec-[0-9a-f]{48}$'),
  constraint model_executions_contract
    check (contract_version = '1.0.0'),
  constraint model_executions_nonce
    check (execution_nonce ~ '^[0-9a-f]{32}$'),
  constraint model_executions_mode
    check (
      (
        execution_mode = 'normal'
        and force_reason is null
      )
      or (
        execution_mode = 'forced'
        and force_reason in (
          'calibration',
          'review-rejected',
          'operator-recovery'
        )
      )
    ),
  constraint model_executions_profile
    check (
      provider = 'openai'
      and reasoning_effort in ('low', 'medium', 'high')
      and pg_catalog.octet_length(model_snapshot) between 12 and 128
    ),
  constraint model_executions_timeline
    check (
      started_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
      and completed_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
      and completed_at >= started_at
    ),
  constraint model_executions_outcome
    check (
      (
        outcome_status = 'succeeded'
        and failure_code is null
        and provider_output_digest is not null
      )
      or (
        outcome_status = 'failed'
        and failure_code in (
          'refused',
          'incomplete',
          'safety-interrupted',
          'deadline-exceeded',
          'cancelled',
          'not-authorized',
          'quota-exceeded',
          'rate-limited',
          'provider-error',
          'transport-error',
          'response-too-large',
          'invalid-response',
          'invalid-usage',
          'provider-output-invalid'
        )
        and provider_output_digest is null
      )
    ),
  constraint model_executions_digests
    check (
      request_identity_digest ~ '^[0-9a-f]{64}$'
      and model_profile_digest ~ '^[0-9a-f]{64}$'
      and reuse_key_digest ~ '^[0-9a-f]{64}$'
      and (
        provider_output_digest is null
        or provider_output_digest ~ '^[0-9a-f]{64}$'
      )
      and identity_digest ~ '^[0-9a-f]{64}$'
      and record_digest ~ '^[0-9a-f]{64}$'
    ),
  constraint model_executions_payload_object
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint model_executions_payload
    check (
      canonical_payload ->> 'contractVersion' = contract_version
      and canonical_payload ->> 'executionId' = execution_id
      and canonical_payload ->> 'requestId' = request_id
      and canonical_payload ->> 'requestIdentityDigest' =
        request_identity_digest
      and canonical_payload ->> 'executionNonce' = execution_nonce
      and canonical_payload ->> 'executionMode' = execution_mode
      and canonical_payload ->> 'forceReason' is not distinct from force_reason
      and canonical_payload #>> '{modelProfile,provider}' = provider
      and canonical_payload #>> '{modelProfile,modelSnapshot}' =
        model_snapshot
      and canonical_payload #>> '{modelProfile,reasoningEffort}' =
        reasoning_effort
      and canonical_payload ->> 'modelProfileDigest' = model_profile_digest
      and canonical_payload ->> 'reuseKeyDigest' = reuse_key_digest
      and (canonical_payload ->> 'startedAt')::timestamptz = started_at
      and (canonical_payload ->> 'completedAt')::timestamptz = completed_at
      and canonical_payload #>> '{outcome,status}' = outcome_status
      and canonical_payload #>> '{outcome,failureCode}'
        is not distinct from failure_code
      and canonical_payload #>> '{outcome,providerOutputDigest}'
        is not distinct from provider_output_digest
      and canonical_payload ->> 'identityDigest' = identity_digest
      and canonical_payload ->> 'recordDigest' = record_digest
    )
);

create index model_executions_reuse
  on gitblocks.model_executions (
    request_identity_digest,
    model_profile_digest,
    reuse_key_digest,
    execution_mode,
    outcome_status,
    completed_at,
    execution_id
  );

create table gitblocks.repository_interviews (
  interview_id text primary key,
  candidate_id text not null,
  artifact_set_id text not null,
  request_id text not null,
  execution_id text not null,
  contract_version text not null,
  artifact_set_identity_digest text not null,
  request_identity_digest text not null,
  execution_identity_digest text not null,
  provider_output_digest text not null,
  specification_version text not null,
  specification_digest text not null,
  renderer_version text not null,
  provider_output_schema_version text not null,
  provider_output_schema_digest text not null,
  provider_projection_version text not null,
  provider_projection_digest text not null,
  prompt_digest text not null,
  model_profile_digest text not null,
  processing_state text not null,
  published_at timestamptz not null,
  citation_count integer not null,
  claim_count integer not null,
  limitation_count integer not null,
  contradiction_count integer not null,
  unknown_count integer not null,
  identity_digest text not null,
  record_digest text not null,
  canonical_payload jsonb not null,
  constraint repository_interviews_request
    foreign key (
      request_id,
      candidate_id,
      artifact_set_id,
      request_identity_digest
    )
    references gitblocks.repository_interview_requests (
      request_id,
      candidate_id,
      artifact_set_id,
      identity_digest
    ),
  constraint repository_interviews_execution
    foreign key (
      execution_id,
      request_id,
      candidate_id,
      artifact_set_id,
      execution_identity_digest
    )
    references gitblocks.model_executions (
      execution_id,
      request_id,
      candidate_id,
      artifact_set_id,
      identity_digest
    ),
  constraint repository_interviews_execution_unique unique (execution_id),
  constraint repository_interviews_identity unique (identity_digest),
  constraint repository_interviews_candidate
    unique (interview_id, candidate_id),
  constraint repository_interviews_context
    unique (interview_id, candidate_id, artifact_set_id),
  constraint repository_interviews_id
    check (interview_id ~ '^interview-[0-9a-f]{48}$'),
  constraint repository_interviews_contract
    check (contract_version = '1.0.0'),
  constraint repository_interviews_processing
    check (
      processing_state in (
        'complete',
        'partial-evidence',
        'insufficient-evidence'
      )
    ),
  constraint repository_interviews_counts
    check (
      citation_count between 0 and 96
      and claim_count between 0 and 32
      and limitation_count between 0 and 12
      and contradiction_count between 0 and 6
      and unknown_count between 0 and 16
    ),
  constraint repository_interviews_published
    check (
      published_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
    ),
  constraint repository_interviews_digests
    check (
      artifact_set_identity_digest ~ '^[0-9a-f]{64}$'
      and request_identity_digest ~ '^[0-9a-f]{64}$'
      and execution_identity_digest ~ '^[0-9a-f]{64}$'
      and provider_output_digest ~ '^[0-9a-f]{64}$'
      and specification_digest ~ '^[0-9a-f]{64}$'
      and provider_output_schema_digest ~ '^[0-9a-f]{64}$'
      and provider_projection_digest ~ '^[0-9a-f]{64}$'
      and prompt_digest ~ '^[0-9a-f]{64}$'
      and model_profile_digest ~ '^[0-9a-f]{64}$'
      and identity_digest ~ '^[0-9a-f]{64}$'
      and record_digest ~ '^[0-9a-f]{64}$'
    ),
  constraint repository_interviews_payload_object
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint repository_interviews_payload
    check (
      canonical_payload ->> 'contractVersion' = contract_version
      and canonical_payload ->> 'interviewId' = interview_id
      and canonical_payload ->> 'candidateId' = candidate_id
      and canonical_payload ->> 'artifactSetId' = artifact_set_id
      and canonical_payload ->> 'requestId' = request_id
      and canonical_payload ->> 'executionId' = execution_id
      and canonical_payload ->> 'artifactSetIdentityDigest' =
        artifact_set_identity_digest
      and canonical_payload ->> 'requestIdentityDigest' =
        request_identity_digest
      and canonical_payload ->> 'executionIdentityDigest' =
        execution_identity_digest
      and canonical_payload ->> 'providerOutputDigest' =
        provider_output_digest
      and canonical_payload ->> 'specificationVersion' =
        specification_version
      and canonical_payload ->> 'specificationDigest' =
        specification_digest
      and canonical_payload ->> 'rendererVersion' = renderer_version
      and canonical_payload ->> 'providerOutputSchemaVersion' =
        provider_output_schema_version
      and canonical_payload ->> 'providerOutputSchemaDigest' =
        provider_output_schema_digest
      and canonical_payload ->> 'providerProjectionVersion' =
        provider_projection_version
      and canonical_payload ->> 'providerProjectionDigest' =
        provider_projection_digest
      and canonical_payload ->> 'promptDigest' = prompt_digest
      and canonical_payload ->> 'modelProfileDigest' = model_profile_digest
      and canonical_payload ->> 'processingState' = processing_state
      and (canonical_payload ->> 'publishedAt')::timestamptz = published_at
      and pg_catalog.jsonb_array_length(canonical_payload -> 'citations') =
        citation_count
      and pg_catalog.jsonb_array_length(canonical_payload -> 'claims') =
        claim_count
      and pg_catalog.jsonb_array_length(canonical_payload -> 'limitations') =
        limitation_count
      and pg_catalog.jsonb_array_length(
        canonical_payload -> 'contradictions'
      ) = contradiction_count
      and pg_catalog.jsonb_array_length(canonical_payload -> 'unknowns') =
        unknown_count
      and canonical_payload ->> 'identityDigest' = identity_digest
      and canonical_payload ->> 'recordDigest' = record_digest
    )
);

create table gitblocks.repository_interview_citations (
  citation_id text primary key,
  interview_id text not null,
  candidate_id text not null,
  artifact_set_id text not null,
  ordinal integer not null,
  artifact_id text not null,
  start_line integer not null,
  end_line integer not null,
  identity_digest text not null,
  record_digest text not null,
  canonical_payload jsonb not null,
  constraint repository_interview_citations_interview
    foreign key (interview_id, candidate_id, artifact_set_id)
    references gitblocks.repository_interviews (
      interview_id,
      candidate_id,
      artifact_set_id
    ),
  constraint repository_interview_citations_artifact
    foreign key (artifact_id, candidate_id)
    references gitblocks.repository_artifacts (artifact_id, candidate_id),
  constraint repository_interview_citations_ordinal
    unique (interview_id, ordinal),
  constraint repository_interview_citations_coordinate
    unique (interview_id, artifact_id, start_line, end_line),
  constraint repository_interview_citations_id
    check (citation_id ~ '^intcite-[0-9a-f]{48}$'),
  constraint repository_interview_citations_lines
    check (
      ordinal between 0 and 95
      and start_line between 1 and 10000
      and end_line between start_line and 10000
      and end_line - start_line + 1 <= 80
    ),
  constraint repository_interview_citations_digests
    check (
      identity_digest ~ '^[0-9a-f]{64}$'
      and record_digest ~ '^[0-9a-f]{64}$'
    ),
  constraint repository_interview_citations_payload_object
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint repository_interview_citations_payload
    check (
      canonical_payload ->> 'citationId' = citation_id
      and canonical_payload ->> 'artifactId' = artifact_id
      and (canonical_payload ->> 'startLine')::integer = start_line
      and (canonical_payload ->> 'endLine')::integer = end_line
      and canonical_payload ->> 'identityDigest' = identity_digest
      and canonical_payload ->> 'recordDigest' = record_digest
    )
);

create table gitblocks.repository_interview_claims (
  claim_id text primary key,
  interview_id text not null,
  candidate_id text not null,
  ordinal integer not null,
  claim_kind text not null,
  topic text not null,
  confidence text not null,
  identity_digest text not null,
  record_digest text not null,
  canonical_payload jsonb not null,
  constraint repository_interview_claims_interview
    foreign key (interview_id, candidate_id)
    references gitblocks.repository_interviews (interview_id, candidate_id),
  constraint repository_interview_claims_ordinal
    unique (interview_id, ordinal),
  constraint repository_interview_claims_id
    check (claim_id ~ '^intclaim-[0-9a-f]{48}$'),
  constraint repository_interview_claims_semantics
    check (
      ordinal between 0 and 31
      and claim_kind in ('documented-position', 'inference')
      and topic in (
        'purpose-and-scope',
        'runtime-and-framework',
        'integration-surface',
        'data-and-state',
        'deployment-and-operations',
        'security-and-trust',
        'maintenance-and-support',
        'adoption-and-limitations'
      )
      and (
        (
          claim_kind = 'documented-position'
          and confidence in ('high', 'medium')
        )
        or (
          claim_kind = 'inference'
          and confidence in ('medium', 'low')
        )
      )
    ),
  constraint repository_interview_claims_digests
    check (
      identity_digest ~ '^[0-9a-f]{64}$'
      and record_digest ~ '^[0-9a-f]{64}$'
    ),
  constraint repository_interview_claims_payload_object
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint repository_interview_claims_payload
    check (
      canonical_payload ->> 'claimId' = claim_id
      and canonical_payload ->> 'kind' = claim_kind
      and canonical_payload ->> 'topic' = topic
      and canonical_payload ->> 'confidence' = confidence
      and canonical_payload ->> 'identityDigest' = identity_digest
      and canonical_payload ->> 'recordDigest' = record_digest
    )
);

create table gitblocks.repository_interview_limitations (
  limitation_id text primary key,
  interview_id text not null,
  candidate_id text not null,
  ordinal integer not null,
  basis text not null,
  topic text not null,
  confidence text not null,
  identity_digest text not null,
  record_digest text not null,
  canonical_payload jsonb not null,
  constraint repository_interview_limitations_interview
    foreign key (interview_id, candidate_id)
    references gitblocks.repository_interviews (interview_id, candidate_id),
  constraint repository_interview_limitations_ordinal
    unique (interview_id, ordinal),
  constraint repository_interview_limitations_id
    check (limitation_id ~ '^intlimit-[0-9a-f]{48}$'),
  constraint repository_interview_limitations_semantics
    check (
      ordinal between 0 and 11
      and basis in ('documented-position', 'inference')
      and topic in (
        'purpose-and-scope',
        'runtime-and-framework',
        'integration-surface',
        'data-and-state',
        'deployment-and-operations',
        'security-and-trust',
        'maintenance-and-support',
        'adoption-and-limitations'
      )
      and (
        (
          basis = 'documented-position'
          and confidence in ('high', 'medium')
        )
        or (
          basis = 'inference'
          and confidence in ('medium', 'low')
        )
      )
    ),
  constraint repository_interview_limitations_digests
    check (
      identity_digest ~ '^[0-9a-f]{64}$'
      and record_digest ~ '^[0-9a-f]{64}$'
    ),
  constraint repository_interview_limitations_payload_object
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint repository_interview_limitations_payload
    check (
      canonical_payload ->> 'limitationId' = limitation_id
      and canonical_payload ->> 'basis' = basis
      and canonical_payload ->> 'topic' = topic
      and canonical_payload ->> 'confidence' = confidence
      and canonical_payload ->> 'identityDigest' = identity_digest
      and canonical_payload ->> 'recordDigest' = record_digest
    )
);

create table gitblocks.repository_interview_contradictions (
  contradiction_id text primary key,
  interview_id text not null,
  candidate_id text not null,
  ordinal integer not null,
  topic text not null,
  contradiction_kind text not null,
  identity_digest text not null,
  record_digest text not null,
  canonical_payload jsonb not null,
  constraint repository_interview_contradictions_interview
    foreign key (interview_id, candidate_id)
    references gitblocks.repository_interviews (interview_id, candidate_id),
  constraint repository_interview_contradictions_ordinal
    unique (interview_id, ordinal),
  constraint repository_interview_contradictions_id
    check (contradiction_id ~ '^intcontra-[0-9a-f]{48}$'),
  constraint repository_interview_contradictions_semantics
    check (
      ordinal between 0 and 5
      and topic in (
        'purpose-and-scope',
        'runtime-and-framework',
        'integration-surface',
        'data-and-state',
        'deployment-and-operations',
        'security-and-trust',
        'maintenance-and-support',
        'adoption-and-limitations'
      )
      and contradiction_kind in (
        'direct',
        'scope-dependent',
        'version-dependent'
      )
    ),
  constraint repository_interview_contradictions_digests
    check (
      identity_digest ~ '^[0-9a-f]{64}$'
      and record_digest ~ '^[0-9a-f]{64}$'
    ),
  constraint repository_interview_contradictions_payload_object
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint repository_interview_contradictions_payload
    check (
      canonical_payload ->> 'contradictionId' = contradiction_id
      and canonical_payload ->> 'topic' = topic
      and canonical_payload ->> 'kind' = contradiction_kind
      and canonical_payload ->> 'identityDigest' = identity_digest
      and canonical_payload ->> 'recordDigest' = record_digest
    )
);

create table gitblocks.repository_interview_unknowns (
  unknown_id text primary key,
  interview_id text not null,
  candidate_id text not null,
  ordinal integer not null,
  topic text not null,
  reason text not null,
  identity_digest text not null,
  record_digest text not null,
  canonical_payload jsonb not null,
  constraint repository_interview_unknowns_interview
    foreign key (interview_id, candidate_id)
    references gitblocks.repository_interviews (interview_id, candidate_id),
  constraint repository_interview_unknowns_ordinal
    unique (interview_id, ordinal),
  constraint repository_interview_unknowns_id
    check (unknown_id ~ '^intunknown-[0-9a-f]{48}$'),
  constraint repository_interview_unknowns_semantics
    check (
      ordinal between 0 and 15
      and topic in (
        'purpose-and-scope',
        'runtime-and-framework',
        'integration-surface',
        'data-and-state',
        'deployment-and-operations',
        'security-and-trust',
        'maintenance-and-support',
        'adoption-and-limitations'
      )
      and reason in (
        'not-documented',
        'ambiguous',
        'conflicting',
        'insufficient-detail',
        'artifact-unavailable'
      )
    ),
  constraint repository_interview_unknowns_digests
    check (
      identity_digest ~ '^[0-9a-f]{64}$'
      and record_digest ~ '^[0-9a-f]{64}$'
    ),
  constraint repository_interview_unknowns_payload_object
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint repository_interview_unknowns_payload
    check (
      canonical_payload ->> 'unknownId' = unknown_id
      and canonical_payload ->> 'topic' = topic
      and canonical_payload ->> 'reason' = reason
      and canonical_payload ->> 'identityDigest' = identity_digest
      and canonical_payload ->> 'recordDigest' = record_digest
    )
);

create function gitblocks.assert_repository_interview_closure(
  target_interview_id text
)
returns void
language plpgsql
set search_path = ''
as $gitblocks_repository_interview_closure$
declare
  target_interview gitblocks.repository_interviews%rowtype;
  target_execution gitblocks.model_executions%rowtype;
begin
  select *
  into target_interview
  from gitblocks.repository_interviews
  where interview_id = target_interview_id;

  if not found then
    return;
  end if;

  select *
  into target_execution
  from gitblocks.model_executions
  where execution_id = target_interview.execution_id;

  if not found
    or target_execution.outcome_status <> 'succeeded'
    or target_execution.request_id <> target_interview.request_id
    or target_execution.candidate_id <> target_interview.candidate_id
    or target_execution.artifact_set_id <> target_interview.artifact_set_id
    or target_execution.identity_digest <>
      target_interview.execution_identity_digest
    or target_execution.provider_output_digest <>
      target_interview.provider_output_digest
    or target_execution.model_profile_digest <>
      target_interview.model_profile_digest
    or target_execution.canonical_payload
      #>> '{modelProfile,providerProjectionVersion}' <>
        target_interview.provider_projection_version
    or target_execution.canonical_payload
      #>> '{modelProfile,providerProjectionDigest}' <>
        target_interview.provider_projection_digest
    or target_execution.completed_at > target_interview.published_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'repository interview provenance closure rejected';
  end if;

  if not exists (
    select 1
    from gitblocks.repository_interview_requests as request
    where request.request_id = target_interview.request_id
      and request.candidate_id = target_interview.candidate_id
      and request.artifact_set_id = target_interview.artifact_set_id
      and request.artifact_set_identity_digest =
        target_interview.artifact_set_identity_digest
      and request.identity_digest =
        target_interview.request_identity_digest
      and request.specification_version =
        target_interview.specification_version
      and request.specification_digest =
        target_interview.specification_digest
      and request.renderer_version = target_interview.renderer_version
      and request.provider_output_schema_version =
        target_interview.provider_output_schema_version
      and request.provider_output_schema_digest =
        target_interview.provider_output_schema_digest
      and request.prompt_digest = target_interview.prompt_digest
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'repository interview request closure rejected';
  end if;

  if exists (
    select 1
    from (
      values
        (
          'repository_interview_citations',
          target_interview.citation_count
        ),
        ('repository_interview_claims', target_interview.claim_count),
        (
          'repository_interview_limitations',
          target_interview.limitation_count
        ),
        (
          'repository_interview_contradictions',
          target_interview.contradiction_count
        ),
        ('repository_interview_unknowns', target_interview.unknown_count)
    ) as expected(table_name, expected_count)
    where (
      case expected.table_name
        when 'repository_interview_citations' then (
          select pg_catalog.count(*)
          from gitblocks.repository_interview_citations
          where interview_id = target_interview_id
        )
        when 'repository_interview_claims' then (
          select pg_catalog.count(*)
          from gitblocks.repository_interview_claims
          where interview_id = target_interview_id
        )
        when 'repository_interview_limitations' then (
          select pg_catalog.count(*)
          from gitblocks.repository_interview_limitations
          where interview_id = target_interview_id
        )
        when 'repository_interview_contradictions' then (
          select pg_catalog.count(*)
          from gitblocks.repository_interview_contradictions
          where interview_id = target_interview_id
        )
        else (
          select pg_catalog.count(*)
          from gitblocks.repository_interview_unknowns
          where interview_id = target_interview_id
        )
      end
    ) <> expected.expected_count
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'repository interview member count rejected';
  end if;

  if exists (
    select 1
    from gitblocks.repository_interview_citations as member
    where member.interview_id = target_interview_id
      and member.canonical_payload <>
        target_interview.canonical_payload -> 'citations' -> member.ordinal
    union all
    select 1
    from gitblocks.repository_interview_claims as member
    where member.interview_id = target_interview_id
      and member.canonical_payload <>
        target_interview.canonical_payload -> 'claims' -> member.ordinal
    union all
    select 1
    from gitblocks.repository_interview_limitations as member
    where member.interview_id = target_interview_id
      and member.canonical_payload <>
        target_interview.canonical_payload -> 'limitations' -> member.ordinal
    union all
    select 1
    from gitblocks.repository_interview_contradictions as member
    where member.interview_id = target_interview_id
      and member.canonical_payload <>
        target_interview.canonical_payload -> 'contradictions' -> member.ordinal
    union all
    select 1
    from gitblocks.repository_interview_unknowns as member
    where member.interview_id = target_interview_id
      and member.canonical_payload <>
        target_interview.canonical_payload -> 'unknowns' -> member.ordinal
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'repository interview member payload rejected';
  end if;

  if (
    target_interview.citation_count > 0
    and exists (
      select 1
      from (
        select pg_catalog.min(ordinal) as minimum,
          pg_catalog.max(ordinal) as maximum,
          pg_catalog.count(*) as total
        from gitblocks.repository_interview_citations
        where interview_id = target_interview_id
      ) as ordinals
      where ordinals.minimum <> 0
        or ordinals.maximum <> target_interview.citation_count - 1
        or ordinals.total <> target_interview.citation_count
    )
  ) or (
    target_interview.claim_count > 0
    and exists (
      select 1
      from (
        select pg_catalog.min(ordinal) as minimum,
          pg_catalog.max(ordinal) as maximum,
          pg_catalog.count(*) as total
        from gitblocks.repository_interview_claims
        where interview_id = target_interview_id
      ) as ordinals
      where ordinals.minimum <> 0
        or ordinals.maximum <> target_interview.claim_count - 1
        or ordinals.total <> target_interview.claim_count
    )
  ) or (
    target_interview.limitation_count > 0
    and exists (
      select 1
      from (
        select pg_catalog.min(ordinal) as minimum,
          pg_catalog.max(ordinal) as maximum,
          pg_catalog.count(*) as total
        from gitblocks.repository_interview_limitations
        where interview_id = target_interview_id
      ) as ordinals
      where ordinals.minimum <> 0
        or ordinals.maximum <> target_interview.limitation_count - 1
        or ordinals.total <> target_interview.limitation_count
    )
  ) or (
    target_interview.contradiction_count > 0
    and exists (
      select 1
      from (
        select pg_catalog.min(ordinal) as minimum,
          pg_catalog.max(ordinal) as maximum,
          pg_catalog.count(*) as total
        from gitblocks.repository_interview_contradictions
        where interview_id = target_interview_id
      ) as ordinals
      where ordinals.minimum <> 0
        or ordinals.maximum <> target_interview.contradiction_count - 1
        or ordinals.total <> target_interview.contradiction_count
    )
  ) or (
    target_interview.unknown_count > 0
    and exists (
      select 1
      from (
        select pg_catalog.min(ordinal) as minimum,
          pg_catalog.max(ordinal) as maximum,
          pg_catalog.count(*) as total
        from gitblocks.repository_interview_unknowns
        where interview_id = target_interview_id
      ) as ordinals
      where ordinals.minimum <> 0
        or ordinals.maximum <> target_interview.unknown_count - 1
        or ordinals.total <> target_interview.unknown_count
    )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'repository interview member ordinal rejected';
  end if;

  if exists (
    select 1
    from gitblocks.repository_interview_citations as citation
    join gitblocks.repository_artifacts as artifact
      on artifact.artifact_id = citation.artifact_id
    where citation.interview_id = target_interview_id
      and (
        citation.candidate_id <> target_interview.candidate_id
        or citation.artifact_set_id <> target_interview.artifact_set_id
        or citation.end_line > artifact.line_count
        or not exists (
          select 1
          from gitblocks.repository_artifact_set_entries as entry
          where entry.artifact_set_id = target_interview.artifact_set_id
            and entry.candidate_id = target_interview.candidate_id
            and entry.outcome = 'present'
            and entry.artifact_id = citation.artifact_id
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'repository interview citation closure rejected';
  end if;

  if exists (
    with citation_references(citation_id) as (
      select claim_citation.citation_id
      from gitblocks.repository_interview_claims as item,
        lateral pg_catalog.jsonb_array_elements_text(
          item.canonical_payload -> 'citationIds'
        ) as claim_citation(citation_id)
      where item.interview_id = target_interview_id
      union all
      select limitation_citation.citation_id
      from gitblocks.repository_interview_limitations as item,
        lateral pg_catalog.jsonb_array_elements_text(
          item.canonical_payload -> 'citationIds'
        ) as limitation_citation(citation_id)
      where item.interview_id = target_interview_id
      union all
      select contradiction_citation.citation_id
      from gitblocks.repository_interview_contradictions as item,
        lateral pg_catalog.jsonb_array_elements(
          item.canonical_payload -> 'positions'
        ) as position(position_payload),
        lateral pg_catalog.jsonb_array_elements_text(
          position.position_payload -> 'citationIds'
        ) as contradiction_citation(citation_id)
      where item.interview_id = target_interview_id
      union all
      select unknown_citation.citation_id
      from gitblocks.repository_interview_unknowns as item,
        lateral pg_catalog.jsonb_array_elements_text(
          item.canonical_payload -> 'partialCitationIds'
        ) as unknown_citation(citation_id)
      where item.interview_id = target_interview_id
    )
    select 1
    from citation_references
    left join gitblocks.repository_interview_citations as citation
      on citation.interview_id = target_interview_id
      and citation.citation_id = citation_references.citation_id
    where citation.citation_id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'repository interview citation reference rejected';
  end if;

  if exists (
    with citation_references(citation_id) as (
      select claim_citation.citation_id
      from gitblocks.repository_interview_claims as item,
        lateral pg_catalog.jsonb_array_elements_text(
          item.canonical_payload -> 'citationIds'
        ) as claim_citation(citation_id)
      where item.interview_id = target_interview_id
      union
      select limitation_citation.citation_id
      from gitblocks.repository_interview_limitations as item,
        lateral pg_catalog.jsonb_array_elements_text(
          item.canonical_payload -> 'citationIds'
        ) as limitation_citation(citation_id)
      where item.interview_id = target_interview_id
      union
      select contradiction_citation.citation_id
      from gitblocks.repository_interview_contradictions as item,
        lateral pg_catalog.jsonb_array_elements(
          item.canonical_payload -> 'positions'
        ) as position(position_payload),
        lateral pg_catalog.jsonb_array_elements_text(
          position.position_payload -> 'citationIds'
        ) as contradiction_citation(citation_id)
      where item.interview_id = target_interview_id
      union
      select unknown_citation.citation_id
      from gitblocks.repository_interview_unknowns as item,
        lateral pg_catalog.jsonb_array_elements_text(
          item.canonical_payload -> 'partialCitationIds'
        ) as unknown_citation(citation_id)
      where item.interview_id = target_interview_id
    )
    select 1
    from gitblocks.repository_interview_citations as citation
    left join citation_references
      on citation_references.citation_id = citation.citation_id
    where citation.interview_id = target_interview_id
      and citation_references.citation_id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'repository interview orphan citation rejected';
  end if;

  if exists (
    select 1
    from gitblocks.repository_interview_claims as item
    where item.interview_id = target_interview_id
      and (
        select pg_catalog.count(*) <>
          pg_catalog.count(distinct citation.citation_id)
        from pg_catalog.jsonb_array_elements_text(
          item.canonical_payload -> 'citationIds'
        ) as citation(citation_id)
      )
    union all
    select 1
    from gitblocks.repository_interview_limitations as item
    where item.interview_id = target_interview_id
      and (
        select pg_catalog.count(*) <>
          pg_catalog.count(distinct citation.citation_id)
        from pg_catalog.jsonb_array_elements_text(
          item.canonical_payload -> 'citationIds'
        ) as citation(citation_id)
      )
    union all
    select 1
    from gitblocks.repository_interview_unknowns as item
    where item.interview_id = target_interview_id
      and (
        select pg_catalog.count(*) <>
          pg_catalog.count(distinct citation.citation_id)
        from pg_catalog.jsonb_array_elements_text(
          item.canonical_payload -> 'partialCitationIds'
        ) as citation(citation_id)
      )
    union all
    select 1
    from gitblocks.repository_interview_contradictions as item,
      lateral pg_catalog.jsonb_array_elements(
        item.canonical_payload -> 'positions'
      ) as position(position_payload)
    where item.interview_id = target_interview_id
      and (
        pg_catalog.jsonb_array_length(
          item.canonical_payload -> 'positions'
        ) <> 2
        or (
          select pg_catalog.count(*) <>
            pg_catalog.count(distinct citation.citation_id)
          from pg_catalog.jsonb_array_elements_text(
            position.position_payload -> 'citationIds'
          ) as citation(citation_id)
        )
        or pg_catalog.jsonb_array_length(
          position.position_payload -> 'citationIds'
        )
          not between 1 and 2
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'repository interview citation multiplicity rejected';
  end if;
end
$gitblocks_repository_interview_closure$;

create function gitblocks.validate_repository_interview_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $gitblocks_repository_interview_trigger$
begin
  perform gitblocks.assert_repository_interview_closure(
    coalesce(new.interview_id, old.interview_id)
  );
  return null;
end
$gitblocks_repository_interview_trigger$;

create function gitblocks.validate_model_execution_interview_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $gitblocks_model_execution_trigger$
declare
  interview_total integer;
begin
  select pg_catalog.count(*)::integer
  into interview_total
  from gitblocks.repository_interviews
  where execution_id = new.execution_id;

  if (
    new.outcome_status = 'succeeded'
    and interview_total <> 1
  ) or (
    new.outcome_status = 'failed'
    and interview_total <> 0
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'model execution interview closure rejected';
  end if;
  return null;
end
$gitblocks_model_execution_trigger$;

create constraint trigger model_executions_interview_closed
after insert on gitblocks.model_executions
deferrable initially deferred
for each row
execute function gitblocks.validate_model_execution_interview_closure();

create constraint trigger repository_interviews_closed
after insert on gitblocks.repository_interviews
deferrable initially deferred
for each row execute function gitblocks.validate_repository_interview_closure();

create constraint trigger repository_interview_citations_closed
after insert or delete on gitblocks.repository_interview_citations
deferrable initially deferred
for each row execute function gitblocks.validate_repository_interview_closure();

create constraint trigger repository_interview_claims_closed
after insert or delete on gitblocks.repository_interview_claims
deferrable initially deferred
for each row execute function gitblocks.validate_repository_interview_closure();

create constraint trigger repository_interview_limitations_closed
after insert or delete on gitblocks.repository_interview_limitations
deferrable initially deferred
for each row execute function gitblocks.validate_repository_interview_closure();

create constraint trigger repository_interview_contradictions_closed
after insert or delete on gitblocks.repository_interview_contradictions
deferrable initially deferred
for each row execute function gitblocks.validate_repository_interview_closure();

create constraint trigger repository_interview_unknowns_closed
after insert or delete on gitblocks.repository_interview_unknowns
deferrable initially deferred
for each row execute function gitblocks.validate_repository_interview_closure();

create trigger repository_interview_requests_immutable
before update or delete on gitblocks.repository_interview_requests
for each row execute function gitblocks.reject_immutable_update();

create trigger model_executions_immutable
before update or delete on gitblocks.model_executions
for each row execute function gitblocks.reject_immutable_update();

create trigger repository_interviews_immutable
before update or delete on gitblocks.repository_interviews
for each row execute function gitblocks.reject_immutable_update();

create trigger repository_interview_citations_immutable
before update or delete on gitblocks.repository_interview_citations
for each row execute function gitblocks.reject_immutable_update();

create trigger repository_interview_claims_immutable
before update or delete on gitblocks.repository_interview_claims
for each row execute function gitblocks.reject_immutable_update();

create trigger repository_interview_limitations_immutable
before update or delete on gitblocks.repository_interview_limitations
for each row execute function gitblocks.reject_immutable_update();

create trigger repository_interview_contradictions_immutable
before update or delete on gitblocks.repository_interview_contradictions
for each row execute function gitblocks.reject_immutable_update();

create trigger repository_interview_unknowns_immutable
before update or delete on gitblocks.repository_interview_unknowns
for each row execute function gitblocks.reject_immutable_update();

create trigger repository_interview_requests_no_truncate
before truncate on gitblocks.repository_interview_requests
execute function gitblocks.reject_immutable_update();

create trigger model_executions_no_truncate
before truncate on gitblocks.model_executions
execute function gitblocks.reject_immutable_update();

create trigger repository_interviews_no_truncate
before truncate on gitblocks.repository_interviews
execute function gitblocks.reject_immutable_update();

create trigger repository_interview_citations_no_truncate
before truncate on gitblocks.repository_interview_citations
execute function gitblocks.reject_immutable_update();

create trigger repository_interview_claims_no_truncate
before truncate on gitblocks.repository_interview_claims
execute function gitblocks.reject_immutable_update();

create trigger repository_interview_limitations_no_truncate
before truncate on gitblocks.repository_interview_limitations
execute function gitblocks.reject_immutable_update();

create trigger repository_interview_contradictions_no_truncate
before truncate on gitblocks.repository_interview_contradictions
execute function gitblocks.reject_immutable_update();

create trigger repository_interview_unknowns_no_truncate
before truncate on gitblocks.repository_interview_unknowns
execute function gitblocks.reject_immutable_update();

revoke all on table
  gitblocks.repository_interview_requests,
  gitblocks.model_executions,
  gitblocks.repository_interviews,
  gitblocks.repository_interview_citations,
  gitblocks.repository_interview_claims,
  gitblocks.repository_interview_limitations,
  gitblocks.repository_interview_contradictions,
  gitblocks.repository_interview_unknowns
from public;

revoke all on function
  gitblocks.assert_repository_interview_closure(text),
  gitblocks.validate_repository_interview_closure(),
  gitblocks.validate_model_execution_interview_closure()
from public;

grant select, insert on table
  gitblocks.repository_interview_requests,
  gitblocks.model_executions,
  gitblocks.repository_interviews,
  gitblocks.repository_interview_citations,
  gitblocks.repository_interview_claims,
  gitblocks.repository_interview_limitations,
  gitblocks.repository_interview_contradictions,
  gitblocks.repository_interview_unknowns
to gitblocks_persistence;
