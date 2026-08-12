do $gitblocks_serving_role$
begin
  if exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'gitblocks_serving'
  ) then
    if exists (
      select 1
      from pg_catalog.pg_roles
      where rolname = 'gitblocks_serving'
        and (
          rolsuper
          or rolbypassrls
          or rolcanlogin
          or rolcreatedb
          or rolcreaterole
          or rolreplication
        )
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'serving role attributes rejected';
    end if;
  else
    create role gitblocks_serving
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      inherit
      noreplication
      nobypassrls;
  end if;
end
$gitblocks_serving_role$;

create table gitblocks.serving_catalog_snapshots (
  snapshot_id text primary key,
  snapshot_format_version text not null,
  catalog_version text not null,
  catalog_digest text not null,
  candidate_count integer not null,
  profile_authority_header jsonb not null,
  profile_authority_semantic_digest text not null,
  metadata_authority_header jsonb not null,
  metadata_authority_semantic_digest text not null,
  published_at timestamptz not null,
  record_digest text not null,
  constraint serving_catalog_snapshots_snapshot_id
    check (
      pg_catalog.octet_length(snapshot_id) between 1 and 64
      and snapshot_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint serving_catalog_snapshots_format
    check (
      snapshot_format_version = 'serving-catalog-snapshot/1.0.0'
    ),
  constraint serving_catalog_snapshots_catalog_version
    check (pg_catalog.octet_length(catalog_version) between 1 and 64),
  constraint serving_catalog_snapshots_catalog_digest
    check (catalog_digest ~ '^[0-9a-f]{64}$'),
  constraint serving_catalog_snapshots_candidate_count
    check (candidate_count = 150),
  constraint serving_catalog_snapshots_profile_header
    check (
      pg_catalog.jsonb_typeof(profile_authority_header) = 'object'
      and not profile_authority_header ? 'profiles'
      and profile_authority_header ->> 'catalogVersion' = catalog_version
      and profile_authority_header ->> 'catalogDigest' = catalog_digest
      and profile_authority_header ->> 'semanticAuthorityDigest' =
        profile_authority_semantic_digest
    ),
  constraint serving_catalog_snapshots_profile_digest
    check (profile_authority_semantic_digest ~ '^[0-9a-f]{64}$'),
  constraint serving_catalog_snapshots_metadata_header
    check (
      pg_catalog.jsonb_typeof(metadata_authority_header) = 'object'
      and not metadata_authority_header ? 'candidates'
      and metadata_authority_header ->> 'catalogVersion' = catalog_version
      and metadata_authority_header ->> 'catalogDigest' = catalog_digest
      and metadata_authority_header ->> 'authoritySemanticDigest' =
        metadata_authority_semantic_digest
    ),
  constraint serving_catalog_snapshots_metadata_digest
    check (metadata_authority_semantic_digest ~ '^[0-9a-f]{64}$'),
  constraint serving_catalog_snapshots_published_at
    check (
      published_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
    ),
  constraint serving_catalog_snapshots_record_digest
    check (record_digest ~ '^[0-9a-f]{64}$')
);

create table gitblocks.serving_candidate_profile_records (
  snapshot_id text not null,
  candidate_id text not null,
  profile_payload jsonb not null,
  record_digest text not null,
  primary key (snapshot_id, candidate_id),
  constraint serving_candidate_profile_records_snapshot
    foreign key (snapshot_id)
    references gitblocks.serving_catalog_snapshots (snapshot_id),
  constraint serving_candidate_profile_records_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint serving_candidate_profile_records_candidate_id
    check (
      pg_catalog.octet_length(candidate_id) between 1 and 64
      and candidate_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint serving_candidate_profile_records_payload
    check (
      pg_catalog.jsonb_typeof(profile_payload) = 'object'
      and profile_payload ->> 'candidateId' = candidate_id
      and profile_payload ->> 'semanticProfileDigest' = record_digest
    ),
  constraint serving_candidate_profile_records_digest
    check (record_digest ~ '^[0-9a-f]{64}$')
);

create table gitblocks.serving_candidate_retrieval_metadata_records (
  snapshot_id text not null,
  candidate_id text not null,
  metadata_payload jsonb not null,
  record_digest text not null,
  primary key (snapshot_id, candidate_id),
  constraint serving_candidate_retrieval_metadata_records_snapshot
    foreign key (snapshot_id)
    references gitblocks.serving_catalog_snapshots (snapshot_id),
  constraint serving_candidate_retrieval_metadata_records_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint serving_candidate_retrieval_metadata_records_candidate_id
    check (
      pg_catalog.octet_length(candidate_id) between 1 and 64
      and candidate_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint serving_candidate_retrieval_metadata_records_payload
    check (
      pg_catalog.jsonb_typeof(metadata_payload) = 'object'
      and metadata_payload ->> 'candidateId' = candidate_id
      and metadata_payload ->> 'sourceRecordDigest' = record_digest
    ),
  constraint serving_candidate_retrieval_metadata_records_digest
    check (record_digest ~ '^[0-9a-f]{64}$')
);

create table gitblocks.serving_catalog_current_snapshot (
  selector boolean primary key default true,
  snapshot_id text not null,
  selected_at timestamptz not null,
  constraint serving_catalog_current_snapshot_singleton
    check (selector),
  constraint serving_catalog_current_snapshot_snapshot
    foreign key (snapshot_id)
    references gitblocks.serving_catalog_snapshots (snapshot_id),
  constraint serving_catalog_current_snapshot_selected_at
    check (
      selected_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
    )
);

create function gitblocks.assert_serving_catalog_snapshot_closure(
  target_snapshot_id text
)
returns void
language plpgsql
set search_path = ''
as $gitblocks_serving_catalog_closure$
declare
  expected_candidate_count integer;
  profile_count integer;
  metadata_count integer;
begin
  select candidate_count
  into expected_candidate_count
  from gitblocks.serving_catalog_snapshots
  where snapshot_id = target_snapshot_id;

  if expected_candidate_count is null then
    raise exception using
      errcode = 'P0002',
      message = 'serving catalog snapshot not found';
  end if;

  select pg_catalog.count(*)::integer
  into profile_count
  from gitblocks.serving_candidate_profile_records
  where snapshot_id = target_snapshot_id;

  select pg_catalog.count(*)::integer
  into metadata_count
  from gitblocks.serving_candidate_retrieval_metadata_records
  where snapshot_id = target_snapshot_id;

  if
    profile_count <> expected_candidate_count
    or metadata_count <> expected_candidate_count
    or exists (
      select 1
      from gitblocks.serving_candidate_profile_records as profile
      full join
        gitblocks.serving_candidate_retrieval_metadata_records as metadata
        on metadata.snapshot_id = profile.snapshot_id
        and metadata.candidate_id = profile.candidate_id
      where
        coalesce(profile.snapshot_id, metadata.snapshot_id) = target_snapshot_id
        and (
          profile.candidate_id is null
          or metadata.candidate_id is null
        )
    )
    or exists (
      select 1
      from gitblocks.serving_candidate_profile_records as profile
      join gitblocks.serving_candidate_retrieval_metadata_records as metadata
        on metadata.snapshot_id = profile.snapshot_id
        and metadata.candidate_id = profile.candidate_id
      join gitblocks.catalog_candidates as candidate
        on candidate.candidate_id = profile.candidate_id
      where profile.snapshot_id = target_snapshot_id
        and (
          pg_catalog.lower(metadata.metadata_payload ->> 'catalogOwner')
            is distinct from pg_catalog.lower(candidate.repository_owner)
          or pg_catalog.lower(
            metadata.metadata_payload ->> 'catalogRepository'
          ) is distinct from pg_catalog.lower(candidate.repository_name)
          or pg_catalog.lower(
            (
              pg_catalog.jsonb_path_query_first(
                profile.profile_payload,
                '$.fields[*] ? (@.fieldId == "repository-identity").value'
              )
            ) ->> 'githubOwner'
          ) is distinct from pg_catalog.lower(candidate.repository_owner)
          or pg_catalog.lower(
            (
              pg_catalog.jsonb_path_query_first(
                profile.profile_payload,
                '$.fields[*] ? (@.fieldId == "repository-identity").value'
              )
            ) ->> 'githubRepository'
          ) is distinct from pg_catalog.lower(candidate.repository_name)
        )
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'serving catalog snapshot closure rejected';
  end if;
end
$gitblocks_serving_catalog_closure$;

create function gitblocks.validate_serving_catalog_snapshot_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $gitblocks_serving_catalog_trigger$
begin
  perform gitblocks.assert_serving_catalog_snapshot_closure(new.snapshot_id);
  return new;
end
$gitblocks_serving_catalog_trigger$;

create constraint trigger serving_catalog_snapshots_closed
after insert on gitblocks.serving_catalog_snapshots
deferrable initially deferred
for each row
execute function gitblocks.validate_serving_catalog_snapshot_closure();

create trigger serving_catalog_current_snapshot_closed
before insert or update on gitblocks.serving_catalog_current_snapshot
for each row
execute function gitblocks.validate_serving_catalog_snapshot_closure();

create trigger serving_catalog_snapshots_immutable
before update or delete on gitblocks.serving_catalog_snapshots
for each row execute function gitblocks.reject_immutable_update();

create trigger serving_candidate_profile_records_immutable
before update or delete on gitblocks.serving_candidate_profile_records
for each row execute function gitblocks.reject_immutable_update();

create trigger serving_candidate_retrieval_metadata_records_immutable
before update or delete
on gitblocks.serving_candidate_retrieval_metadata_records
for each row execute function gitblocks.reject_immutable_update();

create trigger serving_catalog_snapshots_no_truncate
before truncate on gitblocks.serving_catalog_snapshots
execute function gitblocks.reject_immutable_update();

create trigger serving_candidate_profile_records_no_truncate
before truncate on gitblocks.serving_candidate_profile_records
execute function gitblocks.reject_immutable_update();

create trigger serving_candidate_retrieval_metadata_records_no_truncate
before truncate on gitblocks.serving_candidate_retrieval_metadata_records
execute function gitblocks.reject_immutable_update();

revoke all on table
  gitblocks.serving_catalog_snapshots,
  gitblocks.serving_candidate_profile_records,
  gitblocks.serving_candidate_retrieval_metadata_records,
  gitblocks.serving_catalog_current_snapshot
from public;

revoke all on function
  gitblocks.assert_serving_catalog_snapshot_closure(text),
  gitblocks.validate_serving_catalog_snapshot_closure()
from public;

revoke all on schema gitblocks from gitblocks_serving;
grant usage on schema gitblocks to gitblocks_serving;

grant select on table
  gitblocks.serving_catalog_snapshots,
  gitblocks.serving_candidate_profile_records,
  gitblocks.serving_candidate_retrieval_metadata_records,
  gitblocks.serving_catalog_current_snapshot
to gitblocks_serving;

grant select, insert on table
  gitblocks.serving_catalog_snapshots,
  gitblocks.serving_candidate_profile_records,
  gitblocks.serving_candidate_retrieval_metadata_records
to gitblocks_persistence;

grant select, insert, update on table
  gitblocks.serving_catalog_current_snapshot
to gitblocks_persistence;
