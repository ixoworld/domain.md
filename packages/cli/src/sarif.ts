import type { Finding, LintReport } from './types.js';

function level(finding: Finding): 'error' | 'warning' | 'note' {
  return finding.severity === 'info' ? 'note' : finding.severity;
}

export function toSarif(report: LintReport): Record<string, unknown> {
  const ruleMap = new Map(report.findings.map((finding) => [finding.code, finding]));
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: report.tool,
            version: report.toolVersion,
            rules: [...ruleMap.entries()].map(([id, finding]) => ({
              id,
              shortDescription: { text: finding.message },
            })),
          },
        },
        results: report.findings.map((finding) => ({
          ruleId: finding.code,
          level: level(finding),
          message: { text: finding.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: report.sourceName },
                region: {
                  startLine: finding.location.line,
                  startColumn: finding.location.column,
                  ...(finding.location.endLine === undefined
                    ? {}
                    : { endLine: finding.location.endLine }),
                  ...(finding.location.endColumn === undefined
                    ? {}
                    : { endColumn: finding.location.endColumn }),
                },
              },
            },
          ],
        })),
      },
    ],
  };
}
