import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { expect, it } from 'vitest';
import { lint, validateOracleCapsule } from '../src/workers.js';

it('bundles the shared validators without filesystem or dynamic schema compilation', async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/workers.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    metafile: true,
  });
  const imports = Object.values(result.metafile.inputs).flatMap((input) =>
    input.imports.map((item) => item.path),
  );
  expect(imports).not.toContain('node:fs');
  expect(imports.some((path) => path.includes('ajv/dist/compile'))).toBe(false);
  const report = lint(
    readFileSync(new URL('../../../examples/project-authoring/domain.md', import.meta.url), 'utf8'),
  );
  expect(report.ok).toBe(true);
  const capsule = validateOracleCapsule(
    readFileSync(
      new URL('../../../examples/oracle-capsule/minimal.manifest.json', import.meta.url),
      'utf8',
    ),
  );
  expect(capsule.ok).toBe(true);
  expect(capsule.externalChecksRequired.length).toBeGreaterThan(0);
});
