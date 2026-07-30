create table gitblocks.repository_artifacts (
  artifact_id text primary key,
  candidate_id text not null,
  contract_version text not null,
  provider text not null,
  provider_repository_id text not null,
  git_object_algorithm text not null,
  commit_object_id text not null,
  path text not null,
  blob_object_id text not null,
  blob_api_url text not null,
  display_url text,
  media_type text not null,
  encoding text not null,
  content_sha256 text not null,
  byte_count integer not null,
  line_count integer not null,
  exact_content text not null,
  catalog_owner text not null,
  catalog_repository text not null,
  provider_owner text not null,
  provider_repository text not null,
  collected_at timestamptz not null,
  identity_digest text not null,
  record_digest text not null,
  constraint repository_artifacts_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint repository_artifacts_candidate_identity
    unique (artifact_id, candidate_id),
  constraint repository_artifacts_id
    check (artifact_id ~ '^artifact-[0-9a-f]{48}$'),
  constraint repository_artifacts_contract
    check (contract_version = '1.0.0'),
  constraint repository_artifacts_provider
    check (provider = 'github'),
  constraint repository_artifacts_repository_id
    check (
      pg_catalog.octet_length(provider_repository_id) between 1 and 20
      and provider_repository_id ~ '^(?:0|[1-9][0-9]{0,19})$'
    ),
  constraint repository_artifacts_git_identity
    check (
      git_object_algorithm = 'sha1'
      and commit_object_id ~ '^[0-9a-f]{40}$'
      and blob_object_id ~ '^[0-9a-f]{40}$'
    ),
  constraint repository_artifacts_path
    check (
      pg_catalog.octet_length(path) between 1 and 512
      and path !~ '[[:cntrl:]]'
      and path !~ '[\\%?#]'
      and path !~ '(^|/)\.{1,2}(/|$)'
      and path !~ '(^/|/$|//)'
      and pg_catalog.array_length(
        pg_catalog.string_to_array(path, '/'),
        1
      ) between 1 and 8
    ),
  constraint repository_artifacts_blob_api
    check (
      blob_api_url =
        'https://api.github.com/repositories/' ||
        provider_repository_id ||
        '/git/blobs/' ||
        blob_object_id
    ),
  constraint repository_artifacts_urls
    check (
      pg_catalog.octet_length(blob_api_url) between 1 and 2048
      and (
        display_url is null
        or pg_catalog.octet_length(display_url) between 1 and 2048
      )
    ),
  constraint repository_artifacts_media
    check (media_type = 'text/plain' and encoding = 'utf-8'),
  constraint repository_artifacts_content
    check (
      byte_count between 0 and 262144
      and pg_catalog.octet_length(exact_content) = byte_count
      and line_count between 1 and 10000
      and content_sha256 ~ '^[0-9a-f]{64}$'
    ),
  constraint repository_artifacts_provenance
    check (
      pg_catalog.octet_length(catalog_owner) between 1 and 100
      and pg_catalog.octet_length(catalog_repository) between 1 and 100
      and pg_catalog.octet_length(provider_owner) between 1 and 100
      and pg_catalog.octet_length(provider_repository) between 1 and 100
      and collected_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
    ),
  constraint repository_artifacts_digests
    check (
      identity_digest ~ '^[0-9a-f]{64}$'
      and record_digest ~ '^[0-9a-f]{64}$'
    )
);

create index repository_artifacts_context
  on gitblocks.repository_artifacts (
    candidate_id,
    provider_repository_id,
    git_object_algorithm,
    commit_object_id,
    artifact_id
  );

create table gitblocks.repository_artifact_chunks (
  chunk_id text primary key,
  artifact_id text not null,
  candidate_id text not null,
  contract_version text not null,
  chunker_version text not null,
  ordinal integer not null,
  start_byte integer not null,
  end_byte_exclusive integer not null,
  byte_count integer not null,
  start_line integer not null,
  end_line integer not null,
  content_sha256 text not null,
  exact_content text not null,
  identity_digest text not null,
  record_digest text not null,
  constraint repository_artifact_chunks_artifact
    foreign key (artifact_id, candidate_id)
    references gitblocks.repository_artifacts (
      artifact_id,
      candidate_id
    ),
  constraint repository_artifact_chunks_identity
    unique (artifact_id, chunker_version, ordinal),
  constraint repository_artifact_chunks_id
    check (chunk_id ~ '^chunk-[0-9a-f]{48}$'),
  constraint repository_artifact_chunks_contract
    check (
      contract_version = '1.0.0'
      and chunker_version = 'exact-lines-v1'
    ),
  constraint repository_artifact_chunks_intervals
    check (
      ordinal between 0 and 63
      and start_byte between 0 and 262144
      and end_byte_exclusive between 0 and 262144
      and end_byte_exclusive - start_byte = byte_count
      and byte_count between 0 and 16384
      and pg_catalog.octet_length(exact_content) = byte_count
      and start_line between 1 and 10000
      and end_line between start_line and 10000
    ),
  constraint repository_artifact_chunks_digests
    check (
      content_sha256 ~ '^[0-9a-f]{64}$'
      and identity_digest ~ '^[0-9a-f]{64}$'
      and record_digest ~ '^[0-9a-f]{64}$'
    )
);

create index repository_artifact_chunks_reconstruction
  on gitblocks.repository_artifact_chunks (
    artifact_id,
    chunker_version,
    ordinal
  );

create table gitblocks.repository_artifact_sets (
  artifact_set_id text primary key,
  candidate_id text not null,
  contract_version text not null,
  catalog_version text not null,
  catalog_digest text not null,
  artifact_manifest_version text not null,
  artifact_manifest_digest text not null,
  collector_version text not null,
  chunker_version text not null,
  provider text not null,
  provider_repository_id text not null,
  provider_canonical_owner text not null,
  provider_canonical_repository text not null,
  git_object_algorithm text not null,
  commit_object_id text not null,
  entry_count integer not null,
  published_at timestamptz not null,
  identity_digest text not null,
  record_digest text not null,
  constraint repository_artifact_sets_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint repository_artifact_sets_candidate_identity
    unique (artifact_set_id, candidate_id),
  constraint repository_artifact_sets_id
    check (artifact_set_id ~ '^artifact-set-[0-9a-f]{48}$'),
  constraint repository_artifact_sets_versions
    check (
      contract_version = '1.0.0'
      and catalog_version = 'public-v1'
      and artifact_manifest_version = 'public-artifacts-v1'
      and collector_version = 'repository-artifacts-v1'
      and chunker_version = 'exact-lines-v1'
    ),
  constraint repository_artifact_sets_provider
    check (
      provider = 'github'
      and pg_catalog.octet_length(provider_repository_id) between 1 and 20
      and provider_repository_id ~ '^(?:0|[1-9][0-9]{0,19})$'
      and git_object_algorithm = 'sha1'
      and commit_object_id ~ '^[0-9a-f]{40}$'
      and pg_catalog.octet_length(provider_canonical_owner)
        between 1 and 100
      and pg_catalog.octet_length(provider_canonical_repository)
        between 1 and 100
    ),
  constraint repository_artifact_sets_counts
    check (entry_count between 1 and 4),
  constraint repository_artifact_sets_digests
    check (
      catalog_digest ~ '^[0-9a-f]{64}$'
      and artifact_manifest_digest ~ '^[0-9a-f]{64}$'
      and identity_digest ~ '^[0-9a-f]{64}$'
      and record_digest ~ '^[0-9a-f]{64}$'
    ),
  constraint repository_artifact_sets_published
    check (
      published_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
    )
);

create index repository_artifact_sets_history
  on gitblocks.repository_artifact_sets (
    candidate_id,
    provider_repository_id,
    commit_object_id,
    published_at,
    artifact_set_id
  );

create table gitblocks.repository_artifact_set_entries (
  artifact_set_id text not null,
  candidate_id text not null,
  selection_id text not null,
  ordinal integer not null,
  selector text not null,
  artifact_kind text not null,
  requirement text not null,
  rationale text,
  requested_path text,
  resolved_path text,
  outcome text not null,
  artifact_id text,
  primary key (artifact_set_id, ordinal),
  constraint repository_artifact_set_entries_selection
    unique (artifact_set_id, selection_id),
  constraint repository_artifact_set_entries_set
    foreign key (artifact_set_id, candidate_id)
    references gitblocks.repository_artifact_sets (
      artifact_set_id,
      candidate_id
    ),
  constraint repository_artifact_set_entries_artifact
    foreign key (artifact_id, candidate_id)
    references gitblocks.repository_artifacts (
      artifact_id,
      candidate_id
    ),
  constraint repository_artifact_set_entries_id
    check (selection_id ~ '^selection-[0-9a-f]{48}$'),
  constraint repository_artifact_set_entries_ordinal
    check (ordinal between 0 and 3),
  constraint repository_artifact_set_entries_semantics
    check (
      selector in ('root-readme', 'path')
      and artifact_kind in (
        'readme',
        'contributing',
        'security-policy',
        'changelog',
        'documentation',
        'license'
      )
      and requirement in ('required', 'optional')
      and (
        (
          selector = 'root-readme'
          and artifact_kind = 'readme'
          and requirement = 'optional'
          and rationale is null
          and requested_path is null
        )
        or (
          selector = 'path'
          and rationale is not null
          and pg_catalog.octet_length(rationale) between 1 and 500
          and requested_path is not null
          and pg_catalog.octet_length(requested_path) between 1 and 512
        )
      )
      and (
        (
          outcome = 'present'
          and resolved_path is not null
          and artifact_id is not null
        )
        or (
          outcome = 'not-found'
          and requirement = 'optional'
          and resolved_path is null
          and artifact_id is null
        )
      )
    ),
  constraint repository_artifact_set_entries_paths
    check (
      (
        requested_path is null
        or (
          pg_catalog.octet_length(requested_path) between 1 and 512
          and requested_path !~ '[[:cntrl:]]'
          and requested_path !~ '[\\%?#]'
          and requested_path !~ '(^|/)\.{1,2}(/|$)'
          and requested_path !~ '(^/|/$|//)'
        )
      )
      and (
        resolved_path is null
        or (
          pg_catalog.octet_length(resolved_path) between 1 and 512
          and resolved_path !~ '[[:cntrl:]]'
          and resolved_path !~ '[\\%?#]'
          and resolved_path !~ '(^|/)\.{1,2}(/|$)'
          and resolved_path !~ '(^/|/$|//)'
        )
      )
    )
);

create unique index repository_artifact_set_entries_resolved_path
  on gitblocks.repository_artifact_set_entries (
    artifact_set_id,
    resolved_path
  )
  where resolved_path is not null;

create function gitblocks.validate_repository_artifact_set_closure()
returns trigger
language plpgsql
set search_path = ''
as $gitblocks_artifact_closure$
declare
  target_set_id text;
  target_set gitblocks.repository_artifact_sets%rowtype;
begin
  if tg_table_name = 'repository_artifact_sets' then
    target_set_id := new.artifact_set_id;
  else
    target_set_id := new.artifact_set_id;
  end if;

  select *
  into target_set
  from gitblocks.repository_artifact_sets
  where artifact_set_id = target_set_id;

  if not found then
    return null;
  end if;

  if (
    select pg_catalog.count(*) <> target_set.entry_count
      or pg_catalog.min(entry.ordinal) <> 0
      or pg_catalog.max(entry.ordinal) <> target_set.entry_count - 1
    from gitblocks.repository_artifact_set_entries as entry
    where entry.artifact_set_id = target_set_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'artifact set closure rejected';
  end if;

  if exists (
    select 1
    from gitblocks.repository_artifact_set_entries as entry
    join gitblocks.repository_artifacts as artifact
      on artifact.artifact_id = entry.artifact_id
    where entry.artifact_set_id = target_set_id
      and (
        artifact.candidate_id <> target_set.candidate_id
        or artifact.provider <> target_set.provider
        or artifact.provider_repository_id <>
          target_set.provider_repository_id
        or artifact.git_object_algorithm <>
          target_set.git_object_algorithm
        or artifact.commit_object_id <> target_set.commit_object_id
        or entry.resolved_path <> artifact.path
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'artifact set context rejected';
  end if;

  if exists (
    select 1
    from gitblocks.repository_artifact_set_entries as entry
    join gitblocks.repository_artifacts as artifact
      on artifact.artifact_id = entry.artifact_id
    left join gitblocks.repository_artifact_chunks as chunk
      on chunk.artifact_id = artifact.artifact_id
      and chunk.chunker_version = target_set.chunker_version
    where entry.artifact_set_id = target_set_id
      and entry.outcome = 'present'
    group by
      artifact.artifact_id,
      artifact.byte_count,
      artifact.exact_content
    having
      pg_catalog.count(chunk.chunk_id) = 0
      or pg_catalog.min(chunk.ordinal) <> 0
      or pg_catalog.max(chunk.ordinal) + 1 <>
        pg_catalog.count(chunk.chunk_id)
      or pg_catalog.min(chunk.start_byte) <> 0
      or pg_catalog.max(chunk.end_byte_exclusive) <>
        artifact.byte_count
      or pg_catalog.sum(chunk.byte_count) <> artifact.byte_count
      or pg_catalog.string_agg(
        chunk.exact_content,
        '' order by chunk.ordinal
      ) <> artifact.exact_content
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'artifact chunk closure rejected';
  end if;

  if exists (
    select 1
    from gitblocks.repository_artifact_set_entries as entry
    join gitblocks.repository_artifact_chunks as chunk
      on chunk.artifact_id = entry.artifact_id
      and chunk.chunker_version = target_set.chunker_version
    left join gitblocks.repository_artifact_chunks as prior
      on prior.artifact_id = chunk.artifact_id
      and prior.chunker_version = chunk.chunker_version
      and prior.ordinal = chunk.ordinal - 1
    where entry.artifact_set_id = target_set_id
      and chunk.ordinal > 0
      and (
        prior.chunk_id is null
        or prior.end_byte_exclusive <> chunk.start_byte
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'artifact chunk interval rejected';
  end if;

  return null;
end
$gitblocks_artifact_closure$;

create constraint trigger repository_artifact_sets_closed
after insert on gitblocks.repository_artifact_sets
deferrable initially deferred
for each row
execute function gitblocks.validate_repository_artifact_set_closure();

create constraint trigger repository_artifact_set_entries_closed
after insert on gitblocks.repository_artifact_set_entries
deferrable initially deferred
for each row
execute function gitblocks.validate_repository_artifact_set_closure();

create trigger repository_artifacts_immutable
before update or delete on gitblocks.repository_artifacts
for each row execute function gitblocks.reject_immutable_update();

create trigger repository_artifact_chunks_immutable
before update or delete on gitblocks.repository_artifact_chunks
for each row execute function gitblocks.reject_immutable_update();

create trigger repository_artifact_sets_immutable
before update or delete on gitblocks.repository_artifact_sets
for each row execute function gitblocks.reject_immutable_update();

create trigger repository_artifact_set_entries_immutable
before update or delete on gitblocks.repository_artifact_set_entries
for each row execute function gitblocks.reject_immutable_update();

create trigger repository_artifacts_no_truncate
before truncate on gitblocks.repository_artifacts
execute function gitblocks.reject_immutable_update();

create trigger repository_artifact_chunks_no_truncate
before truncate on gitblocks.repository_artifact_chunks
execute function gitblocks.reject_immutable_update();

create trigger repository_artifact_sets_no_truncate
before truncate on gitblocks.repository_artifact_sets
execute function gitblocks.reject_immutable_update();

create trigger repository_artifact_set_entries_no_truncate
before truncate on gitblocks.repository_artifact_set_entries
execute function gitblocks.reject_immutable_update();

revoke all on table
  gitblocks.repository_artifacts,
  gitblocks.repository_artifact_chunks,
  gitblocks.repository_artifact_sets,
  gitblocks.repository_artifact_set_entries
from public;

grant select, insert on table
  gitblocks.repository_artifacts,
  gitblocks.repository_artifact_chunks,
  gitblocks.repository_artifact_sets,
  gitblocks.repository_artifact_set_entries
to gitblocks_persistence;
