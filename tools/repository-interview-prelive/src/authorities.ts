import { canonicalizeJson, sha256Digest } from '@gitblocks/interviews';

const DIGEST = /^[0-9a-f]{64}$/u;
const RELATIVE_JSON_PATH =
  /^(?:plans|profiles)\/[a-z0-9.-]+\.json$|^(?:readiness-policy|offline-verification-report)\.json$/u;

export const PRELIVE_GATE_CODES = Object.freeze([
  'offline-verification',
  'fresh-artifact-materialization',
  'retention-authority',
  'pricing-authority',
  'model-calibration',
  'maintainer-live-authorization',
  'ephemeral-database',
  'provider-credential',
  'audit-assignment-readiness',
] as const);

const PRELIVE_CALIBRATION_PREREQUISITE_CODES = Object.freeze([
  'offline-verification',
  'fresh-artifact-materialization',
  'retention-authority',
  'pricing-authority',
  'maintainer-live-authorization',
  'ephemeral-database',
  'provider-credential',
  'audit-assignment-readiness',
] as const satisfies readonly GateCode[]);

export const PRELIVE_OFFLINE_CHECK_CODES = Object.freeze([
  'candidate-plan-closure',
  'profile-closure',
  'synthetic-materialization-closure',
  'schema-drift',
  'contract-drift',
  'specification-drift',
  'evaluation-drift',
  'migration-drift',
  'architecture',
  'network-denial',
  'secret-denial',
  'dry-run-zero-effects',
  'operator-unit',
  'operator-postgresql',
  'reuse-proof',
  'deadline-proof',
  'receipt-closure',
  'telemetry-closure',
] as const);

export const PRELIVE_LIVE_BLOCKER_CODES = Object.freeze([
  'fresh-artifact-materialization-required',
  'retention-authority-required',
  'pricing-authority-required',
  'model-calibration-not-run',
  'maintainer-live-authorization-required',
  'ephemeral-database-not-provisioned',
  'provider-credential-not-configured',
  'audit-assignments-not-instantiated',
] as const);

type GateCode = (typeof PRELIVE_GATE_CODES)[number];
type GateStatus = 'satisfied' | 'unsatisfied' | 'not-applicable';
type OfflineCheckCode = (typeof PRELIVE_OFFLINE_CHECK_CODES)[number];
type LiveBlockerCode = (typeof PRELIVE_LIVE_BLOCKER_CODES)[number];

export interface RepositoryInterviewPreliveReadinessPolicyV1 {
  readonly schemaVersion: '1.0.0';
  readonly policyId: 'repository-interviews-prelive-readiness-v1';
  readonly gates: readonly {
    readonly gate: GateCode;
    readonly status: GateStatus;
  }[];
  readonly liveReady: boolean;
  readonly calibrationStatus: 'ready' | 'blocked';
  readonly gateAStatus: 'ready' | 'blocked';
  readonly gateBStatus: 'ready' | 'blocked';
  readonly policyDigest: string;
}

type ReadinessDraft = Omit<
  RepositoryInterviewPreliveReadinessPolicyV1,
  'policyDigest'
>;

export function repositoryInterviewPreliveReadinessPolicyDigestV1(
  value: ReadinessDraft,
): string {
  return sha256Digest(
    `gitblocks\0repository-interview-prelive-readiness-policy\0v1\0${canonicalizeJson(value)}`,
  );
}

export function createRepositoryInterviewPreliveReadinessPolicyV1(
  statuses: Readonly<Record<GateCode, GateStatus>>,
): RepositoryInterviewPreliveReadinessPolicyV1 {
  const gates = PRELIVE_GATE_CODES.map((gate) => ({
    gate,
    status: statuses[gate],
  }));
  const calibrationStatus = calibrationReadiness(gates);
  const liveReady = calibrationStatus === 'ready';
  const base: ReadinessDraft = {
    schemaVersion: '1.0.0',
    policyId: 'repository-interviews-prelive-readiness-v1',
    gates,
    liveReady,
    calibrationStatus,
    gateAStatus: 'blocked',
    gateBStatus: 'blocked',
  };
  return parseRepositoryInterviewPreliveReadinessPolicyV1({
    ...base,
    policyDigest: repositoryInterviewPreliveReadinessPolicyDigestV1(base),
  });
}

export function parseRepositoryInterviewPreliveReadinessPolicyV1(
  input: unknown,
): RepositoryInterviewPreliveReadinessPolicyV1 {
  const value = own(input);
  exactKeys(value, [
    'schemaVersion',
    'policyId',
    'gates',
    'liveReady',
    'calibrationStatus',
    'gateAStatus',
    'gateBStatus',
    'policyDigest',
  ]);
  const gates = value['gates'];
  if (!Array.isArray(gates) || gates.length !== PRELIVE_GATE_CODES.length) {
    throw invalid();
  }
  for (let index = 0; index < gates.length; index += 1) {
    const gate = record(gates[index]);
    exactKeys(gate, ['gate', 'status']);
    if (
      gate['gate'] !== PRELIVE_GATE_CODES[index] ||
      (gate['status'] !== 'satisfied' &&
        gate['status'] !== 'unsatisfied' &&
        gate['status'] !== 'not-applicable')
    )
      throw invalid();
  }
  const calibrationStatus = calibrationReadiness(
    gates.map((entry) => {
      const parsed = record(entry);
      return {
        gate: parsed['gate'] as GateCode,
        status: parsed['status'] as GateStatus,
      };
    }),
  );
  const liveReady = calibrationStatus === 'ready';
  if (
    value['schemaVersion'] !== '1.0.0' ||
    value['policyId'] !== 'repository-interviews-prelive-readiness-v1' ||
    value['liveReady'] !== liveReady ||
    value['calibrationStatus'] !== calibrationStatus ||
    value['gateAStatus'] !== 'blocked' ||
    value['gateBStatus'] !== 'blocked' ||
    !digest(value['policyDigest'])
  )
    throw invalid();
  const typed = value as unknown as RepositoryInterviewPreliveReadinessPolicyV1;
  const { policyDigest, ...base } = typed;
  if (
    repositoryInterviewPreliveReadinessPolicyDigestV1(base) !== policyDigest
  ) {
    throw invalid();
  }
  return typed;
}

function calibrationReadiness(
  gates: readonly { readonly gate: GateCode; readonly status: GateStatus }[],
): 'ready' | 'blocked' {
  const statuses = new Map(gates.map(({ gate, status }) => [gate, status]));
  return PRELIVE_CALIBRATION_PREREQUISITE_CODES.every(
    (gate) => statuses.get(gate) === 'satisfied',
  )
    ? 'ready'
    : 'blocked';
}

export interface RepositoryInterviewOfflineVerificationReportV1 {
  readonly schemaVersion: '1.0.0';
  readonly reportId: 'repository-interviews-prelive-offline-v1';
  readonly verificationVersion: '1.0.0';
  readonly status: 'offline-verified-live-blocked';
  readonly catalogDigest: string;
  readonly artifactManifestDigest: string;
  readonly specificationDigest: string;
  readonly providerOutputSchemaDigest: string;
  readonly providerProjectionDigest: string;
  readonly evaluationCorpusDigest: string;
  readonly operatorSelectionSchemaDigest: string;
  readonly operatorPolicySchemaDigest: string;
  readonly operatorReceiptSchemaDigest: string;
  readonly candidatePlanSchemaDigest: string;
  readonly selectionMaterializationSchemaDigest: string;
  readonly preliveAuthorizationSchemaDigest: string;
  readonly calibrationPlanDigest: string;
  readonly gateAPlanDigest: string;
  readonly gateBPlanDigest: string;
  readonly fullCandidateCount: 150;
  readonly calibrationCandidateCount: 6;
  readonly gateACandidateCount: 30;
  readonly modelProfileDigests: readonly [string, string];
  readonly offlineChecks: readonly {
    readonly code: OfflineCheckCode;
    readonly status: 'passed';
  }[];
  readonly liveBlockers: readonly LiveBlockerCode[];
  readonly reportDigest: string;
}

type ReportDraft = Omit<
  RepositoryInterviewOfflineVerificationReportV1,
  'reportDigest'
>;

export function repositoryInterviewOfflineVerificationReportDigestV1(
  value: ReportDraft,
): string {
  return sha256Digest(
    `gitblocks\0repository-interview-offline-verification-report\0v1\0${canonicalizeJson(value)}`,
  );
}

export function createRepositoryInterviewOfflineVerificationReportV1(
  draft: Omit<
    ReportDraft,
    | 'schemaVersion'
    | 'reportId'
    | 'verificationVersion'
    | 'status'
    | 'offlineChecks'
    | 'liveBlockers'
  >,
): RepositoryInterviewOfflineVerificationReportV1 {
  const base: ReportDraft = {
    schemaVersion: '1.0.0',
    reportId: 'repository-interviews-prelive-offline-v1',
    verificationVersion: '1.0.0',
    status: 'offline-verified-live-blocked',
    ...draft,
    offlineChecks: PRELIVE_OFFLINE_CHECK_CODES.map((code) => ({
      code,
      status: 'passed' as const,
    })),
    liveBlockers: PRELIVE_LIVE_BLOCKER_CODES,
  };
  return parseRepositoryInterviewOfflineVerificationReportV1({
    ...base,
    reportDigest: repositoryInterviewOfflineVerificationReportDigestV1(base),
  });
}

export function parseRepositoryInterviewOfflineVerificationReportV1(
  input: unknown,
): RepositoryInterviewOfflineVerificationReportV1 {
  const value = own(input);
  exactKeys(value, [
    'schemaVersion',
    'reportId',
    'verificationVersion',
    'status',
    'catalogDigest',
    'artifactManifestDigest',
    'specificationDigest',
    'providerOutputSchemaDigest',
    'providerProjectionDigest',
    'evaluationCorpusDigest',
    'operatorSelectionSchemaDigest',
    'operatorPolicySchemaDigest',
    'operatorReceiptSchemaDigest',
    'candidatePlanSchemaDigest',
    'selectionMaterializationSchemaDigest',
    'preliveAuthorizationSchemaDigest',
    'calibrationPlanDigest',
    'gateAPlanDigest',
    'gateBPlanDigest',
    'fullCandidateCount',
    'calibrationCandidateCount',
    'gateACandidateCount',
    'modelProfileDigests',
    'offlineChecks',
    'liveBlockers',
    'reportDigest',
  ]);
  const digestFields = [
    'catalogDigest',
    'artifactManifestDigest',
    'specificationDigest',
    'providerOutputSchemaDigest',
    'providerProjectionDigest',
    'evaluationCorpusDigest',
    'operatorSelectionSchemaDigest',
    'operatorPolicySchemaDigest',
    'operatorReceiptSchemaDigest',
    'candidatePlanSchemaDigest',
    'selectionMaterializationSchemaDigest',
    'preliveAuthorizationSchemaDigest',
    'calibrationPlanDigest',
    'gateAPlanDigest',
    'gateBPlanDigest',
    'reportDigest',
  ];
  const profiles = value['modelProfileDigests'];
  const checks = value['offlineChecks'];
  const blockers = value['liveBlockers'];
  if (
    value['schemaVersion'] !== '1.0.0' ||
    value['reportId'] !== 'repository-interviews-prelive-offline-v1' ||
    value['verificationVersion'] !== '1.0.0' ||
    value['status'] !== 'offline-verified-live-blocked' ||
    digestFields.some((field) => !digest(value[field])) ||
    value['fullCandidateCount'] !== 150 ||
    value['calibrationCandidateCount'] !== 6 ||
    value['gateACandidateCount'] !== 30 ||
    !Array.isArray(profiles) ||
    profiles.length !== 2 ||
    profiles.some((profile) => !digest(profile)) ||
    String(profiles[0]) >= String(profiles[1]) ||
    !Array.isArray(checks) ||
    checks.length !== PRELIVE_OFFLINE_CHECK_CODES.length ||
    !Array.isArray(blockers) ||
    blockers.length !== PRELIVE_LIVE_BLOCKER_CODES.length
  )
    throw invalid();
  checks.forEach((entry, index) => {
    const check = record(entry);
    exactKeys(check, ['code', 'status']);
    if (
      check['code'] !== PRELIVE_OFFLINE_CHECK_CODES[index] ||
      check['status'] !== 'passed'
    )
      throw invalid();
  });
  if (
    blockers.some(
      (blocker, index) => blocker !== PRELIVE_LIVE_BLOCKER_CODES[index],
    )
  )
    throw invalid();
  const typed =
    value as unknown as RepositoryInterviewOfflineVerificationReportV1;
  const { reportDigest, ...base } = typed;
  if (
    repositoryInterviewOfflineVerificationReportDigestV1(base) !== reportDigest
  ) {
    throw invalid();
  }
  return typed;
}

interface FileMember {
  readonly path: string;
  readonly sha256: string;
}

interface ProfileMember {
  readonly path: string;
  readonly modelProfileDigest: string;
}

export interface RepositoryInterviewPreliveManifestV1 {
  readonly schemaVersion: '1.0.0';
  readonly verificationId: 'repository-interviews-prelive-v1';
  readonly verificationVersion: '1.0.0';
  readonly status: 'offline-verified-live-blocked';
  readonly catalogVersion: 'public-v1';
  readonly catalogDigest: string;
  readonly artifactManifestVersion: 'public-artifacts-v1';
  readonly artifactManifestDigest: string;
  readonly specificationVersion: '1.0.0';
  readonly specificationDigest: string;
  readonly providerOutputSchemaDigest: string;
  readonly providerProjectionDigest: string;
  readonly evaluationCorpusId: 'repository-interviews-v1';
  readonly evaluationCorpusVersion: '1.0.0';
  readonly evaluationCorpusDigest: string;
  readonly operatorSelectionSchemaDigest: string;
  readonly operatorPolicySchemaDigest: string;
  readonly operatorReceiptSchemaDigest: string;
  readonly candidatePlanSchemaDigest: string;
  readonly selectionMaterializationSchemaDigest: string;
  readonly preliveAuthorizationSchemaDigest: string;
  readonly candidatePlanMembers: readonly [FileMember, FileMember, FileMember];
  readonly modelProfileMembers: readonly [ProfileMember, ProfileMember];
  readonly readinessPolicy: FileMember;
  readonly offlineReport: FileMember;
  readonly manifestDigest: string;
}

type ManifestDraft = Omit<
  RepositoryInterviewPreliveManifestV1,
  'manifestDigest'
>;

export function repositoryInterviewPreliveManifestDigestV1(
  value: ManifestDraft,
): string {
  return sha256Digest(
    `gitblocks\0repository-interview-prelive-manifest\0v1\0${canonicalizeJson(value)}`,
  );
}

export function createRepositoryInterviewPreliveManifestV1(
  draft: ManifestDraft,
): RepositoryInterviewPreliveManifestV1 {
  return parseRepositoryInterviewPreliveManifestV1({
    ...draft,
    manifestDigest: repositoryInterviewPreliveManifestDigestV1(draft),
  });
}

export function parseRepositoryInterviewPreliveManifestV1(
  input: unknown,
): RepositoryInterviewPreliveManifestV1 {
  const value = own(input);
  exactKeys(value, [
    'schemaVersion',
    'verificationId',
    'verificationVersion',
    'status',
    'catalogVersion',
    'catalogDigest',
    'artifactManifestVersion',
    'artifactManifestDigest',
    'specificationVersion',
    'specificationDigest',
    'providerOutputSchemaDigest',
    'providerProjectionDigest',
    'evaluationCorpusId',
    'evaluationCorpusVersion',
    'evaluationCorpusDigest',
    'operatorSelectionSchemaDigest',
    'operatorPolicySchemaDigest',
    'operatorReceiptSchemaDigest',
    'candidatePlanSchemaDigest',
    'selectionMaterializationSchemaDigest',
    'preliveAuthorizationSchemaDigest',
    'candidatePlanMembers',
    'modelProfileMembers',
    'readinessPolicy',
    'offlineReport',
    'manifestDigest',
  ]);
  const planMembers = value['candidatePlanMembers'];
  const profileMembers = value['modelProfileMembers'];
  if (
    value['schemaVersion'] !== '1.0.0' ||
    value['verificationId'] !== 'repository-interviews-prelive-v1' ||
    value['verificationVersion'] !== '1.0.0' ||
    value['status'] !== 'offline-verified-live-blocked' ||
    value['catalogVersion'] !== 'public-v1' ||
    value['artifactManifestVersion'] !== 'public-artifacts-v1' ||
    value['specificationVersion'] !== '1.0.0' ||
    value['evaluationCorpusId'] !== 'repository-interviews-v1' ||
    value['evaluationCorpusVersion'] !== '1.0.0' ||
    !Array.isArray(planMembers) ||
    planMembers.length !== 3 ||
    !Array.isArray(profileMembers) ||
    profileMembers.length !== 2
  )
    throw invalid();
  const digestFields = [
    'catalogDigest',
    'artifactManifestDigest',
    'specificationDigest',
    'providerOutputSchemaDigest',
    'providerProjectionDigest',
    'evaluationCorpusDigest',
    'operatorSelectionSchemaDigest',
    'operatorPolicySchemaDigest',
    'operatorReceiptSchemaDigest',
    'candidatePlanSchemaDigest',
    'selectionMaterializationSchemaDigest',
    'preliveAuthorizationSchemaDigest',
    'manifestDigest',
  ];
  if (digestFields.some((field) => !digest(value[field]))) throw invalid();
  let previous = '';
  for (const member of planMembers) {
    const parsed = fileMember(member);
    if (!parsed.path.startsWith('plans/') || parsed.path <= previous)
      throw invalid();
    previous = parsed.path;
  }
  previous = '';
  for (const member of profileMembers) {
    const parsed = record(member);
    exactKeys(parsed, ['path', 'modelProfileDigest']);
    if (
      typeof parsed['path'] !== 'string' ||
      !parsed['path'].startsWith('profiles/') ||
      !RELATIVE_JSON_PATH.test(parsed['path']) ||
      parsed['path'] <= previous ||
      !digest(parsed['modelProfileDigest'])
    )
      throw invalid();
    previous = parsed['path'];
  }
  const readiness = fileMember(value['readinessPolicy']);
  const report = fileMember(value['offlineReport']);
  if (
    readiness.path !== 'readiness-policy.json' ||
    report.path !== 'offline-verification-report.json'
  )
    throw invalid();
  const typed = value as unknown as RepositoryInterviewPreliveManifestV1;
  const { manifestDigest, ...base } = typed;
  if (repositoryInterviewPreliveManifestDigestV1(base) !== manifestDigest) {
    throw invalid();
  }
  return typed;
}

function fileMember(input: unknown): FileMember {
  const value = record(input);
  exactKeys(value, ['path', 'sha256']);
  if (
    typeof value['path'] !== 'string' ||
    !RELATIVE_JSON_PATH.test(value['path']) ||
    !digest(value['sha256'])
  )
    throw invalid();
  return value as unknown as FileMember;
}

function own(input: unknown): Readonly<Record<string, unknown>> {
  const state = { nodes: 0, strings: 0, ancestors: new Set<object>() };
  return record(clone(input, 0, state));
}

function clone(
  input: unknown,
  depth: number,
  state: { nodes: number; strings: number; readonly ancestors: Set<object> },
): unknown {
  if (depth > 32 || ++state.nodes > 20_000) throw invalid();
  if (input === null || typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    state.strings += Buffer.byteLength(input, 'utf8');
    if (state.strings > 8 * 1_024 * 1_024) throw invalid();
    return input;
  }
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw invalid();
    return Object.is(input, -0) ? 0 : input;
  }
  if (typeof input !== 'object' || state.ancestors.has(input)) throw invalid();
  state.ancestors.add(input);
  try {
    const prototype = Reflect.getPrototypeOf(input);
    const keys = Reflect.ownKeys(input);
    if (Array.isArray(input)) {
      const length = Reflect.getOwnPropertyDescriptor(input, 'length');
      if (
        prototype !== Array.prototype ||
        length === undefined ||
        typeof length.value !== 'number' ||
        !Number.isSafeInteger(length.value) ||
        length.value > 500 ||
        keys.length !== length.value + 1 ||
        !keys.includes('length')
      )
        throw invalid();
      const result: unknown[] = [];
      for (let index = 0; index < length.value; index += 1) {
        const descriptor = Reflect.getOwnPropertyDescriptor(
          input,
          String(index),
        );
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !('value' in descriptor) ||
          keys[index] !== String(index)
        )
          throw invalid();
        result.push(clone(descriptor.value, depth + 1, state));
      }
      return Object.freeze(result);
    }
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length > 100 ||
      keys.some((key) => typeof key !== 'string')
    )
      throw invalid();
    const result: Record<string, unknown> = {};
    for (const key of keys as readonly string[]) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      )
        throw invalid();
      result[key] = clone(descriptor.value, depth + 1, state);
    }
    return Object.freeze(result);
  } catch {
    throw invalid();
  } finally {
    state.ancestors.delete(input);
  }
}

function record(input: unknown): Readonly<Record<string, unknown>> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw invalid();
  }
  const prototype = Object.getPrototypeOf(input) as unknown;
  if (prototype !== Object.prototype && prototype !== null) throw invalid();
  return input as Readonly<Record<string, unknown>>;
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  if (
    actual.length !== sorted.length ||
    actual.some((key, index) => key !== sorted[index])
  )
    throw invalid();
}

function digest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST.test(value);
}

function invalid(): Error {
  const error = new Error(
    'Repository interview pre-live authority is invalid.',
  );
  Object.defineProperty(error, 'stack', { value: undefined });
  return error;
}
