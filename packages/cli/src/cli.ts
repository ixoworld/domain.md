#!/usr/bin/env node
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { defineCommand, runCommand, showUsage } from 'citty';
import { isAlias, parseDocument, visit as visitYaml } from 'yaml';

import {
  MAX_DOMAIN_BYTES,
  MAX_LINKED_BYTES,
  MAX_SCALAR_LENGTH,
  MAX_YAML_DEPTH,
  MAX_YAML_NODES,
  PACKAGE_VERSION,
} from './constants.js';
import { diffDomains } from './diff.js';
import { exportDomain } from './export.js';
import { lint } from './lint.js';
import { toSarif } from './sarif.js';
import { getRules, getSchemaSource, getSpecification } from './spec.js';
import { TemplateValidationError } from './templates/errors.js';
import { renderTemplateBundle } from './templates/render.js';
import type { TemplateDerivedType } from './templates/types.js';
import type { ConformanceProfile, Finding, LintReport } from './types.js';

class InputError extends Error {}
class ConformanceError extends Error {}

function stdinBytes(maxBytes: number): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    process.stdin.on('data', (chunk: Buffer | string) => {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += bytes.length;
      if (size > maxBytes) {
        process.stdin.pause();
        reject(new InputError(`Standard input exceeds ${maxBytes} bytes.`));
        return;
      }
      chunks.push(bytes);
    });
    process.stdin.once('end', () => resolvePromise(Buffer.concat(chunks)));
    process.stdin.once('error', reject);
  });
}

async function readInput(input: string): Promise<{ content: string; sourceName: string }> {
  let bytes: Uint8Array;
  let sourceName = input;
  if (input === '-') bytes = await stdinBytes(MAX_DOMAIN_BYTES);
  else {
    let path = resolve(input);
    let stat = await lstat(path).catch(() => undefined);
    if (!stat) throw new InputError(`Input does not exist: ${input}`);
    if (stat.isSymbolicLink()) throw new InputError(`Symlink inputs are forbidden: ${input}`);
    if (stat.isDirectory()) {
      path = join(path, 'domain.md');
      stat = await lstat(path).catch(() => undefined);
    }
    if (!stat?.isFile() || stat.isSymbolicLink())
      throw new InputError(`Expected a regular domain.md file: ${input}`);
    if (stat.size > MAX_DOMAIN_BYTES)
      throw new InputError(`Input exceeds ${MAX_DOMAIN_BYTES} bytes: ${input}`);
    bytes = await readFile(path);
    sourceName = path;
  }
  try {
    return { content: new TextDecoder('utf-8', { fatal: true }).decode(bytes), sourceName };
  } catch {
    throw new InputError(`Input is not valid UTF-8: ${sourceName}`);
  }
}

function textReport(report: LintReport): string {
  const lines = report.findings.map((item) => {
    const location = item.path ? ` ${item.path}` : '';
    return `${item.severity.toUpperCase()} ${item.code}${location}: ${item.message}`;
  });
  lines.push(
    `${report.ok ? 'STATIC PASS' : 'FAIL'}: ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.infos} info`,
  );
  if (report.externalChecksRequired.length > 0) {
    lines.push(
      `External checks required: ${report.externalChecksRequired.map((check) => check.code).join(', ')}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function outputLint(report: LintReport, format: string): string {
  if (format === 'json') return `${JSON.stringify(report, null, 2)}\n`;
  if (format === 'sarif') return `${JSON.stringify(toSarif(report), null, 2)}\n`;
  if (format === 'text') return textReport(report);
  throw new InputError(`Unsupported format ${format}.`);
}

const lintCommand = defineCommand({
  meta: { name: 'lint', description: 'Statically validate a domain.md file or package.' },
  args: {
    input: {
      type: 'positional',
      required: true,
      description: 'File, package directory, or - for stdin',
    },
    format: { type: 'string', default: 'json', description: 'json, text, or sarif' },
    profile: {
      type: 'string',
      description: 'Assert authoring_draft, persisted_draft, anchored, or runtime',
    },
  },
  async run({ args }) {
    const input = await readInput(args.input);
    const validProfiles: ConformanceProfile[] = [
      'authoring_draft',
      'persisted_draft',
      'anchored',
      'runtime',
    ];
    if (args.profile !== undefined && !validProfiles.includes(args.profile as ConformanceProfile)) {
      throw new InputError(`Unsupported profile ${args.profile}.`);
    }
    const profile = args.profile as ConformanceProfile | undefined;
    const report = lint(input.content, {
      sourceName: input.sourceName,
      ...(profile === undefined ? {} : { expectedProfile: profile }),
    });
    process.stdout.write(outputLint(report, args.format));
    process.exitCode = report.ok ? 0 : 1;
  },
});

const diffCommand = defineCommand({
  meta: { name: 'diff', description: 'Compare domain.md documents and classify changes.' },
  args: {
    before: { type: 'positional', required: true },
    after: { type: 'positional', required: true },
    format: { type: 'string', default: 'json', description: 'json or text' },
    failOn: { type: 'string', default: 'regression', description: 'regression or review' },
  },
  async run({ args }) {
    const [before, after] = await Promise.all([readInput(args.before), readInput(args.after)]);
    if (args.failOn !== 'regression' && args.failOn !== 'review')
      throw new InputError(`Unsupported fail-on mode ${args.failOn}.`);
    const failOn = args.failOn === 'review' ? 'review' : 'regression';
    const report = diffDomains(before.content, after.content, { failOn });
    if (args.format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else if (args.format === 'text') {
      const lines = report.changes.map(
        (change) => `${change.classification.toUpperCase()} ${change.path}`,
      );
      lines.push(
        `Regression: ${report.conformanceRegression}; review required: ${report.requiresReview}`,
      );
      process.stdout.write(`${lines.join('\n')}\n`);
    } else throw new InputError(`Unsupported format ${args.format}.`);
    process.exitCode = report.regression ? 1 : 0;
  },
});

const exportCommand = defineCommand({
  meta: { name: 'export', description: 'Export a parsed JSON model or SARIF conformance report.' },
  args: {
    input: { type: 'positional', required: true },
    format: { type: 'string', required: true, description: 'json or sarif' },
  },
  async run({ args }) {
    if (args.format !== 'json' && args.format !== 'sarif')
      throw new InputError('Export format must be json or sarif.');
    const input = await readInput(args.input);
    const report = lint(input.content, { sourceName: input.sourceName });
    if (args.format === 'json' && !report.ok) {
      throw new ConformanceError(
        `JSON model export refused: ${report.summary.errors} conformance error(s) remain.`,
      );
    }
    process.stdout.write(
      exportDomain(input.content, { format: args.format, sourceName: input.sourceName }),
    );
    process.exitCode = report.ok ? 0 : 1;
  },
});

const specCommand = defineCommand({
  meta: { name: 'spec', description: 'Output the bundled domain.md specification.' },
  args: {
    format: { type: 'string', default: 'markdown', description: 'markdown or json' },
    rules: { type: 'boolean', default: false },
  },
  run({ args }) {
    if (args.format === 'markdown') {
      process.stdout.write(getSpecification());
      if (args.rules) process.stdout.write(`\n\n${JSON.stringify(getRules(), null, 2)}\n`);
    } else if (args.format === 'json') {
      process.stdout.write(
        `${JSON.stringify({ specification: getSpecification(), ...(args.rules ? { rules: getRules().rules } : {}) }, null, 2)}\n`,
      );
    } else throw new InputError(`Unsupported format ${args.format}.`);
  },
});

const schemaCommand = defineCommand({
  meta: { name: 'schema', description: 'Output the matching domain.md JSON Schema.' },
  run() {
    process.stdout.write(getSchemaSource());
  },
});

async function parseParameters(path: string): Promise<Record<string, unknown>> {
  let bytes: Uint8Array;
  if (path === '-') bytes = await stdinBytes(MAX_LINKED_BYTES);
  else {
    const parameterPath = resolve(path);
    const stat = await lstat(parameterPath).catch(() => undefined);
    if (!stat?.isFile() || stat.isSymbolicLink())
      throw new InputError(`Expected a regular parameter file: ${path}`);
    if (stat.size > MAX_LINKED_BYTES)
      throw new InputError(`Parameter file exceeds ${MAX_LINKED_BYTES} bytes: ${path}`);
    bytes = await readFile(parameterPath);
  }
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const document = parseDocument(source, { prettyErrors: true, uniqueKeys: true, version: '1.2' });
  if (document.errors.length > 0 || document.warnings.length > 0)
    throw new InputError('Parameter file contains invalid or unsafe YAML/JSON.');
  let unsafe = false;
  let nodes = 0;
  let depth = 0;
  let scalarTooLong = false;
  visitYaml(document, {
    Node(_key, node, parents) {
      const candidate = node as { anchor?: string; tag?: string; value?: unknown };
      nodes += 1;
      depth = Math.max(depth, parents.length + 1);
      if (typeof candidate.value === 'string' && candidate.value.length > MAX_SCALAR_LENGTH)
        scalarTooLong = true;
      if (isAlias(node) || candidate.anchor || candidate.tag?.startsWith('!')) unsafe = true;
    },
    Pair(_key, pair) {
      const key = pair.key as { value?: unknown } | null;
      if (key?.value === '<<') unsafe = true;
    },
  });
  if (unsafe)
    throw new InputError('Parameter file contains aliases, anchors, merge keys, or custom tags.');
  if (nodes > MAX_YAML_NODES || depth > MAX_YAML_DEPTH || scalarTooLong) {
    throw new InputError('Parameter file exceeds YAML node, depth, or scalar limits.');
  }
  const value: unknown = document.toJS({ maxAliasCount: 0 });
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new InputError('Parameters must be a mapping.');
  return value as Record<string, unknown>;
}

function safeOutputPath(root: string, relativePath: string): string {
  const target = resolve(root, relativePath);
  const fromRoot = relative(resolve(root), target);
  if (
    fromRoot === '' ||
    fromRoot === '..' ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    throw new InputError(`Rendered path escapes output root: ${relativePath}`);
  }
  return target;
}

const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Render a verified protocol template bundle into an authoring draft.',
  },
  args: {
    manifest: { type: 'string', required: true },
    protocol: { type: 'string', required: true },
    derivedType: { type: 'string', required: true },
    params: { type: 'string', required: true, description: 'JSON/YAML path or -' },
    output: { type: 'string', required: true },
    manifestSha256: { type: 'string' },
    manifestCid: { type: 'string' },
    ipfsGateway: { type: 'string' },
  },
  async run({ args }) {
    const output = resolve(args.output);
    if (
      await lstat(output).then(
        () => true,
        () => false,
      )
    )
      throw new InputError(`Output already exists: ${output}`);
    const manifestUri = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(args.manifest)
      ? args.manifest
      : pathToFileURL(resolve(args.manifest)).href;
    const derivedTypes: TemplateDerivedType[] = [
      'dao',
      'organisation',
      'project',
      'asset',
      'deed',
      'investment',
      'oracle',
      'service',
      'dataset',
      'device',
      'place',
      'portfolio',
      'marketplace',
      'pod',
      'claim_collection',
      'custom',
    ];
    if (!derivedTypes.includes(args.derivedType as TemplateDerivedType)) {
      throw new InputError(`Unsupported derived type ${args.derivedType}.`);
    }
    const derivedType = args.derivedType as TemplateDerivedType;
    let result;
    try {
      result = await renderTemplateBundle({
        manifestUri,
        expectedProtocol: args.protocol,
        derivedType,
        parameters: await parseParameters(args.params),
        ...(args.manifestSha256 ? { manifestSha256: args.manifestSha256 } : {}),
        ...(args.manifestCid ? { manifestCid: args.manifestCid } : {}),
        ...(args.ipfsGateway ? { ipfsGateway: args.ipfsGateway } : {}),
      });
    } catch (error) {
      if (error instanceof TemplateValidationError) throw new ConformanceError(error.message);
      throw error;
    }
    const parent = dirname(output);
    await mkdir(parent, { recursive: true });
    const temporary = await mkdtemp(join(parent, `.${basename(output)}-`));
    try {
      for (const file of result.files) {
        const target = safeOutputPath(temporary, file.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, file.bytes, { flag: 'wx' });
      }
      await writeFile(join(temporary, 'provenance.yaml'), result.provenance, { flag: 'wx' });
      if ((await readdir(temporary)).length === 0)
        throw new InputError('Renderer produced no files.');
      await rename(temporary, output);
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    }
    process.stdout.write(
      `${JSON.stringify(
        {
          state: 'authoring_draft',
          output,
          files: result.files.map((file) => ({
            path: file.path,
            role: file.role,
            sha256: file.sha256,
          })),
          validation: result.report.summary,
        },
        null,
        2,
      )}\n`,
    );
  },
});

const main = defineCommand({
  meta: {
    name: 'domain.md',
    version: PACKAGE_VERSION,
    description:
      'Authority-aware specification, validation, diff, export, and template tooling for domain.md.',
  },
  subCommands: {
    lint: lintCommand,
    diff: diffCommand,
    export: exportCommand,
    spec: specCommand,
    schema: schemaCommand,
    init: initCommand,
  },
});

async function execute(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--help') || rawArgs.includes('-h') || rawArgs.length === 0) {
    await showUsage(main);
    return;
  }
  if (rawArgs.length === 1 && (rawArgs[0] === '--version' || rawArgs[0] === '-v')) {
    process.stdout.write(`${PACKAGE_VERSION}\n`);
    return;
  }
  await runCommand(main, { rawArgs });
}

execute().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = error instanceof ConformanceError ? 1 : 2;
});

export type { Finding };
