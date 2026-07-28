import { describe, expect, it } from 'vitest';

import { validateMarkdownLinks } from '../src/markdown-links.ts';

function validate(
  source: string,
  additionalFiles: Readonly<Record<string, string>> = {},
  additionalTrackedPaths: readonly string[] = [],
) {
  const markdownFiles = new Map<string, string>([
    ['README.md', source],
    ...Object.entries(additionalFiles),
  ]);
  const trackedPaths = new Set([
    ...markdownFiles.keys(),
    ...additionalTrackedPaths,
  ]);
  return validateMarkdownLinks({ markdownFiles, trackedPaths });
}

describe('validateMarkdownLinks', () => {
  it('accepts relative files, same-file headings, directories, and external links', () => {
    const diagnostics = validate(
      `# Overview

[Section](docs/guide.md#install)
[Local](#overview)
[Directory](docs/)
[Web](https://example.com/missing)
[Mail](mailto:maintainer@example.com)
[Protocol relative](//example.com/path)
`,
      {
        'docs/guide.md': '# Install\n',
      },
    );

    expect(diagnostics).toEqual([]);
  });

  it('accepts duplicate GitHub heading slugs and encoded fragments', () => {
    const diagnostics = validate(
      `[First](target.md#repeat)
[Second](target.md#repeat-1)
[Encoded](target.md#encoded%2Dheading)
`,
      {
        'target.md': `# Repeat
# Repeat
# Encoded heading
`,
      },
    );

    expect(diagnostics).toEqual([]);
  });

  it('accepts an encoded relative file path', () => {
    expect(
      validate('[Guide](docs/My%20Guide.md)\n', {
        'docs/My Guide.md': '# Guide\n',
      }),
    ).toEqual([]);
  });

  it.each([
    ['[Missing](docs/missing.md)\n', 'markdown.missing-target'],
    ['[Missing fragment](docs/guide.md#absent)\n', 'markdown.missing-fragment'],
    ['[Bad encoding](docs/guide.md#bad%ZZ)\n', 'markdown.invalid-encoding'],
    ['[Escape](../outside.md)\n', 'markdown.unsafe-path'],
    ['[Encoded escape](%2e%2e/outside.md)\n', 'markdown.unsafe-path'],
    ['[Root path](/outside.md)\n', 'markdown.unsafe-path'],
  ])('rejects invalid local link %s', (source, code) => {
    const diagnostics = validate(source, {
      'docs/guide.md': '# Present\n',
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
    expect(diagnostics[0]?.path).toBe('README.md');
  });

  it('rejects a fragment that does not identify the duplicate instance', () => {
    const diagnostics = validate('[Third](target.md#repeat-2)\n', {
      'target.md': '# Repeat\n# Repeat\n',
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'markdown.missing-fragment',
    );
  });

  it('does not interpret Markdown code as a link', () => {
    expect(validate('`[Not a link](missing.md)`\n')).toEqual([]);
  });

  it('rejects excessive Markdown nesting', () => {
    const diagnostics = validate(`${'> '.repeat(70)}nested\n`);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'markdown.structure-limit' }),
      ]),
    );
  });

  it('rejects excessive Markdown node count', () => {
    const diagnostics = validate('# Heading\n'.repeat(20_001));

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'markdown.structure-limit' }),
      ]),
    );
  });

  it('bounds heading-text extraction by the Markdown depth limit', () => {
    const nestedStrong = '**'.repeat(80);
    const diagnostics = validate(`# ${nestedStrong}heading${nestedStrong}\n`);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'markdown.structure-limit' }),
      ]),
    );
  });

  it('rejects oversized Markdown before parsing', () => {
    const diagnostics = validate(`\n${'x'.repeat(512 * 1024 + 1)}`);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'markdown.file-size' }),
      ]),
    );
  });

  it('bounds emitted Markdown diagnostics', () => {
    const source = Array.from(
      { length: 250 },
      (_, index) => `[Missing](missing-${String(index)}.md)`,
    ).join('\n');

    expect(validate(source)).toHaveLength(200);
  });
});
