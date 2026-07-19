import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  canonicalizeCapsuleJson,
  CapsuleCanonicalizationError,
  capsuleJcsSha256,
  getOracleCapsuleJcsVectors,
  getOracleCapsuleSchema,
  getOracleCapsuleSourceLockSchema,
  lint,
  oracleCapsuleReleaseDigest,
  oracleCapsuleReleaseProjection,
  parseCapsuleJson,
  validateOracleCapsule,
} from '../src/index.js';
import type { JcsGoldenVector, JsonValue } from '../src/index.js';
import { example, repositoryRoot } from './helpers.js';

const exampleRoot = resolve(repositoryRoot, 'examples/oracle-capsule');

async function fixture(name: string): Promise<string> {
  return readFile(resolve(exampleRoot, name), 'utf8');
}

describe('Oracle Capsule strict JSON and RFC 8785', () => {
  it('passes every packaged cross-language golden vector', () => {
    const corpus = getOracleCapsuleJcsVectors() as { vectors: JcsGoldenVector[] };
    expect(corpus.vectors.length).toBeGreaterThanOrEqual(8);
    for (const vector of corpus.vectors) {
      const parsed = parseCapsuleJson(vector.input);
      if (vector.errorCode) {
        expect(parsed.ok, vector.name).toBe(false);
        expect(parsed.findings[0]?.code, vector.name).toBe(vector.errorCode);
        continue;
      }
      expect(parsed.ok, vector.name).toBe(true);
      const canonical = canonicalizeCapsuleJson(parsed.document?.value as JsonValue);
      expect(canonical, vector.name).toBe(vector.canonical);
      expect(capsuleJcsSha256(parsed.document?.value as JsonValue), vector.name).toBe(
        vector.sha256,
      );
    }
  });

  it('reports duplicate keys at an exact one-based source location', () => {
    const parsed = parseCapsuleJson('{\n  "safe": 1,\n  "safe": 2\n}');
    expect(parsed.findings[0]).toMatchObject({
      code: 'capsule-duplicate-key',
      path: '/safe',
      location: { line: 3, column: 3 },
    });
  });

  it('rejects a UTF-8 BOM before parsing byte input', () => {
    const parsed = parseCapsuleJson(Uint8Array.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]));
    expect(parsed.findings[0]).toMatchObject({
      code: 'capsule-encoding',
      location: { line: 1, column: 1 },
    });
  });

  it('keeps exact published bytes distinct from canonical object bytes', () => {
    const compact = '{"b":2,"a":1}';
    const spaced = '{ "a": 1, "b": 2 }\n';
    const left = parseCapsuleJson(compact).document?.value as JsonValue;
    const right = parseCapsuleJson(spaced).document?.value as JsonValue;
    expect(canonicalizeCapsuleJson(left)).toBe(canonicalizeCapsuleJson(right));
    expect(createHash('sha256').update(compact).digest('hex')).not.toBe(
      createHash('sha256').update(spaced).digest('hex'),
    );
  });

  it('fails closed for every non-I-JSON or unsupported canonical value', () => {
    const invalid: unknown[] = [
      '\ud800',
      '\udc00',
      Number.POSITIVE_INFINITY,
      9007199254740992,
      undefined,
    ];
    for (const value of invalid) {
      expect(() => canonicalizeCapsuleJson(value as JsonValue)).toThrow(
        CapsuleCanonicalizationError,
      );
    }
    expect(() => oracleCapsuleReleaseProjection(null)).toThrow(
      'A capsule release must be a JSON object.',
    );
    expect(() => oracleCapsuleReleaseProjection({})).toThrow(
      'A capsule release must contain metadata.',
    );
  });

  it('rejects malformed syntax and configured resource-limit boundaries', () => {
    const malformed = [
      '{} trailing',
      '{unquoted:1}',
      '{"a" 1}',
      '{"a":1 "b":2}',
      '[1 2]',
      '"control\ncharacter"',
      '"unterminated',
      '"\\x"',
      '"\\uD800"',
      '"\\uD800\\u0041"',
      '"\\uDC00"',
      '"\\u12x4"',
      '-',
      '1x',
    ];
    for (const input of malformed) expect(parseCapsuleJson(input).ok, input).toBe(false);

    expect(parseCapsuleJson(Uint8Array.from([0xff])).findings[0]?.code).toBe('capsule-encoding');
    expect(parseCapsuleJson('{"a":{"b":1}}', { maxDepth: 1 }).findings[0]?.code).toBe(
      'capsule-limit',
    );
    expect(parseCapsuleJson('[1,2]', { maxNodes: 2 }).findings[0]?.code).toBe('capsule-limit');
    expect(parseCapsuleJson('"long"', { maxScalarLength: 2 }).findings[0]?.code).toBe(
      'capsule-limit',
    );
    expect(parseCapsuleJson('{}', { maxBytes: 1 }).findings[0]?.code).toBe(
      'capsule-file-too-large',
    );
    expect(parseCapsuleJson(`"${'\ud800'}"`).findings[0]?.code).toBe('capsule-unicode');
    expect(parseCapsuleJson(`"${'\udc00'}"`).findings[0]?.code).toBe('capsule-unicode');
    expect(parseCapsuleJson('[]').document?.value).toEqual([]);
    expect(parseCapsuleJson('null').document?.value).toBeNull();
    expect(parseCapsuleJson('true').document?.value).toBe(true);
    expect(parseCapsuleJson('false').document?.value).toBe(false);
    expect(parseCapsuleJson('{"a/b~":1}').document?.locations.has('/a~1b~0')).toBe(true);
  });
});

describe('Oracle Capsule contract and source locks', () => {
  it('packages the frozen manifest and source-lock schemas', () => {
    expect(getOracleCapsuleSchema().$id).toBe('urn:ixo:domain-md:x-oracle-capsule:manifest:0.1.0');
    expect(getOracleCapsuleSourceLockSchema().$id).toBe(
      'urn:ixo:domain-md:x-oracle-capsule:source-lock:0.1.0',
    );
  });

  it('validates the minimal release, exact lock and complete file inventory', async () => {
    const manifest = await fixture('minimal.manifest.json');
    const sourceLock = await fixture('master.source-lock.json');
    const skill = await fixture('master/SKILL.md');
    const report = validateOracleCapsule(manifest, {
      sourceName: 'minimal.manifest.json',
      sourceLock,
      lockedFiles: { 'SKILL.md': skill },
      expectedIdentity: {
        cid: 'bafkreic4or3bq7h3jjr3beorg7pcftuvapmfzbwl7qi4egugqbsmyi2nva',
        sha256: '5c7476187cfb4a63b091d137de22ce9503d85c86cbfc11c21a868064cc234da8',
        bytes: 3824,
      },
    });
    expect(report.findings).toEqual([]);
    expect(report.status).toBe('static-pass');
    expect(report.externalChecksRequired.map((check) => check.code)).toContain(
      'capability-current-and-unrevoked',
    );
    expect(report.externalChecksRequired.map((check) => check.code)).toContain(
      'runtime-distribution-trusted',
    );
    expect(
      oracleCapsuleReleaseDigest(parseCapsuleJson(manifest).document?.value as JsonValue),
    ).toBe('f4fe600b7cc415489cae8b8cc6ecf278af1a0243676c841694e227757c608d96');
  });

  it('validates the exact x-oracle-capsule domain.md binding', async () => {
    const binding = [
      'kind: "domain.md"',
      'x-oracle-capsule:',
      '  contract: "ixo.earth/oracle-capsule/v0alpha1"',
      '  manifest:',
      '    uri: "ipfs://bafkreic4or3bq7h3jjr3beorg7pcftuvapmfzbwl7qi4egugqbsmyi2nva"',
      '    cid: "bafkreic4or3bq7h3jjr3beorg7pcftuvapmfzbwl7qi4egugqbsmyi2nva"',
      '    sha256: "5c7476187cfb4a63b091d137de22ce9503d85c86cbfc11c21a868064cc234da8"',
      '    media_type: "application/vnd.ixo.oracle-capsule+json"',
      '    schema: "urn:ixo:domain-md:x-oracle-capsule:manifest:0.1.0"',
      '    version: "0.1.0"',
    ].join('\n');
    const report = lint((await example()).replace('kind: "domain.md"', binding));
    expect(report.findings.filter((finding) => finding.code === 'schema')).toEqual([]);
  });

  it('validates the full release with a typed least-authority tool request', async () => {
    const report = validateOracleCapsule(await fixture('full.manifest.json'), {
      sourceLock: await fixture('master.source-lock.json'),
      lockedFiles: { 'SKILL.md': await fixture('master/SKILL.md') },
    });
    expect(report.findings).toEqual([]);
    expect(report.status).toBe('static-pass');
  });

  it('rejects tamper, unlocked files, dependency cycles and live-authority claims', async () => {
    const manifest = await fixture('minimal.manifest.json');
    const sourceLock = await fixture('master.source-lock.json');
    const tampered = validateOracleCapsule(manifest, {
      sourceLock,
      lockedFiles: { 'SKILL.md': 'tampered', 'secret.env': 'forbidden' },
    });
    expect(tampered.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['capsule-integrity', 'capsule-lock']),
    );

    const value = JSON.parse(manifest) as Record<string, unknown>;
    const components = value.components as Array<Record<string, unknown>>;
    components.push({
      ...components[0],
      id: 'cycle',
      kind: 'specialist_skill',
      dependencies: ['cycle'],
    });
    const cyclic = validateOracleCapsule(JSON.stringify(value));
    expect(cyclic.findings.map((finding) => finding.code)).toContain('capsule-dependency-cycle');

    value.authorized = true;
    const authorityClaim = validateOracleCapsule(JSON.stringify(value));
    expect(authorityClaim.findings.map((finding) => finding.code)).toContain('capsule-schema');
  });

  it('rejects downgrade, extra Masters, writable content, unsafe URIs and unknown tools', async () => {
    const original = JSON.parse(await fixture('minimal.manifest.json')) as Record<string, unknown>;
    const variants: Array<[Record<string, unknown>, string]> = [];

    const downgrade = structuredClone(original);
    (downgrade.compatibility as Record<string, unknown>).contract_major = 'v0';
    variants.push([downgrade, 'capsule-schema']);

    const extraMaster = structuredClone(original);
    const master = (extraMaster.components as Array<Record<string, unknown>>)[0];
    (extraMaster.components as Array<Record<string, unknown>>).push({ ...master, id: 'master-2' });
    variants.push([extraMaster, 'capsule-schema']);

    const writable = structuredClone(original);
    ((writable.components as Array<Record<string, unknown>>)[0] as Record<string, unknown>)[
      'runtime_writable'
    ] = true;
    variants.push([writable, 'capsule-schema']);

    const credentialUri = structuredClone(original);
    const credentialArtifact = (credentialUri.components as Array<Record<string, unknown>>)[0]
      ?.artifact as Record<string, unknown>;
    credentialArtifact.uri = 'https://user:secret@example.com/release';
    variants.push([credentialUri, 'capsule-uri-policy']);

    const unknownTool = structuredClone(original);
    unknownTool.requestedCapabilities = [
      { id: 'bad-request', action: 'read', object: 'evidence', tool: 'not-declared' },
    ];
    variants.push([unknownTool, 'capsule-reference']);

    const missingRuntimeCheck = structuredClone(original);
    (missingRuntimeCheck.external_checks_required as unknown[]).pop();
    variants.push([missingRuntimeCheck, 'capsule-schema']);

    for (const [value, code] of variants) {
      expect(
        validateOracleCapsule(JSON.stringify(value)).findings.map((finding) => finding.code),
      ).toContain(code);
    }
  });

  it('rejects byte-different manifests and traversal source locks before execution', async () => {
    const manifest = await fixture('minimal.manifest.json');
    const byteDifferent = `${manifest.trim()}\n\n`;
    const identity = validateOracleCapsule(byteDifferent, {
      expectedIdentity: {
        cid: 'bafkreic4or3bq7h3jjr3beorg7pcftuvapmfzbwl7qi4egugqbsmyi2nva',
        sha256: '5c7476187cfb4a63b091d137de22ce9503d85c86cbfc11c21a868064cc234da8',
        bytes: 3824,
      },
    });
    expect(identity.findings.map((finding) => finding.code)).toContain('capsule-integrity');

    const traversal = await readFile(
      resolve(
        repositoryRoot,
        'packages/cli/test/fixtures/oracle-capsule/traversal-source-lock.json',
      ),
      'utf8',
    );
    const locked = validateOracleCapsule(manifest, { sourceLock: traversal });
    expect(locked.findings.map((finding) => finding.code)).toContain('capsule-schema');

    const caseCollision = JSON.parse(await fixture('master.source-lock.json')) as Record<
      string,
      unknown
    >;
    (caseCollision.files as unknown[]).push({
      path: 'skill.md',
      bytes: 100,
      sha256: '9354cab7e0ed0d2f5b90fc2553dd01901e5a3ddc43951eac3c26c9a19765c662',
      mode: 'file',
    });
    const collision = validateOracleCapsule(manifest, {
      sourceLock: JSON.stringify(caseCollision),
    });
    expect(collision.findings.map((finding) => finding.code)).toContain('capsule-path-collision');
  });

  it('reports invalid identity, artifact, graph and source-lock identities', async () => {
    const manifest = await fixture('minimal.manifest.json');
    expect(validateOracleCapsule('{', { sourceName: 'broken.json' }).status).toBe('fail');
    expect(validateOracleCapsule('[]').status).toBe('fail');
    expect(validateOracleCapsule('{}').findings.map((finding) => finding.code)).toContain(
      'capsule-schema',
    );
    const invalidExpected = validateOracleCapsule(manifest, {
      expectedIdentity: { cid: 'not-a-cid', sha256: '0'.repeat(64) },
    });
    expect(invalidExpected.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['capsule-integrity', 'capsule-cid']),
    );

    const value = JSON.parse(manifest) as Record<string, unknown>;
    const master = (value.components as Array<Record<string, unknown>>)[0] as Record<
      string,
      unknown
    >;
    const artifact = master.artifact as Record<string, unknown>;
    artifact.sha256 = '0'.repeat(64);
    artifact.uri = 'https://%/invalid';
    const invalidArtifact = validateOracleCapsule(JSON.stringify(value));
    expect(invalidArtifact.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['capsule-integrity', 'capsule-uri-policy']),
    );

    const unsupportedCodec = JSON.parse(manifest) as Record<string, unknown>;
    const unsupportedArtifact = (unsupportedCodec.components as Array<Record<string, unknown>>)[0]
      ?.artifact as Record<string, unknown>;
    unsupportedArtifact.cid = 'bafybeifqfy2hr2675fssl7lt75pu76ucdjygbcvidhnd6srfiuw2p2vx6i';
    expect(
      validateOracleCapsule(JSON.stringify(unsupportedCodec)).findings.map(
        (finding) => finding.code,
      ),
    ).toContain('capsule-cid');

    const missingId = structuredClone(value);
    (missingId.components as unknown[]).push({ dependencies: [] });
    expect(validateOracleCapsule(JSON.stringify(missingId)).findings).not.toEqual([]);

    const graphEdges = JSON.parse(await fixture('full.manifest.json')) as Record<string, unknown>;
    const graphComponents = graphEdges.components as Array<Record<string, unknown>>;
    graphComponents[0]!.dependencies = ['evaluation-policy', 'not-declared'];
    graphComponents[1]!.id = 'master';
    const graphReport = validateOracleCapsule(JSON.stringify(graphEdges));
    expect(graphReport.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['capsule-duplicate-id', 'capsule-reference']),
    );
    const visitedGraph = JSON.parse(await fixture('full.manifest.json')) as Record<string, unknown>;
    ((visitedGraph.components as Array<Record<string, unknown>>)[0] as Record<string, unknown>)[
      'dependencies'
    ] = ['evaluation-policy'];
    expect(validateOracleCapsule(JSON.stringify(visitedGraph)).status).toBe('fail');

    const validLock = JSON.parse(await fixture('master.source-lock.json')) as Record<
      string,
      unknown
    >;
    validLock.component = 'unknown-component';
    expect(
      validateOracleCapsule(manifest, { sourceLock: JSON.stringify(validLock) }).findings.map(
        (finding) => finding.code,
      ),
    ).toContain('capsule-lock');

    const noLockReference = JSON.parse(manifest) as Record<string, unknown>;
    const noLockArtifact = (noLockReference.components as Array<Record<string, unknown>>)[0]
      ?.artifact as Record<string, unknown>;
    delete noLockArtifact.source_lock;
    expect(
      validateOracleCapsule(JSON.stringify(noLockReference), {
        sourceLock: await fixture('master.source-lock.json'),
      }).findings.map((finding) => finding.code),
    ).toContain('capsule-schema');

    const malformedLock = validateOracleCapsule(manifest, { sourceLock: '{' });
    expect(malformedLock.findings.map((finding) => finding.code)).toContain('capsule-json-syntax');

    const mismatchedLock = JSON.parse(await fixture('master.source-lock.json')) as Record<
      string,
      unknown
    >;
    (mismatchedLock.artifact as Record<string, unknown>).bytes = 35;
    const files = mismatchedLock.files as Array<Record<string, unknown>>;
    files.push({ ...files[0] });
    files.push({
      path: 'large.bin',
      bytes: 67_108_864,
      sha256: '0'.repeat(64),
      mode: 'file',
    });
    const mismatched = validateOracleCapsule(manifest, {
      sourceLock: JSON.stringify(mismatchedLock),
      lockedFiles: {},
    });
    expect(mismatched.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['capsule-lock', 'capsule-duplicate-path', 'capsule-limit']),
    );
  });
});
