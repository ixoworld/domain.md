import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MAX_DOMAIN_BYTES, MAX_SCALAR_LENGTH, MAX_YAML_DEPTH } from '../src/constants.js';
import { parseDomain } from '../src/parser.js';
import { example, packageRoot } from './helpers.js';

describe('parseDomain', () => {
  it('parses the normative example and ordered sections', async () => {
    const result = parseDomain(await example(), { sourceName: 'example' });
    expect(result.ok).toBe(true);
    expect(result.document?.frontmatter.kind).toBe('domain.md');
    expect(result.document?.sections.map((section) => section.heading)).toContain('Overview');
  });

  it.each(['unsafe-yaml.md', 'duplicate-key.md'])('rejects unsafe fixture %s', async (fixture) => {
    const content = await readFile(resolve(packageRoot, 'test/fixtures', fixture), 'utf8');
    const result = parseDomain(content);
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === 'unsafe-yaml')).toBe(true);
  });

  it('rejects an oversized input before parsing', () => {
    const result = parseDomain('x'.repeat(MAX_DOMAIN_BYTES + 1));
    expect(result.findings[0]?.code).toBe('file-too-large');
  });

  it('rejects a UTF-8 BOM', async () => {
    const result = parseDomain(`\ufeff${await example()}`);
    expect(result.findings.some((finding) => finding.code === 'encoding')).toBe(true);
  });

  it('requires one frontmatter block at the beginning', () => {
    expect(parseDomain('# title\n\n---\nname: late\n---').findings[0]?.code).toBe(
      'missing-frontmatter',
    );
  });

  it.each([
    ['a YAML sequence', '---\n- one\n- two\n---\n'],
    ['a custom tag', '---\nvalue: !unsafe tagged\n---\n'],
    ['a merge key', '---\nbase: &base\n  one: 1\nvalue:\n  <<: *base\n---\n'],
  ])('rejects %s in frontmatter', (_label, content) => {
    expect(parseDomain(content).ok).toBe(false);
  });

  it('enforces scalar and depth limits', () => {
    const scalar = parseDomain(`---\nvalue: "${'x'.repeat(MAX_SCALAR_LENGTH + 1)}"\n---\n`);
    const nested = `${'value:\n  '.repeat(MAX_YAML_DEPTH + 1)}leaf: true`;
    const depth = parseDomain(`---\n${nested}\n---\n`);
    expect(scalar.findings.some((finding) => finding.code === 'unsafe-yaml')).toBe(true);
    expect(depth.findings.some((finding) => finding.code === 'unsafe-yaml')).toBe(true);
  });

  it('rejects additional frontmatter blocks and preserves inline heading text safely', async () => {
    const content = `${await example()}\n---\nextra: block\n---\n\n## Inline *heading*\n\n## ![icon](image.png)\n`;
    const result = parseDomain(content);
    expect(result.findings.some((finding) => finding.code === 'frontmatter-fence')).toBe(true);
    expect(result.document?.sections.at(-2)?.heading).toBe('Inline heading');
    expect(result.document?.sections.at(-1)?.heading).toBe('');
  });
});
