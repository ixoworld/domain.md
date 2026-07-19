import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { lint, renderTemplateBundle, validateOracleCapsule } from '../packages/cli/src/index.js';

const examples = [
  ['project-authoring', 'derived'],
  ['protocol-domain', 'protocol'],
  ['service-domain', 'derived'],
] as const;

for (const [name, expectedMode] of examples) {
  const path = resolve('examples', name, 'domain.md');
  const report = lint(await readFile(path, 'utf8'), {
    sourceName: path,
    expectedProfile: 'authoring_draft',
  });
  if (!report.ok || report.mode !== expectedMode) {
    throw new Error(`${name} failed: ${JSON.stringify(report.findings, null, 2)}`);
  }
}

const manifestPath = resolve('examples/protocol-domain/template-manifest.yaml');
const parameters = JSON.parse(
  await readFile(resolve('examples/protocol-domain/parameters.json'), 'utf8'),
) as Record<string, unknown>;
const request = {
  manifestUri: pathToFileURL(manifestPath).href,
  expectedProtocol: 'did:ixo:entity:protocol:verified-services',
  derivedType: 'project' as const,
  parameters,
};
const first = await renderTemplateBundle(request);
const second = await renderTemplateBundle(request);
if (!first.report.ok || first.files.length === 0)
  throw new Error('Protocol template example failed to render.');
if (first.files[0]?.sha256 !== second.files[0]?.sha256)
  throw new Error('Protocol template rendering is not deterministic.');

const capsuleRoot = resolve('examples/oracle-capsule');
const [minimalCapsule, fullCapsule, sourceLock, masterSkill] = await Promise.all([
  readFile(resolve(capsuleRoot, 'minimal.manifest.json'), 'utf8'),
  readFile(resolve(capsuleRoot, 'full.manifest.json'), 'utf8'),
  readFile(resolve(capsuleRoot, 'master.source-lock.json'), 'utf8'),
  readFile(resolve(capsuleRoot, 'master/SKILL.md'), 'utf8'),
]);
for (const [name, content] of [
  ['minimal', minimalCapsule],
  ['full', fullCapsule],
] as const) {
  const report = validateOracleCapsule(content, {
    sourceName: `${name}.manifest.json`,
    sourceLock,
    lockedFiles: { 'SKILL.md': masterSkill },
  });
  if (!report.ok)
    throw new Error(`${name} Oracle Capsule failed: ${JSON.stringify(report.findings, null, 2)}`);
}

console.log(
  `Validated ${examples.length} domain examples, one deterministic protocol template bundle, and two Oracle Capsule releases.`,
);
