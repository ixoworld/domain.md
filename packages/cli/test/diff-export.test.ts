import { describe, expect, it } from 'vitest';

import { diffDomains } from '../src/diff.js';
import { exportDomain } from '../src/export.js';
import { lint } from '../src/lint.js';
import { toSarif } from '../src/sarif.js';
import { example } from './helpers.js';

describe('diff and export', () => {
  it('classifies controller changes as security-sensitive', async () => {
    const before = await example();
    const after = before.replace('governance_model: "dao"', 'governance_model: "hybrid"');
    const report = diffDomains(before, after);
    expect(report.requiresReview).toBe(true);
    expect(report.changes.some((change) => change.classification === 'security-sensitive')).toBe(
      true,
    );
    expect(report.regression).toBe(false);
  });

  it('can fail the diff gate on review-required changes', async () => {
    const before = await example();
    const after = before.replace('governance_model: "dao"', 'governance_model: "hybrid"');
    expect(diffDomains(before, after, { failOn: 'review' }).regression).toBe(true);
  });

  it('classifies prose changes as narrative', async () => {
    const before = await example();
    const after = before.replace(
      'Coordinates verified field-service delivery',
      'Coordinates audited field-service delivery',
    );
    expect(
      diffDomains(before, after).changes.some(
        (change) => change.path.startsWith('/sections') && change.classification === 'narrative',
      ),
    ).toBe(true);
  });

  it('reports a conformance regression', async () => {
    const before = await example();
    const after = before.replace('kind: "domain.md"', 'kind: "wrong"');
    expect(diffDomains(before, after).conformanceRegression).toBe(true);
  });

  it('exports a normalized JSON model with a non-canonical warning', async () => {
    const output = JSON.parse(exportDomain(await example(), { format: 'json' })) as {
      note: string;
      frontmatter: { kind: string };
    };
    expect(output.frontmatter.kind).toBe('domain.md');
    expect(output.note).toContain('not CID-canonical');
  });

  it('refuses JSON export when errors remain', async () => {
    const invalid = (await example()).replace('kind: "domain.md"', 'kind: "wrong"');
    expect(() => exportDomain(invalid, { format: 'json' })).toThrow('conformance errors');
  });

  it('exports SARIF 2.1.0 with stable rule identifiers', async () => {
    const invalid = (await example()).replace('kind: "domain.md"', 'kind: "wrong"');
    const sarif = JSON.parse(
      exportDomain(invalid, { format: 'sarif', sourceName: 'domain.md' }),
    ) as {
      version: string;
      runs: Array<{ results: Array<{ ruleId: string; locations: unknown[] }> }>;
    };
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0]?.results.some((result) => result.ruleId === 'schema')).toBe(true);
    expect(sarif.runs[0]?.results.every((result) => result.locations.length > 0)).toBe(true);
    expect(toSarif(lint(await example()))).toHaveProperty('runs');
  });
});
