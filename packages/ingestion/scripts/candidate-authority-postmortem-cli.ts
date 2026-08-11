import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import {
  CANDIDATE_AUTHORITY_FAILED_EXECUTION_HEAD,
  CANDIDATE_AUTHORITY_FAILURE_RECORD_PATH,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_PATH,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH,
  CANDIDATE_AUTHORITY_REPLAY_V3_PATH,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH,
  parseCandidateAuthorityPostmortemAuthorities,
} from '../src/candidate-authority-postmortem.ts';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, '../../..');
const [mode, ...unexpected] = process.argv.slice(2);

if ((mode !== 'validate' && mode !== 'preflight') || unexpected.length > 0) {
  process.stderr.write('candidate-authority-postmortem: invalid mode\n');
  process.exitCode = 1;
} else {
  try {
    const authorities = parseCandidateAuthorityPostmortemAuthorities({
      failureRecord: await readJson(CANDIDATE_AUTHORITY_FAILURE_RECORD_PATH),
      providerContract: await readJson(
        CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH,
      ),
      fieldPlan: await readJson(CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH),
      sourcePolicy: await readJson(CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH),
      replay: await readJson(CANDIDATE_AUTHORITY_REPLAY_V3_PATH),
      authorization: await readJson(
        CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_PATH,
      ),
    });
    const git = await readGitState();
    await requireForbiddenOutputsAbsent();
    const acceptedHeadState =
      git.head === CANDIDATE_AUTHORITY_FAILED_EXECUTION_HEAD
        ? 'pre-publication-direct-worktree'
        : git.parent === CANDIDATE_AUTHORITY_FAILED_EXECUTION_HEAD
          ? 'published-direct-successor'
          : 'invalid';
    if (
      git.branch !== 'feat/32-codebase-conditioned-ranking' ||
      acceptedHeadState === 'invalid' ||
      (acceptedHeadState === 'published-direct-successor' &&
        (git.head !== git.originHead || !git.clean)) ||
      git.rankingTree !== 'dc83037e36ae8422a692e2fdbad8d804cbf05985'
    )
      throw new Error('invalid postmortem state');
    const fieldPlan = authorities.fieldPlan;
    const source = authorities.sourcePolicy;
    const authorization = authorities.authorization;
    const effectAudit = {
      networkCalls: 0,
      candidateProviderCalls: 0,
      credentialReads: 0,
      databaseCalls: 0,
      dockerCalls: 0,
      modelCalls: 0,
      filesystemWrites: 0,
      providerCollections: 0,
      sourceAuthoritiesGenerated: 0,
      allCandidateProjections: 0,
      coverageCalculations: 0,
    } as const;
    process.stdout.write(
      `${JSON.stringify({
        status: 'passed',
        operation: `candidate-authority-postmortem-${mode}`,
        startHead: CANDIDATE_AUTHORITY_FAILED_EXECUTION_HEAD,
        head: git.head,
        originHead: git.originHead,
        headState: acceptedHeadState,
        failureRecordVersion: authorities.failureRecord['recordVersion'],
        failureRecordDigest:
          authorities.failureRecord['canonicalFailureDigest'],
        providerContractVersion:
          authorities.providerContract['contractVersion'],
        providerContractDigest:
          authorities.providerContract['canonicalContractDigest'],
        fieldPlanVersion: fieldPlan['planVersion'],
        fieldPlanDigest: fieldPlan['planSemanticDigest'],
        plannedExtractionCapableFields:
          fieldPlan['plannedDeterministicExtractionCapableFieldCount'],
        plannedFullClosureFields:
          fieldPlan['plannedDeterministicFullClosureFieldCount'],
        sourcePolicyVersion: source['policyVersion'],
        sourcePolicyDigest: source['policySemanticDigest'],
        replayAlgorithmVersion: authorities.replay['algorithmVersion'],
        replayAlgorithmDigest: authorities.replay['canonicalAlgorithmDigest'],
        authorizationVersion: authorization['authorizationVersion'],
        authorizationDigest: authorization['authorizationSemanticDigest'],
        authorizationStatus: authorization['status'],
        rankingTree: git.rankingTree,
        effectAudit,
      })}\n`,
    );
  } catch {
    process.stderr.write('candidate-authority-postmortem: validation failed\n');
    process.exitCode = 1;
  }
}

async function readJson(path: string): Promise<unknown> {
  const text = await readFile(resolve(repositoryRoot, path), 'utf8');
  if (Buffer.byteLength(text, 'utf8') > 4 * 1024 * 1024)
    throw new Error('bounded input exceeded');
  return JSON.parse(text) as unknown;
}

async function readGitState() {
  const options = {
    cwd: repositoryRoot,
    encoding: 'utf8' as const,
    maxBuffer: 1024 * 1024,
  };
  const [branch, head, originHead, parent, status, rankingTree] =
    await Promise.all([
      execFileAsync('git', ['branch', '--show-current'], options),
      execFileAsync('git', ['rev-parse', 'HEAD'], options),
      execFileAsync(
        'git',
        ['rev-parse', 'origin/feat/32-codebase-conditioned-ranking'],
        options,
      ),
      execFileAsync('git', ['rev-parse', 'HEAD^'], options),
      execFileAsync(
        'git',
        ['status', '--porcelain=v1', '--untracked-files=all'],
        options,
      ),
      execFileAsync('git', ['rev-parse', 'HEAD:evals/ranking-v1'], options),
    ]);
  return {
    branch: branch.stdout.trim(),
    head: head.stdout.trim(),
    originHead: originHead.stdout.trim(),
    parent: parent.stdout.trim(),
    clean: status.stdout.length === 0,
    rankingTree: rankingTree.stdout.trim(),
  };
}

async function requireForbiddenOutputsAbsent(): Promise<void> {
  const paths = [
    'catalog/public-v1/candidate-authority-source-authority-v1.json',
    'catalog/public-v1/candidate-authority-source-authority-v1.staging.json',
    'catalog/public-v1/candidate-authority-source-authority-v2.json',
    'catalog/public-v1/candidate-authority-source-authority-v2.staging.json',
    'catalog/public-v1/candidate-authority-profiles-v1.json',
    'catalog/public-v1/candidate-authority-profiles-v2.json',
    'catalog/public-v1/candidate-authority-partial-evidence-v1.json',
    'catalog/public-v1/candidate-authority-partial-evidence-v2.json',
    'catalog/public-v1/candidate-authority-evidence-v1.json',
    'catalog/public-v1/candidate-authority-evidence-v2.json',
    'catalog/public-v1/candidate-authority-dossiers-v1.json',
    'catalog/public-v1/candidate-authority-dossiers-v2.json',
    'catalog/public-v1/candidate-authority-dossier-projection-v1.json',
    'catalog/public-v1/candidate-authority-dossier-projection-v2.json',
    'catalog/public-v1/candidate-authority-readiness-report-v1.json',
    'catalog/public-v1/candidate-authority-readiness-report-v2.json',
    'catalog/public-v1/candidate-authority-root-v4.json',
    'catalog/public-v1/candidate-authority-root-v5.json',
    'packages/ranking',
  ];
  for (const path of paths) {
    try {
      await access(resolve(repositoryRoot, path));
    } catch {
      continue;
    }
    throw new Error(`forbidden output exists: ${path}`);
  }
}
