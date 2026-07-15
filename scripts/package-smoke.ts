import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const npmCli = (() => {
  const value = process.env.npm_execpath;
  if (!value) throw new Error('npm_execpath is required; run this smoke test through npm.');
  return value;
})();
const temporary = await mkdtemp(join(tmpdir(), 'domain-md-pack-'));

interface PackResult {
  filename: string;
  files: Array<{ path: string }>;
}

function packResults(value: unknown): PackResult[] {
  if (!Array.isArray(value)) throw new Error('npm pack did not return an array.');
  return value as PackResult[];
}

function runNpm(args: string[], cwd: string) {
  return execFile(process.execPath, [npmCli, ...args], { cwd });
}

try {
  const { stdout } = await runNpm(
    ['pack', '--workspace', '@ixo/domain.md', '--pack-destination', temporary, '--json'],
    root,
  );
  const packed = packResults(JSON.parse(stdout) as unknown)[0];
  if (!packed) throw new Error('npm pack did not produce a tarball.');
  const paths = new Set(packed.files.map((file) => file.path));
  for (const expected of [
    'assets/spec.md',
    'assets/domain-md.schema.json',
    'assets/template-manifest.schema.json',
    'assets/rules.json',
    'dist/cli.js',
    'dist/index.js',
    'LICENSE',
    'NOTICE',
    'README.md',
  ]) {
    if (!paths.has(expected)) throw new Error(`Packed package is missing ${expected}.`);
  }
  if ([...paths].some((path) => path.startsWith('src/') || path.startsWith('test/'))) {
    throw new Error('Packed package contains development source or tests.');
  }

  await writeFile(
    join(temporary, 'package.json'),
    JSON.stringify({ name: 'domain-md-smoke', private: true, type: 'module' }),
  );
  await runNpm(
    ['install', join(temporary, packed.filename), '--ignore-scripts', '--no-audit', '--no-fund'],
    temporary,
  );

  const installedPackage = JSON.parse(
    await readFile(join(temporary, 'node_modules/@ixo/domain.md/package.json'), 'utf8'),
  ) as { bin?: Record<string, string>; version?: string };
  if (installedPackage.version !== '0.1.0') throw new Error('Packed package version drifted.');
  if (
    installedPackage.bin?.['domain.md'] !== './dist/cli.js' ||
    installedPackage.bin.domainmd !== './dist/cli.js'
  ) {
    throw new Error('Packed package does not expose both CLI aliases.');
  }
  const shimSuffix = process.platform === 'win32' ? '.cmd' : '';
  await Promise.all([
    stat(join(temporary, 'node_modules/.bin', `domain.md${shimSuffix}`)),
    stat(join(temporary, 'node_modules/.bin', `domainmd${shimSuffix}`)),
  ]);

  const smokeProgram = [
    "import * as api from '@ixo/domain.md';",
    "const required = ['parseDomain','lint','diffDomains','exportDomain','renderTemplateBundle','getSpecification','getSchema','getRules'];",
    "for (const name of required) if (typeof api[name] !== 'function') throw new Error(`missing export ${name}`);",
    "if (!api.getSpecification().includes('1.0.0-rc.1')) throw new Error('spec asset mismatch');",
    "if (api.getSchema().$id !== 'urn:ixo:domain-md:schema:1.0.0-rc.1') throw new Error('schema asset mismatch');",
  ].join('\n');
  await execFile(process.execPath, ['--input-type=module', '--eval', smokeProgram], {
    cwd: temporary,
  });

  const cli = join(temporary, 'node_modules/@ixo/domain.md/dist/cli.js');
  const version = await execFile(process.execPath, [cli, '--version'], { cwd: temporary });
  if (version.stdout.trim() !== '0.1.0') throw new Error('Packed CLI version mismatch.');
  const schema = await execFile(process.execPath, [cli, 'schema'], { cwd: temporary });
  if (!schema.stdout.includes('urn:ixo:domain-md:schema:1.0.0-rc.1'))
    throw new Error('Packed CLI schema mismatch.');

  console.log(`Packed-package smoke test passed on ${process.platform}/${process.arch}.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
