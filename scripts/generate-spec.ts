import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANONICAL_SECTIONS,
  EXTERNAL_CHECKS,
  SCHEMA_ID,
  SPEC_VERSION,
  TEMPLATE_SCHEMA_ID,
} from '../spec/config.js';
import { RULES } from '../spec/rules.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const paths = {
  source: resolve(root, 'spec/spec.mdx'),
  schema: resolve(root, 'spec/domain-md.schema.json'),
  templateSchema: resolve(root, 'spec/template-manifest.schema.json'),
  docs: resolve(root, 'docs/spec.md'),
  packageAssets: resolve(root, 'packages/cli/assets'),
  runtimeConstants: resolve(root, 'packages/cli/src/constants.ts'),
  runtimeTypes: resolve(root, 'packages/cli/src/templates/types.ts'),
  packageManifest: resolve(root, 'packages/cli/package.json'),
  parser: resolve(root, 'packages/cli/src/parser.ts'),
  semantic: resolve(root, 'packages/cli/src/semantic.ts'),
  license: resolve(root, 'LICENSE'),
  notice: resolve(root, 'NOTICE'),
  packageLicense: resolve(root, 'packages/cli/LICENSE'),
  packageNotice: resolve(root, 'packages/cli/NOTICE'),
};

function rulesTable(): string {
  return [
    '| Code | Severity | Description |',
    '| --- | --- | --- |',
    ...RULES.map((rule) => `| \`${rule.code}\` | ${rule.severity} | ${rule.description} |`),
  ].join('\n');
}

async function assertInputs(): Promise<{ source: string; schema: string; templateSchema: string }> {
  const [
    source,
    schema,
    templateSchema,
    runtimeConstants,
    runtimeTypes,
    packageManifest,
    parser,
    semantic,
    license,
    notice,
  ] = await Promise.all([
    readFile(paths.source, 'utf8'),
    readFile(paths.schema, 'utf8'),
    readFile(paths.templateSchema, 'utf8'),
    readFile(paths.runtimeConstants, 'utf8'),
    readFile(paths.runtimeTypes, 'utf8'),
    readFile(paths.packageManifest, 'utf8'),
    readFile(paths.parser, 'utf8'),
    readFile(paths.semantic, 'utf8'),
    readFile(paths.license, 'utf8'),
    readFile(paths.notice, 'utf8'),
  ]);
  const schemaJson = JSON.parse(schema) as {
    $id?: string;
    properties?: { version?: { const?: string } };
  };
  const templateJson = JSON.parse(templateSchema) as {
    $id?: string;
    properties?: { version?: { const?: string } };
  };
  if (schemaJson.$id !== SCHEMA_ID || schemaJson.properties?.version?.const !== SPEC_VERSION) {
    throw new Error('domain schema version or $id does not match spec/config.ts');
  }
  if (
    templateJson.$id !== TEMPLATE_SCHEMA_ID ||
    templateJson.properties?.version?.const !== SPEC_VERSION
  ) {
    throw new Error('template schema version or $id does not match spec/config.ts');
  }
  if (!source.includes(`Specification version** | \`${SPEC_VERSION}\``)) {
    throw new Error('specification source does not declare the configured version');
  }
  const packageJson = JSON.parse(packageManifest) as { version?: string };
  if (!runtimeConstants.includes(`PACKAGE_VERSION = '${packageJson.version}'`)) {
    throw new Error('runtime package version does not match packages/cli/package.json');
  }
  if (
    !runtimeConstants.includes(`SPEC_VERSION = '${SPEC_VERSION}'`) ||
    !runtimeTypes.includes(`version: '${SPEC_VERSION}'`)
  ) {
    throw new Error('runtime specification version constants do not match spec/config.ts');
  }
  for (const value of [...CANONICAL_SECTIONS, ...EXTERNAL_CHECKS]) {
    if (!runtimeConstants.includes(value)) {
      throw new Error(`runtime constants are missing canonical specification value ${value}`);
    }
  }
  const registered = new Set(RULES.map((rule) => rule.code));
  if (registered.size !== RULES.length)
    throw new Error('spec/rules.ts contains duplicate rule codes');
  const active = new Set(
    [
      ...parser.matchAll(/finding\('([a-z][a-z0-9-]+)'/g),
      ...semantic.matchAll(/add\(findings,\s*'(?:error|warning|info)',\s*'([a-z][a-z0-9-]+)'/g),
    ]
      .map((match) => match[1])
      .filter((code): code is string => code !== undefined),
  );
  const missingRules = [...active].filter((code) => !registered.has(code));
  if (missingRules.length > 0)
    throw new Error(`active finding codes missing from spec/rules.ts: ${missingRules.join(', ')}`);
  await Promise.all([
    compareOrWrite(paths.packageLicense, license),
    compareOrWrite(paths.packageNotice, notice),
  ]);
  return { source, schema, templateSchema };
}

async function compareOrWrite(path: string, content: string): Promise<void> {
  if (check) {
    const existing = await readFile(path, 'utf8').catch(() => '');
    if (existing !== content) throw new Error(`${path} is out of date; run npm run spec:generate`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

async function main(): Promise<void> {
  const { source, schema, templateSchema } = await assertInputs();
  const marker = '<!-- DOMAIN_MD_ACTIVE_RULES -->';
  if (!source.includes(marker)) throw new Error(`missing ${marker} in spec/spec.mdx`);
  const header = `<!-- Generated from spec/spec.mdx and spec/rules.ts | version: ${SPEC_VERSION} -->\n<!-- Do not edit directly. Run npm run spec:generate. -->\n\n`;
  const generated = header + source.replace(marker, rulesTable());
  const rules = `${JSON.stringify({ specVersion: SPEC_VERSION, rules: RULES }, null, 2)}\n`;

  await Promise.all([
    compareOrWrite(paths.docs, generated),
    compareOrWrite(resolve(paths.packageAssets, 'spec.md'), generated),
    compareOrWrite(resolve(paths.packageAssets, 'domain-md.schema.json'), schema),
    compareOrWrite(resolve(paths.packageAssets, 'template-manifest.schema.json'), templateSchema),
    compareOrWrite(resolve(paths.packageAssets, 'rules.json'), rules),
  ]);
  console.log(
    check ? 'Specification artifacts are current.' : 'Generated specification artifacts.',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
