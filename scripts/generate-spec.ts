import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANONICAL_SECTIONS,
  EXTERNAL_CHECKS,
  ORACLE_CAPSULE_CONTRACT,
  ORACLE_CAPSULE_EXTERNAL_CHECKS,
  ORACLE_CAPSULE_LIMITS,
  ORACLE_CAPSULE_MEDIA_TYPE,
  ORACLE_CAPSULE_SCHEMA_ID,
  ORACLE_CAPSULE_SOURCE_LOCK_MEDIA_TYPE,
  ORACLE_CAPSULE_SOURCE_LOCK_SCHEMA_ID,
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
  capsuleSchema: resolve(root, 'spec/oracle-capsule.schema.json'),
  capsuleLockSchema: resolve(root, 'spec/oracle-capsule-source-lock.schema.json'),
  capsuleContract: resolve(root, 'spec/oracle-capsule.mdx'),
  capsuleVectors: resolve(root, 'spec/oracle-capsule-jcs-vectors.json'),
  capsuleDocs: resolve(root, 'docs/experimental/x-oracle-capsule/manifest-contract.md'),
  docs: resolve(root, 'docs/spec.md'),
  packageAssets: resolve(root, 'packages/cli/assets'),
  runtimeConstants: resolve(root, 'packages/cli/src/constants.ts'),
  runtimeTypes: resolve(root, 'packages/cli/src/templates/types.ts'),
  packageManifest: resolve(root, 'packages/cli/package.json'),
  parser: resolve(root, 'packages/cli/src/parser.ts'),
  semantic: resolve(root, 'packages/cli/src/semantic.ts'),
  capsuleJson: resolve(root, 'packages/cli/src/capsule/json.ts'),
  capsuleValidate: resolve(root, 'packages/cli/src/capsule/validate.ts'),
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

async function assertInputs(): Promise<{
  source: string;
  schema: string;
  templateSchema: string;
  capsuleSchema: string;
  capsuleLockSchema: string;
  capsuleContract: string;
  capsuleVectors: string;
}> {
  const [
    source,
    schema,
    templateSchema,
    capsuleSchema,
    capsuleLockSchema,
    capsuleContract,
    capsuleVectors,
    runtimeConstants,
    runtimeTypes,
    packageManifest,
    parser,
    semantic,
    capsuleJson,
    capsuleValidate,
    license,
    notice,
  ] = await Promise.all([
    readFile(paths.source, 'utf8'),
    readFile(paths.schema, 'utf8'),
    readFile(paths.templateSchema, 'utf8'),
    readFile(paths.capsuleSchema, 'utf8'),
    readFile(paths.capsuleLockSchema, 'utf8'),
    readFile(paths.capsuleContract, 'utf8'),
    readFile(paths.capsuleVectors, 'utf8'),
    readFile(paths.runtimeConstants, 'utf8'),
    readFile(paths.runtimeTypes, 'utf8'),
    readFile(paths.packageManifest, 'utf8'),
    readFile(paths.parser, 'utf8'),
    readFile(paths.semantic, 'utf8'),
    readFile(paths.capsuleJson, 'utf8'),
    readFile(paths.capsuleValidate, 'utf8'),
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
  const capsuleJsonSchema = JSON.parse(capsuleSchema) as { $id?: string };
  const capsuleLockJsonSchema = JSON.parse(capsuleLockSchema) as { $id?: string };
  const capsuleVectorJson = JSON.parse(capsuleVectors) as {
    contract?: string;
    vectors?: unknown[];
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
  if (capsuleJsonSchema.$id !== ORACLE_CAPSULE_SCHEMA_ID)
    throw new Error('Oracle Capsule schema $id does not match spec/config.ts');
  if (capsuleLockJsonSchema.$id !== ORACLE_CAPSULE_SOURCE_LOCK_SCHEMA_ID)
    throw new Error('Oracle Capsule source-lock schema $id does not match spec/config.ts');
  if (
    capsuleVectorJson.contract !== 'urn:ixo:domain-md:x-oracle-capsule:jcs-vectors:0.1.0' ||
    !Array.isArray(capsuleVectorJson.vectors) ||
    capsuleVectorJson.vectors.length < 8
  ) {
    throw new Error('Oracle Capsule JCS vector identity or corpus is incomplete');
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
  for (const value of [
    ORACLE_CAPSULE_CONTRACT,
    ORACLE_CAPSULE_SCHEMA_ID,
    ORACLE_CAPSULE_SOURCE_LOCK_SCHEMA_ID,
    ORACLE_CAPSULE_MEDIA_TYPE,
    ORACLE_CAPSULE_SOURCE_LOCK_MEDIA_TYPE,
    ...ORACLE_CAPSULE_EXTERNAL_CHECKS,
    ...Object.values(ORACLE_CAPSULE_LIMITS),
  ]) {
    if (!runtimeConstants.replaceAll('_', '').includes(String(value)))
      throw new Error(`runtime constants are missing Oracle Capsule value ${value}`);
  }
  const registered = new Set(RULES.map((rule) => rule.code));
  if (registered.size !== RULES.length)
    throw new Error('spec/rules.ts contains duplicate rule codes');
  const active = new Set(
    [
      ...parser.matchAll(/finding\('([a-z][a-z0-9-]+)'/g),
      ...semantic.matchAll(/add\(findings,\s*'(?:error|warning|info)',\s*'([a-z][a-z0-9-]+)'/g),
      ...capsuleJson.matchAll(/'((?:capsule)-[a-z0-9-]+)'/g),
      ...capsuleValidate.matchAll(/'((?:capsule)-[a-z0-9-]+)'/g),
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
  return {
    source,
    schema,
    templateSchema,
    capsuleSchema,
    capsuleLockSchema,
    capsuleContract,
    capsuleVectors,
  };
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
  const {
    source,
    schema,
    templateSchema,
    capsuleSchema,
    capsuleLockSchema,
    capsuleContract,
    capsuleVectors,
  } = await assertInputs();
  const marker = '<!-- DOMAIN_MD_ACTIVE_RULES -->';
  if (!source.includes(marker)) throw new Error(`missing ${marker} in spec/spec.mdx`);
  const header = `<!-- Generated from spec/spec.mdx and spec/rules.ts | version: ${SPEC_VERSION} -->\n<!-- Do not edit directly. Run npm run spec:generate. -->\n\n`;
  const generated = header + source.replace(marker, rulesTable());
  const capsuleGenerated =
    `<!-- Generated from spec/oracle-capsule.mdx | schema: ${ORACLE_CAPSULE_SCHEMA_ID} -->\n` +
    '<!-- Do not edit directly. Run npm run spec:generate. -->\n\n' +
    capsuleContract;
  const rules = `${JSON.stringify({ specVersion: SPEC_VERSION, rules: RULES }, null, 2)}\n`;

  await Promise.all([
    compareOrWrite(paths.docs, generated),
    compareOrWrite(resolve(paths.packageAssets, 'spec.md'), generated),
    compareOrWrite(resolve(paths.packageAssets, 'domain-md.schema.json'), schema),
    compareOrWrite(resolve(paths.packageAssets, 'template-manifest.schema.json'), templateSchema),
    compareOrWrite(paths.capsuleDocs, capsuleGenerated),
    compareOrWrite(resolve(paths.packageAssets, 'oracle-capsule.schema.json'), capsuleSchema),
    compareOrWrite(
      resolve(paths.packageAssets, 'oracle-capsule-source-lock.schema.json'),
      capsuleLockSchema,
    ),
    compareOrWrite(
      resolve(paths.packageAssets, 'oracle-capsule-manifest-contract.md'),
      capsuleGenerated,
    ),
    compareOrWrite(resolve(paths.packageAssets, 'oracle-capsule-jcs-vectors.json'), capsuleVectors),
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
