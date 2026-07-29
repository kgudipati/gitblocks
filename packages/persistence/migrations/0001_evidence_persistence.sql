do $gitblocks_role$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'gitblocks_persistence'
  ) then
    create role gitblocks_persistence
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls;
  end if;
end
$gitblocks_role$;

create table gitblocks.catalog_candidates (
  candidate_id text primary key,
  display_name text not null,
  repository_owner text not null,
  repository_name text not null,
  package_name text,
  canonical_payload jsonb not null,
  record_digest text not null,
  created_at timestamptz not null,
  constraint catalog_candidates_candidate_id
    check (
      pg_catalog.octet_length(candidate_id) between 1 and 64
      and candidate_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint catalog_candidates_display_name
    check (pg_catalog.octet_length(display_name) between 1 and 120),
  constraint catalog_candidates_repository_owner
    check (pg_catalog.octet_length(repository_owner) between 1 and 100),
  constraint catalog_candidates_repository_name
    check (pg_catalog.octet_length(repository_name) between 1 and 100),
  constraint catalog_candidates_package_name
    check (
      package_name is null
      or pg_catalog.octet_length(package_name) between 1 and 214
    ),
  constraint catalog_candidates_payload
    check (
      canonical_payload ->> 'candidateId' = candidate_id
      and canonical_payload ->> 'displayName' = display_name
      and canonical_payload #>> '{repository,host}' = 'github'
      and canonical_payload #>> '{repository,owner}' = repository_owner
      and canonical_payload #>> '{repository,name}' = repository_name
      and (
        (
          package_name is null
          and canonical_payload -> 'package' = 'null'::jsonb
        )
        or (
          package_name is not null
          and canonical_payload #>> '{package,registry}' = 'npm'
          and canonical_payload #>> '{package,name}' = package_name
        )
      )
    ),
  constraint catalog_candidates_record_digest
    check (record_digest ~ '^[0-9a-f]{64}$'),
  constraint catalog_candidates_created_at
    check (
      created_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
    ),
  constraint catalog_candidates_payload_object
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object')
);

create unique index catalog_candidates_repository_identity
  on gitblocks.catalog_candidates (
    pg_catalog.lower(repository_owner),
    pg_catalog.lower(repository_name)
  );

create unique index catalog_candidates_package_identity
  on gitblocks.catalog_candidates (pg_catalog.lower(package_name))
  where package_name is not null;

create table gitblocks.candidate_capability_families (
  candidate_id text not null,
  capability_family text not null,
  primary key (candidate_id, capability_family),
  constraint candidate_capability_families_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint candidate_capability_families_family
    check (
      capability_family in (
        'authorization',
        'audit-logging',
        'background-jobs',
        'rate-limiting',
        'webhooks'
      )
    )
);

create table gitblocks.evidence_observations (
  evidence_id text primary key,
  candidate_id text not null,
  topic text not null,
  dimension text not null,
  provenance_kind text not null,
  published_at timestamptz,
  collected_at timestamptz,
  validated_at timestamptz,
  freshness_as_of timestamptz not null,
  canonical_payload jsonb not null,
  record_digest text not null,
  created_at timestamptz not null,
  constraint evidence_observations_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint evidence_observations_identity
    unique (candidate_id, evidence_id),
  constraint evidence_observations_evidence_id
    check (
      pg_catalog.octet_length(evidence_id) between 1 and 64
      and evidence_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint evidence_observations_topic
    check (
      pg_catalog.octet_length(topic) between 1 and 64
      and topic ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint evidence_observations_dimension
    check (
      dimension in (
        'identity',
        'repository-package',
        'version-release',
        'license',
        'runtime-framework',
        'deployment',
        'data-store',
        'maintenance',
        'security',
        'integration'
      )
    ),
  constraint evidence_observations_provenance
    check (
      provenance_kind in (
        'git-commit',
        'tag',
        'release',
        'package-version',
        'security-advisory',
        'mutable-documentation',
        'approved-validation'
      )
    ),
  constraint evidence_observations_payload
    check (
      canonical_payload ->> 'kind' = 'evidence'
      and canonical_payload ->> 'evidenceId' = evidence_id
      and canonical_payload ->> 'candidateId' = candidate_id
      and canonical_payload ->> 'topic' = topic
      and canonical_payload ->> 'dimension' = dimension
      and canonical_payload #>> '{source,kind}' = provenance_kind
      and (
        canonical_payload #>> '{freshness,asOf}'
      )::timestamptz = freshness_as_of
    ),
  constraint evidence_observations_timestamp_shape
    check (
      (
        provenance_kind in (
          'git-commit',
          'tag',
          'release',
          'package-version',
          'security-advisory'
        )
        and published_at is not null
        and collected_at is not null
        and validated_at is null
        and (
          canonical_payload #>> '{source,publishedAt}'
        )::timestamptz = published_at
        and (
          canonical_payload #>> '{source,collectedAt}'
        )::timestamptz = collected_at
        and published_at <= collected_at
        and collected_at <= freshness_as_of
      )
      or (
        provenance_kind = 'mutable-documentation'
        and published_at is null
        and collected_at is not null
        and validated_at is null
        and (
          canonical_payload #>> '{source,collectedAt}'
        )::timestamptz = collected_at
        and collected_at <= freshness_as_of
      )
      or (
        provenance_kind = 'approved-validation'
        and published_at is null
        and collected_at is null
        and validated_at is not null
        and (
          canonical_payload #>> '{source,validatedAt}'
        )::timestamptz = validated_at
        and validated_at <= freshness_as_of
      )
    ),
  constraint evidence_observations_record_digest
    check (record_digest ~ '^[0-9a-f]{64}$'),
  constraint evidence_observations_timestamps
    check (
      freshness_as_of not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
      and created_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
      and (
        published_at is null
        or published_at not in (
          'infinity'::timestamptz,
          '-infinity'::timestamptz
        )
      )
      and (
        collected_at is null
        or collected_at not in (
          'infinity'::timestamptz,
          '-infinity'::timestamptz
        )
      )
      and (
        validated_at is null
        or validated_at not in (
          'infinity'::timestamptz,
          '-infinity'::timestamptz
        )
      )
    )
);

create index evidence_observations_active_world
  on gitblocks.evidence_observations (
    candidate_id,
    freshness_as_of,
    evidence_id
  );

create table gitblocks.candidate_limitations (
  limitation_id text primary key,
  candidate_id text not null,
  limitation_code text not null,
  canonical_payload jsonb not null,
  record_digest text not null,
  created_at timestamptz not null,
  constraint candidate_limitations_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint candidate_limitations_identity
    unique (candidate_id, limitation_id),
  constraint candidate_limitations_limitation_id
    check (
      pg_catalog.octet_length(limitation_id) between 1 and 64
      and limitation_id ~
        '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint candidate_limitations_limitation_code
    check (
      pg_catalog.octet_length(limitation_code) between 1 and 64
      and limitation_code ~
        '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint candidate_limitations_payload
    check (
      canonical_payload ->> 'limitationId' = limitation_id
      and canonical_payload ->> 'candidateId' = candidate_id
      and canonical_payload ->> 'limitationCode' = limitation_code
    ),
  constraint candidate_limitations_record_digest
    check (record_digest ~ '^[0-9a-f]{64}$'),
  constraint candidate_limitations_created_at
    check (
      created_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
    )
);

create index candidate_limitations_active_world
  on gitblocks.candidate_limitations (
    candidate_id,
    limitation_id
  );

create table gitblocks.candidate_limitation_evidence (
  limitation_id text not null,
  candidate_id text not null,
  evidence_id text not null,
  ordinal integer not null,
  primary key (limitation_id, ordinal),
  constraint candidate_limitation_evidence_unique
    unique (limitation_id, evidence_id),
  constraint candidate_limitation_evidence_limitation
    foreign key (candidate_id, limitation_id)
    references gitblocks.candidate_limitations (
      candidate_id,
      limitation_id
    ),
  constraint candidate_limitation_evidence_observation
    foreign key (candidate_id, evidence_id)
    references gitblocks.evidence_observations (
      candidate_id,
      evidence_id
    ),
  constraint candidate_limitation_evidence_ordinal
    check (ordinal between 0 and 19)
);

create table gitblocks.candidate_material_unknowns (
  unknown_id text primary key,
  candidate_id text not null,
  topic text not null,
  canonical_payload jsonb not null,
  record_digest text not null,
  created_at timestamptz not null,
  constraint candidate_material_unknowns_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint candidate_material_unknowns_identity
    unique (candidate_id, unknown_id),
  constraint candidate_material_unknowns_unknown_id
    check (
      pg_catalog.octet_length(unknown_id) between 1 and 64
      and unknown_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint candidate_material_unknowns_topic
    check (
      pg_catalog.octet_length(topic) between 1 and 64
      and topic ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint candidate_material_unknowns_payload
    check (
      canonical_payload ->> 'scope' = 'candidate'
      and canonical_payload ->> 'unknownId' = unknown_id
      and canonical_payload ->> 'candidateId' = candidate_id
      and canonical_payload ->> 'topic' = topic
    ),
  constraint candidate_material_unknowns_record_digest
    check (record_digest ~ '^[0-9a-f]{64}$'),
  constraint candidate_material_unknowns_created_at
    check (
      created_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
    )
);

create index candidate_material_unknowns_active_world
  on gitblocks.candidate_material_unknowns (
    candidate_id,
    unknown_id
  );

create table gitblocks.candidate_unknown_evidence (
  unknown_id text not null,
  candidate_id text not null,
  evidence_id text not null,
  ordinal integer not null,
  primary key (unknown_id, ordinal),
  constraint candidate_unknown_evidence_unique
    unique (unknown_id, evidence_id),
  constraint candidate_unknown_evidence_unknown
    foreign key (candidate_id, unknown_id)
    references gitblocks.candidate_material_unknowns (
      candidate_id,
      unknown_id
    ),
  constraint candidate_unknown_evidence_observation
    foreign key (candidate_id, evidence_id)
    references gitblocks.evidence_observations (
      candidate_id,
      evidence_id
    ),
  constraint candidate_unknown_evidence_ordinal
    check (ordinal between 0 and 19)
);

create table gitblocks.evidence_supersessions (
  supersession_id text primary key,
  candidate_id text not null,
  superseded_evidence_id text not null,
  superseding_evidence_id text not null,
  reason_code text not null,
  effective_at timestamptz not null,
  record_digest text not null,
  created_at timestamptz not null,
  constraint evidence_supersessions_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint evidence_supersessions_superseded
    foreign key (candidate_id, superseded_evidence_id)
    references gitblocks.evidence_observations (
      candidate_id,
      evidence_id
    ),
  constraint evidence_supersessions_superseding
    foreign key (candidate_id, superseding_evidence_id)
    references gitblocks.evidence_observations (
      candidate_id,
      evidence_id
    ),
  constraint evidence_supersessions_no_self
    check (superseded_evidence_id <> superseding_evidence_id),
  constraint evidence_supersessions_supersession_id
    check (
      pg_catalog.octet_length(supersession_id) between 1 and 64
      and supersession_id ~
        '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint evidence_supersessions_reason_code
    check (
      pg_catalog.octet_length(reason_code) between 1 and 64
      and reason_code ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint evidence_supersessions_record_digest
    check (record_digest ~ '^[0-9a-f]{64}$'),
  constraint evidence_supersessions_timestamps
    check (
      effective_at >= created_at
      and effective_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
      and created_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
    )
);

create index evidence_supersessions_active
  on gitblocks.evidence_supersessions (
    candidate_id,
    superseded_evidence_id,
    effective_at
  );

create index evidence_supersessions_cycle
  on gitblocks.evidence_supersessions (
    candidate_id,
    superseding_evidence_id,
    superseded_evidence_id
  );

create table gitblocks.evidence_invalidations (
  invalidation_id text primary key,
  candidate_id text not null,
  evidence_id text not null,
  reason_code text not null,
  effective_at timestamptz not null,
  record_digest text not null,
  created_at timestamptz not null,
  constraint evidence_invalidations_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint evidence_invalidations_observation
    foreign key (candidate_id, evidence_id)
    references gitblocks.evidence_observations (
      candidate_id,
      evidence_id
    ),
  constraint evidence_invalidations_invalidation_id
    check (
      pg_catalog.octet_length(invalidation_id) between 1 and 64
      and invalidation_id ~
        '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint evidence_invalidations_reason_code
    check (
      pg_catalog.octet_length(reason_code) between 1 and 64
      and reason_code ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint evidence_invalidations_record_digest
    check (record_digest ~ '^[0-9a-f]{64}$'),
  constraint evidence_invalidations_timestamps
    check (
      effective_at >= created_at
      and effective_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
      and created_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
    )
);

create index evidence_invalidations_active
  on gitblocks.evidence_invalidations (
    candidate_id,
    evidence_id,
    effective_at
  );

create table gitblocks.candidate_dossier_snapshots (
  snapshot_id text primary key,
  candidate_id text not null,
  capability_family text not null,
  version_scope text,
  contract_version text not null,
  evidence_cutoff timestamptz not null,
  canonical_dossier_digest text not null,
  record_digest text not null,
  created_at timestamptz not null,
  constraint candidate_dossier_snapshots_candidate
    foreign key (candidate_id)
    references gitblocks.catalog_candidates (candidate_id),
  constraint candidate_dossier_snapshots_identity
    unique (snapshot_id, candidate_id),
  constraint candidate_dossier_snapshots_snapshot_id
    check (
      pg_catalog.octet_length(snapshot_id) between 1 and 64
      and snapshot_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint candidate_dossier_snapshots_family
    check (
      capability_family in (
        'authorization',
        'audit-logging',
        'background-jobs',
        'rate-limiting',
        'webhooks'
      )
    ),
  constraint candidate_dossier_snapshots_version_scope
    check (
      version_scope is null
      or pg_catalog.octet_length(version_scope) between 1 and 100
    ),
  constraint candidate_dossier_snapshots_contract_version
    check (contract_version = '1.0.0'),
  constraint candidate_dossier_snapshots_dossier_digest
    check (canonical_dossier_digest ~ '^[0-9a-f]{64}$'),
  constraint candidate_dossier_snapshots_record_digest
    check (record_digest ~ '^[0-9a-f]{64}$'),
  constraint candidate_dossier_snapshots_timestamps
    check (
      evidence_cutoff <= created_at
      and evidence_cutoff not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
      and created_at not in (
        'infinity'::timestamptz,
        '-infinity'::timestamptz
      )
    )
);

create index candidate_dossier_snapshots_history
  on gitblocks.candidate_dossier_snapshots (
    candidate_id,
    capability_family,
    evidence_cutoff,
    snapshot_id
  );

create table gitblocks.snapshot_evidence_members (
  snapshot_id text not null,
  candidate_id text not null,
  evidence_id text not null,
  ordinal integer not null,
  primary key (snapshot_id, ordinal),
  constraint snapshot_evidence_members_unique
    unique (snapshot_id, evidence_id),
  constraint snapshot_evidence_members_snapshot
    foreign key (snapshot_id, candidate_id)
    references gitblocks.candidate_dossier_snapshots (
      snapshot_id,
      candidate_id
    ),
  constraint snapshot_evidence_members_observation
    foreign key (candidate_id, evidence_id)
    references gitblocks.evidence_observations (
      candidate_id,
      evidence_id
    ),
  constraint snapshot_evidence_members_ordinal
    check (ordinal between 0 and 99)
);

create table gitblocks.snapshot_limitation_members (
  snapshot_id text not null,
  candidate_id text not null,
  limitation_id text not null,
  ordinal integer not null,
  primary key (snapshot_id, ordinal),
  constraint snapshot_limitation_members_unique
    unique (snapshot_id, limitation_id),
  constraint snapshot_limitation_members_snapshot
    foreign key (snapshot_id, candidate_id)
    references gitblocks.candidate_dossier_snapshots (
      snapshot_id,
      candidate_id
    ),
  constraint snapshot_limitation_members_limitation
    foreign key (candidate_id, limitation_id)
    references gitblocks.candidate_limitations (
      candidate_id,
      limitation_id
    ),
  constraint snapshot_limitation_members_ordinal
    check (ordinal between 0 and 39)
);

create table gitblocks.snapshot_unknown_members (
  snapshot_id text not null,
  candidate_id text not null,
  unknown_id text not null,
  ordinal integer not null,
  primary key (snapshot_id, ordinal),
  constraint snapshot_unknown_members_unique
    unique (snapshot_id, unknown_id),
  constraint snapshot_unknown_members_snapshot
    foreign key (snapshot_id, candidate_id)
    references gitblocks.candidate_dossier_snapshots (
      snapshot_id,
      candidate_id
    ),
  constraint snapshot_unknown_members_unknown
    foreign key (candidate_id, unknown_id)
    references gitblocks.candidate_material_unknowns (
      candidate_id,
      unknown_id
    ),
  constraint snapshot_unknown_members_ordinal
    check (ordinal between 0 and 39)
);

create function gitblocks.reject_immutable_update()
returns trigger
language plpgsql
set search_path = ''
as $gitblocks_immutable$
begin
  raise exception using
    errcode = 'P0001',
    message = 'immutable record update rejected';
end
$gitblocks_immutable$;

create function gitblocks.prevent_supersession_cycle()
returns trigger
language plpgsql
set search_path = ''
as $gitblocks_cycle$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.candidate_id, 44392817)
  );

  if exists (
    with recursive reachable(evidence_id) as (
      select new.superseding_evidence_id
      union
      select supersession.superseding_evidence_id
      from gitblocks.evidence_supersessions as supersession
      join reachable
        on reachable.evidence_id =
          supersession.superseded_evidence_id
      where supersession.candidate_id = new.candidate_id
    )
    select 1
    from reachable
    where evidence_id = new.superseded_evidence_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'supersession cycle rejected';
  end if;

  return new;
end
$gitblocks_cycle$;

create trigger catalog_candidates_immutable
before update on gitblocks.catalog_candidates
for each row execute function gitblocks.reject_immutable_update();

create trigger evidence_observations_immutable
before update on gitblocks.evidence_observations
for each row execute function gitblocks.reject_immutable_update();

create trigger candidate_limitations_immutable
before update on gitblocks.candidate_limitations
for each row execute function gitblocks.reject_immutable_update();

create trigger candidate_limitation_evidence_immutable
before update on gitblocks.candidate_limitation_evidence
for each row execute function gitblocks.reject_immutable_update();

create trigger candidate_material_unknowns_immutable
before update on gitblocks.candidate_material_unknowns
for each row execute function gitblocks.reject_immutable_update();

create trigger candidate_unknown_evidence_immutable
before update on gitblocks.candidate_unknown_evidence
for each row execute function gitblocks.reject_immutable_update();

create trigger evidence_supersessions_cycle
before insert on gitblocks.evidence_supersessions
for each row execute function gitblocks.prevent_supersession_cycle();

create trigger evidence_supersessions_immutable
before update on gitblocks.evidence_supersessions
for each row execute function gitblocks.reject_immutable_update();

create trigger evidence_invalidations_immutable
before update on gitblocks.evidence_invalidations
for each row execute function gitblocks.reject_immutable_update();

create trigger candidate_dossier_snapshots_immutable
before update on gitblocks.candidate_dossier_snapshots
for each row execute function gitblocks.reject_immutable_update();

create trigger snapshot_evidence_members_immutable
before update on gitblocks.snapshot_evidence_members
for each row execute function gitblocks.reject_immutable_update();

create trigger snapshot_limitation_members_immutable
before update on gitblocks.snapshot_limitation_members
for each row execute function gitblocks.reject_immutable_update();

create trigger snapshot_unknown_members_immutable
before update on gitblocks.snapshot_unknown_members
for each row execute function gitblocks.reject_immutable_update();

revoke all on all tables in schema gitblocks from public;
revoke all on all functions in schema gitblocks from public;
revoke all on schema gitblocks from public;

grant usage on schema gitblocks to gitblocks_persistence;

grant select, insert on table
  gitblocks.catalog_candidates,
  gitblocks.evidence_observations,
  gitblocks.candidate_limitations,
  gitblocks.candidate_limitation_evidence,
  gitblocks.candidate_material_unknowns,
  gitblocks.candidate_unknown_evidence,
  gitblocks.evidence_supersessions,
  gitblocks.evidence_invalidations,
  gitblocks.candidate_dossier_snapshots,
  gitblocks.snapshot_evidence_members,
  gitblocks.snapshot_limitation_members,
  gitblocks.snapshot_unknown_members
to gitblocks_persistence;

grant select, insert, delete on table
  gitblocks.candidate_capability_families
to gitblocks_persistence;
