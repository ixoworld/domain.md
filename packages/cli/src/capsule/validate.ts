import { createHash } from 'node:crypto';

import type { Ajv as AjvCore, ErrorObject, Options } from 'ajv';
import Ajv2020Import, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';

import {
  ORACLE_CAPSULE_CONTRACT,
  ORACLE_CAPSULE_EXTERNAL_CHECKS,
  ORACLE_CAPSULE_LIMITS,
} from '../constants.js';
import { getOracleCapsuleSchema, getOracleCapsuleSourceLockSchema } from '../spec.js';
import type { DomainRecord, Finding, SourceLocation } from '../types.js';
import { oracleCapsuleReleaseDigest } from './canonical.js';
import { parseCapsuleJson } from './json.js';
import type {
  CapsuleExternalCheck,
  CapsuleValidationOptions,
  CapsuleValidationReport,
  JsonValue,
  StrictJsonDocument,
} from './types.js';

const Ajv2020 = Ajv2020Import as unknown as new (options?: Options) => AjvCore;
const addFormats = addFormatsImport as unknown as (ajv: AjvCore) => AjvCore;

function compile(schema: DomainRecord): ValidateFunction {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

let manifestValidator: ValidateFunction | undefined;
let lockValidator: ValidateFunction | undefined;

function validateManifestSchema(): ValidateFunction {
  manifestValidator ??= compile(getOracleCapsuleSchema());
  return manifestValidator;
}

function validateLockSchema(): ValidateFunction {
  lockValidator ??= compile(getOracleCapsuleSourceLockSchema());
  return lockValidator;
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pointerSegment(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function location(document: StrictJsonDocument, path: string): SourceLocation {
  let candidate = path.length > 0 ? path : '/';
  while (candidate !== '/') {
    const found = document.locations.get(candidate);
    if (found) return found;
    candidate = candidate.slice(0, candidate.lastIndexOf('/')) || '/';
  }
  return document.locations.get('/') ?? { line: 1, column: 1 };
}

function add(
  findings: Finding[],
  document: StrictJsonDocument,
  code: string,
  message: string,
  path = '/',
): void {
  findings.push({ severity: 'error', code, message, path, location: location(document, path) });
}

function schemaPath(error: ErrorObject): string {
  const base = error.instancePath || '/';
  if (error.keyword !== 'required') return base;
  const missing = (error.params as { missingProperty?: string }).missingProperty;
  if (!missing) return base;
  return base === '/' || base === ''
    ? `/${pointerSegment(missing)}`
    : `${base}/${pointerSegment(missing)}`;
}

function addSchemaFindings(
  findings: Finding[],
  document: StrictJsonDocument,
  errors: ErrorObject[] | null | undefined,
  label: string,
): void {
  for (const error of errors ?? []) {
    const path = schemaPath(error);
    add(findings, document, 'capsule-schema', `${label}: ${error.message ?? error.keyword}.`, path);
  }
}

function sha(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function bytes(value: string | Uint8Array): Uint8Array {
  return typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
}

function records(value: JsonValue | undefined): Array<Record<string, JsonValue>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function artifactRecords(value: JsonValue, path = '/'): Array<[Record<string, JsonValue>, string]> {
  const result: Array<[Record<string, JsonValue>, string]> = [];
  if (Array.isArray(value)) {
    value.forEach((child, index) => result.push(...artifactRecords(child, `${path}/${index}`)));
  } else if (isRecord(value)) {
    if (
      typeof value.cid === 'string' &&
      typeof value.sha256 === 'string' &&
      typeof value.uri === 'string'
    ) {
      result.push([value, path]);
    }
    for (const [key, child] of Object.entries(value)) {
      result.push(...artifactRecords(child, `${path === '/' ? '' : path}/${pointerSegment(key)}`));
    }
  }
  return result;
}

function validateArtifactIdentity(
  artifact: Record<string, JsonValue>,
  path: string,
  document: StrictJsonDocument,
  findings: Finding[],
): void {
  const declaredCid = artifact.cid;
  const declaredSha = artifact.sha256;
  if (typeof declaredCid !== 'string' || typeof declaredSha !== 'string') return;
  try {
    const cid = CID.parse(declaredCid);
    if (cid.version !== 1 || cid.code !== 0x55 || cid.multihash.code !== sha256.code) {
      add(
        findings,
        document,
        'capsule-cid',
        'Only CIDv1 raw sha2-256 content addresses are supported.',
        `${path}/cid`,
      );
      return;
    }
    if (!Buffer.from(cid.multihash.digest).equals(Buffer.from(declaredSha, 'hex'))) {
      add(
        findings,
        document,
        'capsule-integrity',
        'CID multihash and declared SHA-256 identify different bytes.',
        path,
      );
    }
  } catch {
    add(findings, document, 'capsule-cid', 'CID is not a valid CIDv1 value.', `${path}/cid`);
  }
  const uri = artifact.uri;
  if (typeof uri === 'string') {
    try {
      const parsed = new URL(uri);
      if (parsed.username || parsed.password || parsed.search) {
        add(
          findings,
          document,
          'capsule-uri-policy',
          'Credential-bearing and query-bearing artifact URIs are forbidden.',
          `${path}/uri`,
        );
      }
    } catch {
      add(findings, document, 'capsule-uri-policy', 'Artifact URI is invalid.', `${path}/uri`);
    }
  }
}

function validateExpectedIdentity(
  input: string | Uint8Array,
  expected: NonNullable<CapsuleValidationOptions['expectedIdentity']>,
  document: StrictJsonDocument,
  findings: Finding[],
): void {
  const content = bytes(input);
  const actualSha = sha(content);
  if (
    actualSha !== expected.sha256.toLowerCase() ||
    (expected.bytes !== undefined && expected.bytes !== content.byteLength)
  ) {
    add(
      findings,
      document,
      'capsule-integrity',
      'Manifest exact bytes do not match the expected SHA-256 or byte length.',
      '/',
    );
  }
  try {
    const cid = CID.parse(expected.cid);
    if (
      cid.version !== 1 ||
      cid.code !== 0x55 ||
      cid.multihash.code !== sha256.code ||
      !Buffer.from(cid.multihash.digest).equals(Buffer.from(actualSha, 'hex'))
    ) {
      add(
        findings,
        document,
        'capsule-integrity',
        'Manifest exact bytes do not match the expected CIDv1 raw sha2-256 address.',
        '/',
      );
    }
  } catch {
    add(findings, document, 'capsule-cid', 'Expected manifest CID is invalid.', '/');
  }
}

function uniqueIds(
  entries: Array<Record<string, JsonValue>>,
  path: string,
  document: StrictJsonDocument,
  findings: Finding[],
): Set<string> {
  const ids = new Set<string>();
  entries.forEach((entry, index) => {
    if (typeof entry.id !== 'string') return;
    if (ids.has(entry.id))
      add(
        findings,
        document,
        'capsule-duplicate-id',
        `Duplicate id ${JSON.stringify(entry.id)}.`,
        `${path}/${index}/id`,
      );
    ids.add(entry.id);
  });
  return ids;
}

function validateComponentGraph(
  root: Record<string, JsonValue>,
  document: StrictJsonDocument,
  findings: Finding[],
): void {
  const components = records(root.components);
  const ids = uniqueIds(components, '/components', document, findings);
  const graph = new Map<string, string[]>();
  components.forEach((component, index) => {
    if (typeof component.id !== 'string') return;
    const dependencies = Array.isArray(component.dependencies)
      ? component.dependencies.filter((item): item is string => typeof item === 'string')
      : [];
    graph.set(component.id, dependencies);
    for (const dependency of dependencies) {
      if (!ids.has(dependency))
        add(
          findings,
          document,
          'capsule-reference',
          `Unknown component dependency ${JSON.stringify(dependency)}.`,
          `/components/${index}/dependencies`,
        );
      if (dependency === component.id)
        add(
          findings,
          document,
          'capsule-dependency-cycle',
          'A component cannot depend on itself.',
          `/components/${index}/dependencies`,
        );
    }
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of graph.get(id) ?? []) {
      if (graph.has(dependency) && visit(dependency)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const id of graph.keys()) {
    if (visit(id)) {
      add(
        findings,
        document,
        'capsule-dependency-cycle',
        'Component dependency graph contains a cycle.',
        '/components',
      );
      break;
    }
  }

  const toolIds = uniqueIds(records(root.tools), '/tools', document, findings);
  const capabilityIds = uniqueIds(
    records(root.requestedCapabilities),
    '/requestedCapabilities',
    document,
    findings,
  );
  void capabilityIds;
  records(root.requestedCapabilities).forEach((request, index) => {
    if (typeof request.tool === 'string' && !toolIds.has(request.tool))
      add(
        findings,
        document,
        'capsule-reference',
        `Requested capability names unknown tool ${JSON.stringify(request.tool)}.`,
        `/requestedCapabilities/${index}/tool`,
      );
  });
}

function externalChecks(): CapsuleExternalCheck[] {
  const definitions: Record<string, [CapsuleExternalCheck['category'], string]> = {
    'oracle-identity-current': [
      'identity',
      'Resolve the current Oracle DID/IID document and revocation state.',
    ],
    'subject-domain-current': [
      'identity',
      'Resolve each subject domain and its current canonical resources.',
    ],
    'capability-current-and-unrevoked': [
      'authorization',
      'Verify live grants, audience, scope, expiry and revocation before each call.',
    ],
    'trusted-time-available': [
      'time',
      'Evaluate time-bound policy against an approved trusted clock.',
    ],
    'private-resource-access-authorized': [
      'privacy',
      'Verify consent, disclosure and decryption rights before reading private evidence.',
    ],
    'human-review-authorized': [
      'review',
      'Verify the named independent reviewer and exact approved output digest.',
    ],
    'runtime-distribution-trusted': [
      'distribution',
      'Verify the installed kernel and adapters against an external trust anchor.',
    ],
    'receipt-signer-current-and-unrevoked': [
      'signer',
      'Verify the external receipt signer key and current revocation status.',
    ],
  };
  return ORACLE_CAPSULE_EXTERNAL_CHECKS.map((code) => ({
    code,
    category: definitions[code]?.[0] ?? 'authorization',
    reason: definitions[code]?.[1] ?? 'Runtime verification is required.',
  }));
}

function validateSourceLock(
  manifest: Record<string, JsonValue>,
  manifestDocument: StrictJsonDocument,
  sourceLock: string | Uint8Array,
  lockedFiles: Readonly<Record<string, string | Uint8Array>> | undefined,
  findings: Finding[],
): void {
  const parsed = parseCapsuleJson(sourceLock, {
    sourceName: `${manifestDocument.sourceName}#source-lock`,
  });
  if (!parsed.document) {
    findings.push(...parsed.findings);
    return;
  }
  const lockDocument = parsed.document;
  const valid = validateLockSchema()(lockDocument.value);
  if (!valid) {
    addSchemaFindings(findings, lockDocument, validateLockSchema().errors, 'Source lock schema');
    return;
  }
  if (!isRecord(lockDocument.value)) return;
  const lock = lockDocument.value;
  const componentId = lock.component;
  const component = records(manifest.components).find((entry) => entry.id === componentId);
  if (!component || !isRecord(component.artifact)) {
    add(
      findings,
      lockDocument,
      'capsule-lock',
      'Source lock component does not resolve in the manifest.',
      '/component',
    );
    return;
  }
  const lockBytes = bytes(sourceLock);
  const sourceLockReference = component.artifact.source_lock;
  if (isRecord(sourceLockReference)) {
    if (
      sourceLockReference.sha256 !== sha(lockBytes) ||
      sourceLockReference.bytes !== lockBytes.byteLength
    ) {
      add(
        findings,
        manifestDocument,
        'capsule-integrity',
        'Source lock exact bytes do not match the manifest reference.',
        '/components',
      );
    }
  }
  const lockArtifact = lock.artifact;
  if (
    isRecord(lockArtifact) &&
    (lockArtifact.cid !== component.artifact.cid ||
      lockArtifact.sha256 !== component.artifact.sha256 ||
      lockArtifact.bytes !== component.artifact.bytes)
  ) {
    add(
      findings,
      lockDocument,
      'capsule-lock',
      'Source lock artifact identity differs from its manifest component.',
      '/artifact',
    );
  }
  const files = records(lock.files);
  const paths = new Set<string>();
  const portablePaths = new Set<string>();
  let totalBytes = 0;
  files.forEach((file, index) => {
    if (
      typeof file.path !== 'string' ||
      typeof file.bytes !== 'number' ||
      typeof file.sha256 !== 'string'
    )
      return;
    if (paths.has(file.path))
      add(
        findings,
        lockDocument,
        'capsule-duplicate-path',
        `Duplicate locked path ${JSON.stringify(file.path)}.`,
        `/files/${index}/path`,
      );
    const portablePath = file.path.toLowerCase();
    if (portablePaths.has(portablePath) && !paths.has(file.path))
      add(
        findings,
        lockDocument,
        'capsule-path-collision',
        `Locked path ${JSON.stringify(file.path)} collides on case-insensitive hosts.`,
        `/files/${index}/path`,
      );
    paths.add(file.path);
    portablePaths.add(portablePath);
    totalBytes += file.bytes;
    if (totalBytes > ORACLE_CAPSULE_LIMITS.maxLockedBytes)
      add(
        findings,
        lockDocument,
        'capsule-limit',
        `Locked files exceed ${ORACLE_CAPSULE_LIMITS.maxLockedBytes} bytes.`,
        '/files',
      );
    if (lockedFiles) {
      const content = lockedFiles[file.path];
      if (content === undefined) {
        add(
          findings,
          lockDocument,
          'capsule-lock',
          `Locked file ${JSON.stringify(file.path)} is missing.`,
          `/files/${index}/path`,
        );
      } else {
        const contentBytes = bytes(content);
        if (contentBytes.byteLength !== file.bytes || sha(contentBytes) !== file.sha256)
          add(
            findings,
            lockDocument,
            'capsule-integrity',
            `Locked file ${JSON.stringify(file.path)} failed byte-length or SHA-256 verification.`,
            `/files/${index}`,
          );
      }
    }
  });
  if (lockedFiles) {
    for (const path of Object.keys(lockedFiles)) {
      if (!paths.has(path))
        add(
          findings,
          lockDocument,
          'capsule-lock',
          `Unlocked file ${JSON.stringify(path)} is forbidden.`,
          '/files',
        );
    }
  }
}

export function validateOracleCapsule(
  input: string | Uint8Array,
  options: CapsuleValidationOptions = {},
): CapsuleValidationReport {
  const parsed = parseCapsuleJson(input, options);
  const checks = externalChecks();
  if (!parsed.document) {
    return {
      tool: '@ixo/domain.md',
      contract: ORACLE_CAPSULE_CONTRACT,
      sourceName: options.sourceName ?? '<memory>',
      status: 'fail',
      ok: false,
      findings: parsed.findings,
      externalChecksRequired: checks,
    };
  }
  const findings = [...parsed.findings];
  if (options.expectedIdentity)
    validateExpectedIdentity(input, options.expectedIdentity, parsed.document, findings);
  const validator = validateManifestSchema();
  if (!validator(parsed.document.value))
    addSchemaFindings(findings, parsed.document, validator.errors, 'Manifest schema');
  if (isRecord(parsed.document.value)) {
    for (const [artifact, path] of artifactRecords(parsed.document.value))
      validateArtifactIdentity(artifact, path, parsed.document, findings);
    validateComponentGraph(parsed.document.value, parsed.document, findings);
    const metadata = parsed.document.value.metadata;
    if (isRecord(metadata) && typeof metadata.release_digest === 'string') {
      try {
        const actual = oracleCapsuleReleaseDigest(parsed.document.value);
        if (metadata.release_digest !== actual)
          add(
            findings,
            parsed.document,
            'capsule-release-digest',
            `Release digest mismatch; expected ${actual}.`,
            '/metadata/release_digest',
          );
      } catch (error) {
        add(
          findings,
          parsed.document,
          'capsule-canonicalization',
          error instanceof Error ? error.message : String(error),
          '/',
        );
      }
    }
    if (options.sourceLock)
      validateSourceLock(
        parsed.document.value,
        parsed.document,
        options.sourceLock,
        options.lockedFiles,
        findings,
      );
  }
  const ok = !findings.some((finding) => finding.severity === 'error');
  return {
    tool: '@ixo/domain.md',
    contract: ORACLE_CAPSULE_CONTRACT,
    sourceName: parsed.document.sourceName,
    status: ok ? 'static-pass' : 'fail',
    ok,
    findings,
    externalChecksRequired: checks,
    manifest: parsed.document.value,
  };
}
