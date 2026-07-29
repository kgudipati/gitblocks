create schema if not exists gitblocks;

revoke all on schema gitblocks from public;

do $gitblocks_roles$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'gitblocks_runtime'
  ) then
    create role gitblocks_runtime
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'gitblocks_public_writer'
  ) then
    create role gitblocks_public_writer
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls;
  end if;
end
$gitblocks_roles$;

create function gitblocks.current_tenant_id()
returns uuid
language sql
stable
parallel safe
set search_path = pg_catalog
as $gitblocks_function$
  select case
    when pg_catalog.current_setting('gitblocks.tenant_id', true)
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then pg_catalog.current_setting('gitblocks.tenant_id', true)::uuid
    else null::uuid
  end
$gitblocks_function$;

create function gitblocks.reject_immutable_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $gitblocks_function$
begin
  raise exception using
    errcode = 'P0001',
    message = 'immutable row';
end
$gitblocks_function$;

create table gitblocks.tenants (
  tenant_id uuid primary key,
  created_at timestamptz not null,
  constraint tenants_created_at_finite
    check (created_at not in ('infinity'::timestamptz, '-infinity'::timestamptz))
);

create table gitblocks.tenant_tombstones (
  tenant_id uuid primary key,
  deleted_at timestamptz not null,
  reason_code text not null,
  constraint tenant_tombstones_reason_code
    check (
      pg_catalog.octet_length(reason_code) between 1 and 64
      and reason_code ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint tenant_tombstones_deleted_at_finite
    check (deleted_at not in ('infinity'::timestamptz, '-infinity'::timestamptz))
);

create table gitblocks.catalog_candidates (
  scope text not null,
  tenant_id uuid references gitblocks.tenants (tenant_id) on delete cascade,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  candidate_id text not null,
  display_name text not null,
  repository_owner text not null,
  repository_name text not null,
  package_name text,
  canonical_payload jsonb not null,
  canonical_digest text not null,
  created_at timestamptz not null,
  expires_at timestamptz,
  retention_expires_at timestamptz generated always as (
    coalesce(expires_at, 'infinity'::timestamptz)
  ) stored,
  primary key (scope_key, candidate_id),
  unique (scope_key, candidate_id, retention_expires_at),
  constraint catalog_candidates_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or
      (
        scope = 'tenant'
        and tenant_id is not null
        and expires_at is not null
        and expires_at > created_at
      )
    ),
  constraint catalog_candidates_candidate_id
    check (
      pg_catalog.octet_length(candidate_id) between 1 and 64
      and candidate_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint catalog_candidates_display_name
    check (
      pg_catalog.octet_length(display_name) between 1 and 640
      and display_name !~ '[\u0000-\u001f\u007f-\u009f]'
    ),
  constraint catalog_candidates_repository_owner
    check (
      pg_catalog.octet_length(repository_owner) between 1 and 100
      and repository_owner ~ '^[A-Za-z0-9_.-]{1,100}$'
    ),
  constraint catalog_candidates_repository_name
    check (
      pg_catalog.octet_length(repository_name) between 1 and 100
      and repository_name ~ '^[A-Za-z0-9_.-]{1,100}$'
    ),
  constraint catalog_candidates_package_name
    check (
      package_name is null
      or (
        pg_catalog.octet_length(package_name) between 1 and 201
        and package_name
          ~ '^(?:@[a-z0-9][a-z0-9._-]{0,99}/)?[a-z0-9][a-z0-9._-]{0,99}$'
      )
    ),
  constraint catalog_candidates_payload
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint catalog_candidates_digest
    check (canonical_digest ~ '^[0-9a-f]{64}$'),
  constraint catalog_candidates_created_at_finite
    check (created_at not in ('infinity'::timestamptz, '-infinity'::timestamptz))
);

create unique index catalog_candidates_repository_identity
on gitblocks.catalog_candidates (
  scope_key,
  pg_catalog.lower(repository_owner),
  pg_catalog.lower(repository_name)
);

create unique index catalog_candidates_package_identity
on gitblocks.catalog_candidates (
  scope_key,
  pg_catalog.lower(package_name)
)
where package_name is not null;

create index catalog_candidates_tenant_expiry
on gitblocks.catalog_candidates (tenant_id, expires_at, candidate_id)
where scope = 'tenant';

create table gitblocks.candidate_capability_families (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  candidate_id text not null,
  capability_family text not null,
  expires_at timestamptz,
  retention_expires_at timestamptz generated always as (
    coalesce(expires_at, 'infinity'::timestamptz)
  ) stored,
  primary key (scope_key, candidate_id, capability_family),
  foreign key (scope_key, candidate_id, retention_expires_at)
    references gitblocks.catalog_candidates (
      scope_key,
      candidate_id,
      retention_expires_at
    )
    on delete cascade,
  constraint candidate_capability_families_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or (scope = 'tenant' and tenant_id is not null and expires_at is not null)
    ),
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

create index candidate_capability_families_tenant
on gitblocks.candidate_capability_families (tenant_id, candidate_id)
where scope = 'tenant';

create table gitblocks.evidence_observations (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  candidate_id text not null,
  evidence_id text not null,
  topic text not null,
  dimension text not null,
  provenance_kind text not null,
  freshness_as_of timestamptz not null,
  canonical_payload jsonb not null,
  canonical_digest text not null,
  created_at timestamptz not null,
  expires_at timestamptz,
  retention_expires_at timestamptz generated always as (
    coalesce(expires_at, 'infinity'::timestamptz)
  ) stored,
  primary key (scope_key, evidence_id),
  unique (scope_key, candidate_id, evidence_id),
  foreign key (scope_key, candidate_id, retention_expires_at)
    references gitblocks.catalog_candidates (
      scope_key,
      candidate_id,
      retention_expires_at
    )
    on delete cascade,
  constraint evidence_observations_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or (scope = 'tenant' and tenant_id is not null and expires_at is not null)
    ),
  constraint evidence_observations_candidate_id
    check (
      pg_catalog.octet_length(candidate_id) between 1 and 64
      and candidate_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
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
  constraint evidence_observations_provenance_kind
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
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint evidence_observations_digest
    check (canonical_digest ~ '^[0-9a-f]{64}$'),
  constraint evidence_observations_times_finite
    check (
      freshness_as_of
        not in ('infinity'::timestamptz, '-infinity'::timestamptz)
      and created_at
        not in ('infinity'::timestamptz, '-infinity'::timestamptz)
    )
);

create index evidence_observations_active_page
on gitblocks.evidence_observations (
  scope_key,
  candidate_id,
  created_at,
  evidence_id
);

create index evidence_observations_tenant_expiry
on gitblocks.evidence_observations (
  tenant_id,
  expires_at,
  evidence_id
)
where scope = 'tenant';

create table gitblocks.candidate_limitations (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  candidate_id text not null,
  limitation_id text not null,
  limitation_code text not null,
  canonical_payload jsonb not null,
  canonical_digest text not null,
  created_at timestamptz not null,
  expires_at timestamptz,
  retention_expires_at timestamptz generated always as (
    coalesce(expires_at, 'infinity'::timestamptz)
  ) stored,
  primary key (scope_key, limitation_id),
  unique (scope_key, candidate_id, limitation_id),
  foreign key (scope_key, candidate_id, retention_expires_at)
    references gitblocks.catalog_candidates (
      scope_key,
      candidate_id,
      retention_expires_at
    )
    on delete cascade,
  constraint candidate_limitations_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or (scope = 'tenant' and tenant_id is not null and expires_at is not null)
    ),
  constraint candidate_limitations_ids
    check (
      pg_catalog.octet_length(candidate_id) between 1 and 64
      and candidate_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
      and pg_catalog.octet_length(limitation_id) between 1 and 64
      and limitation_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
      and pg_catalog.octet_length(limitation_code) between 1 and 64
      and limitation_code ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint candidate_limitations_payload
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint candidate_limitations_digest
    check (canonical_digest ~ '^[0-9a-f]{64}$'),
  constraint candidate_limitations_created_at_finite
    check (created_at not in ('infinity'::timestamptz, '-infinity'::timestamptz))
);

create index candidate_limitations_tenant
on gitblocks.candidate_limitations (tenant_id, candidate_id, limitation_id)
where scope = 'tenant';

create table gitblocks.candidate_limitation_evidence (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  candidate_id text not null,
  limitation_id text not null,
  evidence_id text not null,
  expires_at timestamptz,
  retention_expires_at timestamptz generated always as (
    coalesce(expires_at, 'infinity'::timestamptz)
  ) stored,
  primary key (scope_key, limitation_id, evidence_id),
  foreign key (scope_key, candidate_id, limitation_id)
    references gitblocks.candidate_limitations (
      scope_key,
      candidate_id,
      limitation_id
    )
    on delete cascade,
  foreign key (scope_key, candidate_id, evidence_id)
    references gitblocks.evidence_observations (
      scope_key,
      candidate_id,
      evidence_id
    ),
  foreign key (scope_key, candidate_id, retention_expires_at)
    references gitblocks.catalog_candidates (
      scope_key,
      candidate_id,
      retention_expires_at
    )
    on delete cascade,
  constraint candidate_limitation_evidence_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or (scope = 'tenant' and tenant_id is not null and expires_at is not null)
    )
);

create index candidate_limitation_evidence_by_observation
on gitblocks.candidate_limitation_evidence (
  scope_key,
  candidate_id,
  evidence_id
);

create table gitblocks.candidate_material_unknowns (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  candidate_id text not null,
  unknown_id text not null,
  topic text not null,
  canonical_payload jsonb not null,
  canonical_digest text not null,
  created_at timestamptz not null,
  expires_at timestamptz,
  retention_expires_at timestamptz generated always as (
    coalesce(expires_at, 'infinity'::timestamptz)
  ) stored,
  primary key (scope_key, unknown_id),
  unique (scope_key, candidate_id, unknown_id),
  foreign key (scope_key, candidate_id, retention_expires_at)
    references gitblocks.catalog_candidates (
      scope_key,
      candidate_id,
      retention_expires_at
    )
    on delete cascade,
  constraint candidate_material_unknowns_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or (scope = 'tenant' and tenant_id is not null and expires_at is not null)
    ),
  constraint candidate_material_unknowns_ids
    check (
      pg_catalog.octet_length(candidate_id) between 1 and 64
      and candidate_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
      and pg_catalog.octet_length(unknown_id) between 1 and 64
      and unknown_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
      and pg_catalog.octet_length(topic) between 1 and 64
      and topic ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint candidate_material_unknowns_payload
    check (pg_catalog.jsonb_typeof(canonical_payload) = 'object'),
  constraint candidate_material_unknowns_digest
    check (canonical_digest ~ '^[0-9a-f]{64}$'),
  constraint candidate_material_unknowns_created_at_finite
    check (created_at not in ('infinity'::timestamptz, '-infinity'::timestamptz))
);

create index candidate_material_unknowns_tenant
on gitblocks.candidate_material_unknowns (
  tenant_id,
  candidate_id,
  unknown_id
)
where scope = 'tenant';

create table gitblocks.candidate_unknown_evidence (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  candidate_id text not null,
  unknown_id text not null,
  evidence_id text not null,
  expires_at timestamptz,
  retention_expires_at timestamptz generated always as (
    coalesce(expires_at, 'infinity'::timestamptz)
  ) stored,
  primary key (scope_key, unknown_id, evidence_id),
  foreign key (scope_key, candidate_id, unknown_id)
    references gitblocks.candidate_material_unknowns (
      scope_key,
      candidate_id,
      unknown_id
    )
    on delete cascade,
  foreign key (scope_key, candidate_id, evidence_id)
    references gitblocks.evidence_observations (
      scope_key,
      candidate_id,
      evidence_id
    ),
  foreign key (scope_key, candidate_id, retention_expires_at)
    references gitblocks.catalog_candidates (
      scope_key,
      candidate_id,
      retention_expires_at
    )
    on delete cascade,
  constraint candidate_unknown_evidence_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or (scope = 'tenant' and tenant_id is not null and expires_at is not null)
    )
);

create index candidate_unknown_evidence_by_observation
on gitblocks.candidate_unknown_evidence (
  scope_key,
  candidate_id,
  evidence_id
);

create table gitblocks.evidence_supersessions (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  candidate_id text not null,
  supersession_id text not null,
  superseded_evidence_id text not null,
  superseding_evidence_id text not null,
  reason_code text not null,
  effective_at timestamptz not null,
  canonical_digest text not null,
  created_at timestamptz not null,
  expires_at timestamptz,
  retention_expires_at timestamptz generated always as (
    coalesce(expires_at, 'infinity'::timestamptz)
  ) stored,
  primary key (scope_key, supersession_id),
  unique (scope_key, candidate_id, superseded_evidence_id),
  foreign key (scope_key, candidate_id, superseded_evidence_id)
    references gitblocks.evidence_observations (
      scope_key,
      candidate_id,
      evidence_id
    )
    on delete cascade,
  foreign key (scope_key, candidate_id, superseding_evidence_id)
    references gitblocks.evidence_observations (
      scope_key,
      candidate_id,
      evidence_id
    )
    on delete cascade,
  foreign key (scope_key, candidate_id, retention_expires_at)
    references gitblocks.catalog_candidates (
      scope_key,
      candidate_id,
      retention_expires_at
    )
    on delete cascade,
  constraint evidence_supersessions_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or (scope = 'tenant' and tenant_id is not null and expires_at is not null)
    ),
  constraint evidence_supersessions_ids
    check (
      pg_catalog.octet_length(supersession_id) between 1 and 64
      and supersession_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
      and superseded_evidence_id <> superseding_evidence_id
    ),
  constraint evidence_supersessions_reason
    check (
      pg_catalog.octet_length(reason_code) between 1 and 64
      and reason_code ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint evidence_supersessions_digest
    check (canonical_digest ~ '^[0-9a-f]{64}$'),
  constraint evidence_supersessions_times
    check (
      effective_at >= created_at
      and effective_at
        not in ('infinity'::timestamptz, '-infinity'::timestamptz)
      and created_at
        not in ('infinity'::timestamptz, '-infinity'::timestamptz)
    )
);

create index evidence_supersessions_active
on gitblocks.evidence_supersessions (
  scope_key,
  candidate_id,
  superseded_evidence_id,
  effective_at
);

create index evidence_supersessions_reverse
on gitblocks.evidence_supersessions (
  scope_key,
  candidate_id,
  superseding_evidence_id
);

create table gitblocks.evidence_invalidations (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  candidate_id text not null,
  invalidation_id text not null,
  evidence_id text not null,
  reason_code text not null,
  effective_at timestamptz not null,
  canonical_digest text not null,
  created_at timestamptz not null,
  expires_at timestamptz,
  retention_expires_at timestamptz generated always as (
    coalesce(expires_at, 'infinity'::timestamptz)
  ) stored,
  primary key (scope_key, invalidation_id),
  unique (scope_key, candidate_id, evidence_id),
  foreign key (scope_key, candidate_id, evidence_id)
    references gitblocks.evidence_observations (
      scope_key,
      candidate_id,
      evidence_id
    )
    on delete cascade,
  foreign key (scope_key, candidate_id, retention_expires_at)
    references gitblocks.catalog_candidates (
      scope_key,
      candidate_id,
      retention_expires_at
    )
    on delete cascade,
  constraint evidence_invalidations_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or (scope = 'tenant' and tenant_id is not null and expires_at is not null)
    ),
  constraint evidence_invalidations_id
    check (
      pg_catalog.octet_length(invalidation_id) between 1 and 64
      and invalidation_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint evidence_invalidations_reason
    check (
      pg_catalog.octet_length(reason_code) between 1 and 64
      and reason_code ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint evidence_invalidations_digest
    check (canonical_digest ~ '^[0-9a-f]{64}$'),
  constraint evidence_invalidations_times
    check (
      effective_at >= created_at
      and effective_at
        not in ('infinity'::timestamptz, '-infinity'::timestamptz)
      and created_at
        not in ('infinity'::timestamptz, '-infinity'::timestamptz)
    )
);

create index evidence_invalidations_active
on gitblocks.evidence_invalidations (
  scope_key,
  candidate_id,
  evidence_id,
  effective_at
);

create table gitblocks.candidate_dossier_snapshots (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  snapshot_id text not null,
  candidate_id text not null,
  capability_family text not null,
  version_scope text,
  contract_version text not null,
  evidence_cutoff timestamptz not null,
  identity_payload jsonb not null,
  canonical_dossier_digest text not null,
  created_at timestamptz not null,
  expires_at timestamptz,
  primary key (scope_key, snapshot_id),
  unique (scope_key, candidate_id, snapshot_id),
  foreign key (scope_key, candidate_id)
    references gitblocks.catalog_candidates (scope_key, candidate_id)
    on delete cascade,
  foreign key (scope_key, candidate_id, capability_family)
    references gitblocks.candidate_capability_families (
      scope_key,
      candidate_id,
      capability_family
    ),
  constraint candidate_dossier_snapshots_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or
      (
        scope = 'tenant'
        and tenant_id is not null
        and expires_at is not null
        and expires_at > created_at
      )
    ),
  constraint candidate_dossier_snapshots_snapshot_id
    check (
      pg_catalog.octet_length(snapshot_id) between 1 and 64
      and snapshot_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'
    ),
  constraint candidate_dossier_snapshots_capability_family
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
      or (
        pg_catalog.octet_length(version_scope) between 1 and 400
        and version_scope !~ '[\u0000-\u001f\u007f-\u009f]'
      )
    ),
  constraint candidate_dossier_snapshots_contract_version
    check (contract_version = '1.0.0'),
  constraint candidate_dossier_snapshots_identity
    check (pg_catalog.jsonb_typeof(identity_payload) = 'object'),
  constraint candidate_dossier_snapshots_digest
    check (canonical_dossier_digest ~ '^[0-9a-f]{64}$'),
  constraint candidate_dossier_snapshots_times
    check (
      evidence_cutoff <= created_at
      and evidence_cutoff
        not in ('infinity'::timestamptz, '-infinity'::timestamptz)
      and created_at
        not in ('infinity'::timestamptz, '-infinity'::timestamptz)
    )
);

create index candidate_dossier_snapshots_tenant_expiry
on gitblocks.candidate_dossier_snapshots (
  tenant_id,
  expires_at,
  snapshot_id
)
where scope = 'tenant';

create table gitblocks.snapshot_evidence_members (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  snapshot_id text not null,
  candidate_id text not null,
  evidence_id text not null,
  ordinal integer not null,
  expires_at timestamptz,
  primary key (scope_key, snapshot_id, evidence_id),
  unique (scope_key, snapshot_id, ordinal),
  foreign key (scope_key, candidate_id, snapshot_id)
    references gitblocks.candidate_dossier_snapshots (
      scope_key,
      candidate_id,
      snapshot_id
    )
    on delete cascade,
  foreign key (scope_key, candidate_id, evidence_id)
    references gitblocks.evidence_observations (
      scope_key,
      candidate_id,
      evidence_id
    ),
  constraint snapshot_evidence_members_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or (scope = 'tenant' and tenant_id is not null and expires_at is not null)
    ),
  constraint snapshot_evidence_members_ordinal
    check (ordinal between 0 and 99)
);

create index snapshot_evidence_members_material
on gitblocks.snapshot_evidence_members (
  scope_key,
  candidate_id,
  evidence_id
);

create table gitblocks.snapshot_limitation_members (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  snapshot_id text not null,
  candidate_id text not null,
  limitation_id text not null,
  ordinal integer not null,
  expires_at timestamptz,
  primary key (scope_key, snapshot_id, limitation_id),
  unique (scope_key, snapshot_id, ordinal),
  foreign key (scope_key, candidate_id, snapshot_id)
    references gitblocks.candidate_dossier_snapshots (
      scope_key,
      candidate_id,
      snapshot_id
    )
    on delete cascade,
  foreign key (scope_key, candidate_id, limitation_id)
    references gitblocks.candidate_limitations (
      scope_key,
      candidate_id,
      limitation_id
    ),
  constraint snapshot_limitation_members_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or (scope = 'tenant' and tenant_id is not null and expires_at is not null)
    ),
  constraint snapshot_limitation_members_ordinal
    check (ordinal between 0 and 39)
);

create index snapshot_limitation_members_material
on gitblocks.snapshot_limitation_members (
  scope_key,
  candidate_id,
  limitation_id
);

create table gitblocks.snapshot_unknown_members (
  scope text not null,
  tenant_id uuid,
  scope_key text generated always as (
    case
      when scope = 'public' then 'public'
      else 'tenant:' || tenant_id::text
    end
  ) stored,
  snapshot_id text not null,
  candidate_id text not null,
  unknown_id text not null,
  ordinal integer not null,
  expires_at timestamptz,
  primary key (scope_key, snapshot_id, unknown_id),
  unique (scope_key, snapshot_id, ordinal),
  foreign key (scope_key, candidate_id, snapshot_id)
    references gitblocks.candidate_dossier_snapshots (
      scope_key,
      candidate_id,
      snapshot_id
    )
    on delete cascade,
  foreign key (scope_key, candidate_id, unknown_id)
    references gitblocks.candidate_material_unknowns (
      scope_key,
      candidate_id,
      unknown_id
    ),
  constraint snapshot_unknown_members_scope
    check (
      (scope = 'public' and tenant_id is null and expires_at is null)
      or (scope = 'tenant' and tenant_id is not null and expires_at is not null)
    ),
  constraint snapshot_unknown_members_ordinal
    check (ordinal between 0 and 39)
);

create index snapshot_unknown_members_material
on gitblocks.snapshot_unknown_members (
  scope_key,
  candidate_id,
  unknown_id
);

create function gitblocks.reject_supersession_cycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $gitblocks_function$
declare
  requested_scope_key text :=
    case
      when new.scope = 'public' then 'public'
      else 'tenant:' || new.tenant_id::text
    end;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      requested_scope_key || ':' || new.candidate_id,
      776985962084714117
    )
  );

  if exists (
    with recursive chain(evidence_id) as (
      select superseding_evidence_id
      from gitblocks.evidence_supersessions
      where scope_key = requested_scope_key
        and candidate_id = new.candidate_id
        and superseded_evidence_id = new.superseding_evidence_id
      union
      select supersession.superseding_evidence_id
      from gitblocks.evidence_supersessions as supersession
      join chain
        on chain.evidence_id = supersession.superseded_evidence_id
      where supersession.scope_key = requested_scope_key
        and supersession.candidate_id = new.candidate_id
    )
    select 1
    from chain
    where evidence_id = new.superseded_evidence_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'supersession cycle';
  end if;

  return new;
end
$gitblocks_function$;

create function gitblocks.enforce_snapshot_retention()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $gitblocks_function$
declare
  candidate_expiry timestamptz;
  requested_scope_key text :=
    case
      when new.scope = 'public' then 'public'
      else 'tenant:' || new.tenant_id::text
    end;
begin
  select expires_at
  into candidate_expiry
  from gitblocks.catalog_candidates
  where scope_key = requested_scope_key
    and candidate_id = new.candidate_id;

  if not found then
    raise exception using errcode = '23503', message = 'candidate missing';
  end if;

  if new.scope = 'tenant' and candidate_expiry < new.expires_at then
    raise exception using errcode = '23514', message = 'snapshot retention';
  end if;

  return new;
end
$gitblocks_function$;

create function gitblocks.enforce_snapshot_member_retention()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $gitblocks_function$
declare
  material_expiry timestamptz;
  requested_scope_key text :=
    case
      when new.scope = 'public' then 'public'
      else 'tenant:' || new.tenant_id::text
    end;
begin
  if tg_table_name = 'snapshot_evidence_members' then
    select expires_at
    into material_expiry
    from gitblocks.evidence_observations
    where scope_key = requested_scope_key
      and candidate_id = new.candidate_id
      and evidence_id = new.evidence_id;
  elsif tg_table_name = 'snapshot_limitation_members' then
    select expires_at
    into material_expiry
    from gitblocks.candidate_limitations
    where scope_key = requested_scope_key
      and candidate_id = new.candidate_id
      and limitation_id = new.limitation_id;
  elsif tg_table_name = 'snapshot_unknown_members' then
    select expires_at
    into material_expiry
    from gitblocks.candidate_material_unknowns
    where scope_key = requested_scope_key
      and candidate_id = new.candidate_id
      and unknown_id = new.unknown_id;
  else
    raise exception using errcode = 'P0001', message = 'unsupported member';
  end if;

  if not found then
    raise exception using errcode = '23503', message = 'material missing';
  end if;

  if new.scope = 'tenant' and material_expiry < new.expires_at then
    raise exception using errcode = '23514', message = 'member retention';
  end if;

  return new;
end
$gitblocks_function$;

create function gitblocks.purge_expired_tenant_data(
  requested_tenant_id uuid,
  expires_before_or_at timestamptz,
  requested_limit integer
)
returns table (
  deleted_snapshots integer,
  deleted_candidates integer
)
language plpgsql
security definer
set search_path = pg_catalog
as $gitblocks_function$
declare
  snapshot_count integer := 0;
  candidate_count integer := 0;
  remaining integer;
begin
  if requested_tenant_id is distinct from gitblocks.current_tenant_id() then
    raise exception using errcode = '42501', message = 'scope denied';
  end if;
  if requested_limit < 1 or requested_limit > 500 then
    raise exception using errcode = '22023', message = 'invalid limit';
  end if;

  with expired as (
    select scope_key, snapshot_id
    from gitblocks.candidate_dossier_snapshots
    where scope = 'tenant'
      and tenant_id = requested_tenant_id
      and expires_at <= expires_before_or_at
    order by expires_at, snapshot_id
    limit requested_limit
    for update skip locked
  ),
  removed as (
    delete from gitblocks.candidate_dossier_snapshots as snapshot
    using expired
    where snapshot.scope_key = expired.scope_key
      and snapshot.snapshot_id = expired.snapshot_id
    returning 1
  )
  select pg_catalog.count(*)::integer
  into snapshot_count
  from removed;

  remaining := requested_limit - snapshot_count;
  if remaining > 0 then
    with expired as (
      select scope_key, candidate_id
      from gitblocks.catalog_candidates
      where scope = 'tenant'
        and tenant_id = requested_tenant_id
        and expires_at <= expires_before_or_at
      order by expires_at, candidate_id
      limit remaining
      for update skip locked
    ),
    removed as (
      delete from gitblocks.catalog_candidates as candidate
      using expired
      where candidate.scope_key = expired.scope_key
        and candidate.candidate_id = expired.candidate_id
      returning 1
    )
    select pg_catalog.count(*)::integer
    into candidate_count
    from removed;
  end if;

  return query select snapshot_count, candidate_count;
end
$gitblocks_function$;

create function gitblocks.delete_tenant_data(
  requested_tenant_id uuid,
  requested_deleted_at timestamptz,
  requested_reason_code text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $gitblocks_function$
begin
  if requested_tenant_id is distinct from gitblocks.current_tenant_id() then
    raise exception using errcode = '42501', message = 'scope denied';
  end if;
  if requested_reason_code !~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$' then
    raise exception using errcode = '22023', message = 'invalid reason';
  end if;

  perform 1
  from gitblocks.tenants
  where tenant_id = requested_tenant_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'tenant missing';
  end if;

  insert into gitblocks.tenant_tombstones (
    tenant_id,
    deleted_at,
    reason_code
  )
  values (
    requested_tenant_id,
    requested_deleted_at,
    requested_reason_code
  );

  delete from gitblocks.tenants
  where tenant_id = requested_tenant_id;
end
$gitblocks_function$;

create trigger tenants_immutable
before update on gitblocks.tenants
for each row execute function gitblocks.reject_immutable_update();

create trigger tenant_tombstones_immutable
before update on gitblocks.tenant_tombstones
for each row execute function gitblocks.reject_immutable_update();

create trigger catalog_candidates_immutable
before update on gitblocks.catalog_candidates
for each row execute function gitblocks.reject_immutable_update();

create trigger evidence_observations_immutable
before update on gitblocks.evidence_observations
for each row execute function gitblocks.reject_immutable_update();

create trigger candidate_limitations_immutable
before update on gitblocks.candidate_limitations
for each row execute function gitblocks.reject_immutable_update();

create trigger candidate_material_unknowns_immutable
before update on gitblocks.candidate_material_unknowns
for each row execute function gitblocks.reject_immutable_update();

create trigger evidence_supersessions_immutable
before update on gitblocks.evidence_supersessions
for each row execute function gitblocks.reject_immutable_update();

create trigger evidence_supersessions_no_cycle
before insert on gitblocks.evidence_supersessions
for each row execute function gitblocks.reject_supersession_cycle();

create trigger evidence_invalidations_immutable
before update on gitblocks.evidence_invalidations
for each row execute function gitblocks.reject_immutable_update();

create trigger candidate_dossier_snapshots_immutable
before update on gitblocks.candidate_dossier_snapshots
for each row execute function gitblocks.reject_immutable_update();

create trigger candidate_dossier_snapshots_retention
before insert on gitblocks.candidate_dossier_snapshots
for each row execute function gitblocks.enforce_snapshot_retention();

create trigger snapshot_evidence_members_immutable
before update on gitblocks.snapshot_evidence_members
for each row execute function gitblocks.reject_immutable_update();

create trigger snapshot_evidence_members_retention
before insert on gitblocks.snapshot_evidence_members
for each row execute function gitblocks.enforce_snapshot_member_retention();

create trigger snapshot_limitation_members_immutable
before update on gitblocks.snapshot_limitation_members
for each row execute function gitblocks.reject_immutable_update();

create trigger snapshot_limitation_members_retention
before insert on gitblocks.snapshot_limitation_members
for each row execute function gitblocks.enforce_snapshot_member_retention();

create trigger snapshot_unknown_members_immutable
before update on gitblocks.snapshot_unknown_members
for each row execute function gitblocks.reject_immutable_update();

create trigger snapshot_unknown_members_retention
before insert on gitblocks.snapshot_unknown_members
for each row execute function gitblocks.enforce_snapshot_member_retention();

alter table gitblocks.tenants enable row level security;
alter table gitblocks.tenants force row level security;
alter table gitblocks.tenant_tombstones enable row level security;
alter table gitblocks.tenant_tombstones force row level security;
alter table gitblocks.catalog_candidates enable row level security;
alter table gitblocks.catalog_candidates force row level security;
alter table gitblocks.candidate_capability_families enable row level security;
alter table gitblocks.candidate_capability_families force row level security;
alter table gitblocks.evidence_observations enable row level security;
alter table gitblocks.evidence_observations force row level security;
alter table gitblocks.candidate_limitations enable row level security;
alter table gitblocks.candidate_limitations force row level security;
alter table gitblocks.candidate_limitation_evidence enable row level security;
alter table gitblocks.candidate_limitation_evidence force row level security;
alter table gitblocks.candidate_material_unknowns enable row level security;
alter table gitblocks.candidate_material_unknowns force row level security;
alter table gitblocks.candidate_unknown_evidence enable row level security;
alter table gitblocks.candidate_unknown_evidence force row level security;
alter table gitblocks.evidence_supersessions enable row level security;
alter table gitblocks.evidence_supersessions force row level security;
alter table gitblocks.evidence_invalidations enable row level security;
alter table gitblocks.evidence_invalidations force row level security;
alter table gitblocks.candidate_dossier_snapshots enable row level security;
alter table gitblocks.candidate_dossier_snapshots force row level security;
alter table gitblocks.snapshot_evidence_members enable row level security;
alter table gitblocks.snapshot_evidence_members force row level security;
alter table gitblocks.snapshot_limitation_members enable row level security;
alter table gitblocks.snapshot_limitation_members force row level security;
alter table gitblocks.snapshot_unknown_members enable row level security;
alter table gitblocks.snapshot_unknown_members force row level security;

create policy tenants_owner
on gitblocks.tenants
to current_user
using (true)
with check (true);

create policy tenants_runtime_select
on gitblocks.tenants
for select
to gitblocks_runtime
using (tenant_id = gitblocks.current_tenant_id());

create policy tenants_runtime_insert
on gitblocks.tenants
for insert
to gitblocks_runtime
with check (tenant_id = gitblocks.current_tenant_id());

create policy tenant_tombstones_owner
on gitblocks.tenant_tombstones
to current_user
using (true)
with check (true);

create policy catalog_candidates_owner
on gitblocks.catalog_candidates
to current_user
using (true)
with check (true);

create policy catalog_candidates_runtime_select
on gitblocks.catalog_candidates
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy catalog_candidates_runtime_insert
on gitblocks.catalog_candidates
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy catalog_candidates_runtime_update
on gitblocks.catalog_candidates
for update
to gitblocks_runtime
using (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
)
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy catalog_candidates_public_select
on gitblocks.catalog_candidates
for select
to gitblocks_public_writer
using (scope = 'public');

create policy catalog_candidates_public_insert
on gitblocks.catalog_candidates
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy catalog_candidates_public_update
on gitblocks.catalog_candidates
for update
to gitblocks_public_writer
using (scope = 'public')
with check (scope = 'public');

create policy candidate_capability_families_owner
on gitblocks.candidate_capability_families
to current_user
using (true)
with check (true);

create policy candidate_capability_families_runtime_select
on gitblocks.candidate_capability_families
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy candidate_capability_families_runtime_insert
on gitblocks.candidate_capability_families
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy candidate_capability_families_runtime_delete
on gitblocks.candidate_capability_families
for delete
to gitblocks_runtime
using (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy candidate_capability_families_public_select
on gitblocks.candidate_capability_families
for select
to gitblocks_public_writer
using (scope = 'public');

create policy candidate_capability_families_public_insert
on gitblocks.candidate_capability_families
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy candidate_capability_families_public_delete
on gitblocks.candidate_capability_families
for delete
to gitblocks_public_writer
using (scope = 'public');

create policy evidence_observations_owner
on gitblocks.evidence_observations
to current_user
using (true)
with check (true);

create policy evidence_observations_runtime_select
on gitblocks.evidence_observations
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy evidence_observations_runtime_insert
on gitblocks.evidence_observations
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy evidence_observations_public_select
on gitblocks.evidence_observations
for select
to gitblocks_public_writer
using (scope = 'public');

create policy evidence_observations_public_insert
on gitblocks.evidence_observations
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy candidate_limitations_owner
on gitblocks.candidate_limitations
to current_user
using (true)
with check (true);

create policy candidate_limitations_runtime_select
on gitblocks.candidate_limitations
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy candidate_limitations_runtime_insert
on gitblocks.candidate_limitations
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy candidate_limitations_public_select
on gitblocks.candidate_limitations
for select
to gitblocks_public_writer
using (scope = 'public');

create policy candidate_limitations_public_insert
on gitblocks.candidate_limitations
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy candidate_limitation_evidence_owner
on gitblocks.candidate_limitation_evidence
to current_user
using (true)
with check (true);

create policy candidate_limitation_evidence_runtime_select
on gitblocks.candidate_limitation_evidence
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy candidate_limitation_evidence_runtime_insert
on gitblocks.candidate_limitation_evidence
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy candidate_limitation_evidence_public_select
on gitblocks.candidate_limitation_evidence
for select
to gitblocks_public_writer
using (scope = 'public');

create policy candidate_limitation_evidence_public_insert
on gitblocks.candidate_limitation_evidence
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy candidate_material_unknowns_owner
on gitblocks.candidate_material_unknowns
to current_user
using (true)
with check (true);

create policy candidate_material_unknowns_runtime_select
on gitblocks.candidate_material_unknowns
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy candidate_material_unknowns_runtime_insert
on gitblocks.candidate_material_unknowns
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy candidate_material_unknowns_public_select
on gitblocks.candidate_material_unknowns
for select
to gitblocks_public_writer
using (scope = 'public');

create policy candidate_material_unknowns_public_insert
on gitblocks.candidate_material_unknowns
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy candidate_unknown_evidence_owner
on gitblocks.candidate_unknown_evidence
to current_user
using (true)
with check (true);

create policy candidate_unknown_evidence_runtime_select
on gitblocks.candidate_unknown_evidence
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy candidate_unknown_evidence_runtime_insert
on gitblocks.candidate_unknown_evidence
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy candidate_unknown_evidence_public_select
on gitblocks.candidate_unknown_evidence
for select
to gitblocks_public_writer
using (scope = 'public');

create policy candidate_unknown_evidence_public_insert
on gitblocks.candidate_unknown_evidence
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy evidence_supersessions_owner
on gitblocks.evidence_supersessions
to current_user
using (true)
with check (true);

create policy evidence_supersessions_runtime_select
on gitblocks.evidence_supersessions
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy evidence_supersessions_runtime_insert
on gitblocks.evidence_supersessions
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy evidence_supersessions_public_select
on gitblocks.evidence_supersessions
for select
to gitblocks_public_writer
using (scope = 'public');

create policy evidence_supersessions_public_insert
on gitblocks.evidence_supersessions
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy evidence_invalidations_owner
on gitblocks.evidence_invalidations
to current_user
using (true)
with check (true);

create policy evidence_invalidations_runtime_select
on gitblocks.evidence_invalidations
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy evidence_invalidations_runtime_insert
on gitblocks.evidence_invalidations
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy evidence_invalidations_public_select
on gitblocks.evidence_invalidations
for select
to gitblocks_public_writer
using (scope = 'public');

create policy evidence_invalidations_public_insert
on gitblocks.evidence_invalidations
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy candidate_dossier_snapshots_owner
on gitblocks.candidate_dossier_snapshots
to current_user
using (true)
with check (true);

create policy candidate_dossier_snapshots_runtime_select
on gitblocks.candidate_dossier_snapshots
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy candidate_dossier_snapshots_runtime_insert
on gitblocks.candidate_dossier_snapshots
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy candidate_dossier_snapshots_public_select
on gitblocks.candidate_dossier_snapshots
for select
to gitblocks_public_writer
using (scope = 'public');

create policy candidate_dossier_snapshots_public_insert
on gitblocks.candidate_dossier_snapshots
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy snapshot_evidence_members_owner
on gitblocks.snapshot_evidence_members
to current_user
using (true)
with check (true);

create policy snapshot_evidence_members_runtime_select
on gitblocks.snapshot_evidence_members
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy snapshot_evidence_members_runtime_insert
on gitblocks.snapshot_evidence_members
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy snapshot_evidence_members_public_select
on gitblocks.snapshot_evidence_members
for select
to gitblocks_public_writer
using (scope = 'public');

create policy snapshot_evidence_members_public_insert
on gitblocks.snapshot_evidence_members
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy snapshot_limitation_members_owner
on gitblocks.snapshot_limitation_members
to current_user
using (true)
with check (true);

create policy snapshot_limitation_members_runtime_select
on gitblocks.snapshot_limitation_members
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy snapshot_limitation_members_runtime_insert
on gitblocks.snapshot_limitation_members
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy snapshot_limitation_members_public_select
on gitblocks.snapshot_limitation_members
for select
to gitblocks_public_writer
using (scope = 'public');

create policy snapshot_limitation_members_public_insert
on gitblocks.snapshot_limitation_members
for insert
to gitblocks_public_writer
with check (scope = 'public');

create policy snapshot_unknown_members_owner
on gitblocks.snapshot_unknown_members
to current_user
using (true)
with check (true);

create policy snapshot_unknown_members_runtime_select
on gitblocks.snapshot_unknown_members
for select
to gitblocks_runtime
using (
  scope = 'public'
  or (scope = 'tenant' and tenant_id = gitblocks.current_tenant_id())
);

create policy snapshot_unknown_members_runtime_insert
on gitblocks.snapshot_unknown_members
for insert
to gitblocks_runtime
with check (
  scope = 'tenant'
  and tenant_id = gitblocks.current_tenant_id()
);

create policy snapshot_unknown_members_public_select
on gitblocks.snapshot_unknown_members
for select
to gitblocks_public_writer
using (scope = 'public');

create policy snapshot_unknown_members_public_insert
on gitblocks.snapshot_unknown_members
for insert
to gitblocks_public_writer
with check (scope = 'public');

grant usage on schema gitblocks
to gitblocks_runtime, gitblocks_public_writer;

grant execute on function gitblocks.current_tenant_id()
to gitblocks_runtime, gitblocks_public_writer;

grant select, insert on table
  gitblocks.tenants
to gitblocks_runtime;

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
to gitblocks_runtime, gitblocks_public_writer;

grant update on table gitblocks.catalog_candidates
to gitblocks_runtime, gitblocks_public_writer;

grant select, insert, delete on table
  gitblocks.candidate_capability_families
to gitblocks_runtime, gitblocks_public_writer;

grant execute on function gitblocks.purge_expired_tenant_data(
  uuid,
  timestamptz,
  integer
)
to gitblocks_runtime;

grant execute on function gitblocks.delete_tenant_data(
  uuid,
  timestamptz,
  text
)
to gitblocks_runtime;

revoke all on function gitblocks.reject_immutable_update() from public;
revoke all on function gitblocks.reject_supersession_cycle() from public;
revoke all on function gitblocks.enforce_snapshot_retention() from public;
revoke all on function gitblocks.enforce_snapshot_member_retention() from public;
revoke all on function gitblocks.purge_expired_tenant_data(
  uuid,
  timestamptz,
  integer
) from public;
revoke all on function gitblocks.delete_tenant_data(
  uuid,
  timestamptz,
  text
) from public;
