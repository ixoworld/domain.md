import { EXTERNAL_CHECKS, PACKAGE_VERSION, SPEC_VERSION } from './constants.js';
import { parseDomain } from './parser.js';
import { getProfile, inferMode, validateSemantics } from './semantic.js';
import type { Finding, FindingSummary, LintOptions, LintReport } from './types.js';

function summarize(findings: Finding[]): FindingSummary {
  return {
    errors: findings.filter((item) => item.severity === 'error').length,
    warnings: findings.filter((item) => item.severity === 'warning').length,
    infos: findings.filter((item) => item.severity === 'info').length,
  };
}

export function lint(content: string, options: LintOptions = {}): LintReport {
  const parsed = parseDomain(content, options);
  const findings = [...parsed.findings];
  if (parsed.document)
    findings.push(...validateSemantics(parsed.document, options.expectedProfile));
  const summary = summarize(findings);
  const profile = parsed.document ? getProfile(parsed.document.frontmatter) : null;
  const externalChecksRequired =
    profile === 'persisted_draft'
      ? EXTERNAL_CHECKS.filter((check) => check.code === 'cid-verification')
      : profile === 'anchored' || profile === 'runtime'
        ? [...EXTERNAL_CHECKS]
        : [];
  const result: LintReport = {
    tool: '@ixo/domain.md',
    toolVersion: PACKAGE_VERSION,
    specVersion: SPEC_VERSION,
    sourceName: options.sourceName ?? '<memory>',
    mode: parsed.document ? inferMode(parsed.document.frontmatter) : null,
    profile,
    status: summary.errors === 0 ? 'static-pass' : 'fail',
    ok: summary.errors === 0,
    summary,
    findings,
    externalChecksRequired,
  };
  if (parsed.document) result.document = parsed.document;
  return result;
}
