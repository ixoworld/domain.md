import { createHash } from 'node:crypto';

import { lint } from './lint.js';
import type {
  ChangeClassification,
  DiffOptions,
  DiffReport,
  DomainChange,
  DomainRecord,
} from './types.js';

const SECURITY_PREFIXES = [
  '/controllers',
  '/rights',
  '/accounts',
  '/privacy',
  '/source_of_truth',
  '/claims',
  '/agents',
  '/agent_default_mode',
  '/critical_do_not',
];
const OPERATIONAL_PREFIXES = [
  '/services',
  '/resources',
  '/linked_entities',
  '/pods',
  '/graph_policy',
  '/documents',
];

function classify(path: string): ChangeClassification {
  if (SECURITY_PREFIXES.some((prefix) => path.startsWith(prefix))) return 'security-sensitive';
  if (OPERATIONAL_PREFIXES.some((prefix) => path.startsWith(prefix))) return 'operational';
  return path.startsWith('/sections/') ? 'narrative' : 'operational';
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as DomainRecord)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function compare(before: unknown, after: unknown, path: string, changes: DomainChange[]): void {
  if (stable(before) === stable(after)) return;
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort())
      compare(
        (before as DomainRecord)[key],
        (after as DomainRecord)[key],
        `${path}/${key}`,
        changes,
      );
    return;
  }
  changes.push({ path: path || '/', classification: classify(path), before, after });
}

function sectionHashes(content: string): DomainRecord {
  const report = lint(content);
  return Object.fromEntries(
    (report.document?.sections ?? []).map((section) => [
      section.heading,
      createHash('sha256').update(section.content).digest('hex'),
    ]),
  );
}

export function diffDomains(
  beforeContent: string,
  afterContent: string,
  options: DiffOptions = {},
): DiffReport {
  const beforeReport = lint(beforeContent, { sourceName: 'before' });
  const afterReport = lint(afterContent, { sourceName: 'after' });
  const changes: DomainChange[] = [];
  compare(
    beforeReport.document?.frontmatter ?? {},
    afterReport.document?.frontmatter ?? {},
    '',
    changes,
  );
  compare(sectionHashes(beforeContent), sectionHashes(afterContent), '/sections', changes);
  const conformanceRegression =
    afterReport.summary.errors > beforeReport.summary.errors ||
    (beforeReport.ok && !afterReport.ok);
  const requiresReview = changes.some((change) => change.classification === 'security-sensitive');
  const regression = conformanceRegression || (options.failOn === 'review' && requiresReview);
  return {
    before: beforeReport.summary,
    after: afterReport.summary,
    changes,
    conformanceRegression,
    requiresReview,
    regression,
  };
}
