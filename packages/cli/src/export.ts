import { lint } from './lint.js';
import { toSarif } from './sarif.js';
import type { ExportOptions } from './types.js';

export function exportDomain(content: string, options: ExportOptions): string {
  const report = lint(
    content,
    options.sourceName === undefined ? {} : { sourceName: options.sourceName },
  );
  if (options.format === 'sarif') return `${JSON.stringify(toSarif(report), null, 2)}\n`;
  if (!report.ok || !report.document)
    throw new Error('Cannot export a JSON model while conformance errors remain.');
  return `${JSON.stringify(
    {
      specVersion: report.specVersion,
      profile: report.profile,
      frontmatter: report.document.frontmatter,
      sections: report.document.sections.map(({ heading, content, location }) => ({
        heading,
        content,
        location,
      })),
      note: 'This normalized model is not CID-canonical bytes.',
    },
    null,
    2,
  )}\n`;
}
