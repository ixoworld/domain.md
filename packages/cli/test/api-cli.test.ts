import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  getOracleCapsuleContract,
  getOracleCapsuleJcsVectors,
  getOracleCapsuleSchema,
  getOracleCapsuleSourceLockSchema,
  getRules,
  getSchema,
  getSpecification,
  getTemplateManifestSchema,
  lint,
  parseDomain,
} from '../src/index.js';
import { example, packageRoot, repositoryRoot } from './helpers.js';

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

async function runCli(args: string[], stdin?: Uint8Array | string): Promise<CliResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args], {
      cwd: packageRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      resolvePromise({
        code,
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
      }),
    );
    if (stdin !== undefined) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

describe('public API', () => {
  it('exports parser, linter, spec, schema, template schema, and rules', async () => {
    const source = await example();
    expect(parseDomain(source).ok).toBe(true);
    expect(lint(source).ok).toBe(true);
    expect(getSpecification()).toContain('# domain.md Specification');
    expect(getSchema().$id).toBe('urn:ixo:domain-md:schema:1.0.0-rc.1');
    expect(getTemplateManifestSchema().$id).toContain('template-manifest-schema');
    expect(getOracleCapsuleSchema().$id).toContain('x-oracle-capsule:manifest:0.1.0');
    expect(getOracleCapsuleSourceLockSchema().$id).toContain('source-lock:0.1.0');
    expect(getOracleCapsuleContract()).toContain('static-pass');
    expect((getOracleCapsuleJcsVectors() as { vectors: unknown[] }).vectors.length).toBeGreaterThan(
      7,
    );
    expect(getRules().rules.length).toBeGreaterThan(10);
  });
});

describe('CLI', () => {
  it('reports version and emits schema', async () => {
    expect((await runCli(['--version'])).stdout).toContain('0.1.0');
    const schema = await runCli(['schema']);
    expect(schema.code).toBe(0);
    expect(JSON.parse(schema.stdout)).toHaveProperty('$id');
  });

  it('lints files and stdin with documented exit codes', async () => {
    const path = resolve(repositoryRoot, 'examples/project-authoring/domain.md');
    const file = await runCli(['lint', path, '--format', 'json']);
    expect(file.code).toBe(0);
    expect(JSON.parse(file.stdout)).toHaveProperty('status', 'static-pass');
    const invalid = (await example()).replace('kind: "domain.md"', 'kind: "wrong"');
    const stdin = await runCli(['lint', '-', '--format', 'text'], invalid);
    expect(stdin.code).toBe(1);
    expect(stdin.stdout).toContain('FAIL');
  });

  it('uses exit 2 for malformed UTF-8 input', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'domain-md-cli-'));
    try {
      const path = resolve(root, 'domain.md');
      await writeFile(path, Uint8Array.from([0xff, 0xfe, 0xfd]));
      const result = await runCli(['lint', path]);
      expect(result.code).toBe(2);
      expect(result.stderr).toContain('valid UTF-8');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('distinguishes conformance failures from invocation failures', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'domain-md-cli-exit-'));
    try {
      const invalidPath = resolve(root, 'domain.md');
      await writeFile(invalidPath, (await example()).replace('kind: "domain.md"', 'kind: "wrong"'));
      const refused = await runCli(['export', invalidPath, '--format', 'json']);
      expect(refused.code).toBe(1);
      expect(refused.stderr).toContain('export refused');
      const sarif = await runCli(['export', invalidPath, '--format', 'sarif']);
      expect(sarif.code).toBe(1);
      expect(JSON.parse(sarif.stdout)).toHaveProperty('version', '2.1.0');
      const profile = await runCli(['lint', invalidPath, '--profile', 'unknown']);
      expect(profile.code).toBe(2);
      const validPath = resolve(repositoryRoot, 'examples/project-authoring/domain.md');
      const diff = await runCli(['diff', validPath, validPath, '--fail-on', 'unknown']);
      expect(diff.code).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('uses exit 1 for template integrity failures', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'domain-md-cli-integrity-'));
    try {
      const output = resolve(root, 'rendered');
      const manifest = resolve(repositoryRoot, 'examples/protocol-domain/template-manifest.yaml');
      const params = resolve(repositoryRoot, 'examples/protocol-domain/parameters.json');
      const result = await runCli([
        'init',
        '--manifest',
        manifest,
        '--manifest-sha256',
        '0'.repeat(64),
        '--protocol',
        'did:ixo:entity:protocol:verified-services',
        '--derived-type',
        'project',
        '--params',
        params,
        '--output',
        output,
      ]);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('SHA-256 mismatch');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('renders init atomically and refuses an existing target', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'domain-md-init-'));
    const output = resolve(root, 'rendered');
    try {
      const manifest = resolve(repositoryRoot, 'examples/protocol-domain/template-manifest.yaml');
      const params = resolve(repositoryRoot, 'examples/protocol-domain/parameters.json');
      const args = [
        'init',
        '--manifest',
        manifest,
        '--protocol',
        'did:ixo:entity:protocol:verified-services',
        '--derived-type',
        'project',
        '--params',
        params,
        '--output',
        output,
      ];
      const created = await runCli(args);
      expect(created.code, created.stderr).toBe(0);
      expect(await readFile(resolve(output, 'domain.md'), 'utf8')).toContain(
        'Community Field Services',
      );
      expect(await readFile(resolve(output, 'provenance.yaml'), 'utf8')).toContain(
        'parameters_digest',
      );
      const repeated = await runCli(args);
      expect(repeated.code).toBe(2);
      expect(repeated.stderr).toContain('already exists');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
