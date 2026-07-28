import { inspectMarkdownFiles } from './markdown-inspection.ts';
import { validateMarkdownLinks } from './markdown-links.ts';
import { readRepository } from './repository-reader.ts';
import { validateRepositoryInvariants } from './repository-invariants.ts';
import { type Diagnostic } from './types.ts';
import { validateWorkflowFile } from './workflow-policy.ts';

const MAX_DIAGNOSTICS = 500;

export function runRepositoryChecks(startDirectory: string): Diagnostic[] {
  const repository = readRepository(startDirectory);
  const diagnostics: Diagnostic[] = [...repository.diagnostics];
  const markdownFiles = new Map(
    [...repository.textFiles].filter(([filePath]) => filePath.endsWith('.md')),
  );
  const markdownInspection = inspectMarkdownFiles(markdownFiles);

  diagnostics.push(
    ...validateMarkdownLinks({
      inspection: markdownInspection,
      markdownFiles,
      trackedPaths: repository.trackedPaths,
    }),
    ...validateRepositoryInvariants({
      markdownInspection,
      textFiles: repository.textFiles,
      trackedPaths: repository.trackedPaths,
    }),
  );

  for (const [filePath, content] of repository.textFiles) {
    if (/^\.github\/workflows\/.+\.ya?ml$/u.test(filePath)) {
      diagnostics.push(...validateWorkflowFile({ content, path: filePath }));
    }
  }

  return diagnostics.sort(compareDiagnostics).slice(0, MAX_DIAGNOSTICS);
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  return compareText(
    `${left.path ?? ''}\0${left.code}\0${left.message}`,
    `${right.path ?? ''}\0${right.code}\0${right.message}`,
  );
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}
