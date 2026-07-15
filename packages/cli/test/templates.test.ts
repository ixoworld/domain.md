import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import * as raw from 'multiformats/codecs/raw';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import { parseTemplateManifest } from '../src/templates/manifest.js';
import { renderTemplateBundle } from '../src/templates/render.js';
import {
  FileTemplateResolver,
  HttpsTemplateResolver,
  validateHttpsTarget,
} from '../src/templates/resolver.js';
import type {
  RenderTemplateRequest,
  TemplateManifest,
  TemplateResolver,
} from '../src/templates/types.js';
import { packageRoot, protocolManifestUri, protocolParameters, repositoryRoot } from './helpers.js';

const protocol = 'did:ixo:entity:protocol:verified-services';

interface MemoryBundleOptions {
  transformTemplate?: (source: string) => string;
  transformManifest?: (manifest: TemplateManifest) => void;
  resolvedTemplateUri?: string;
}

async function memoryBundle(options: MemoryBundleOptions = {}): Promise<RenderTemplateRequest> {
  const manifestPath = resolve(repositoryRoot, 'examples/protocol-domain/template-manifest.yaml');
  const templatePath = resolve(
    repositoryRoot,
    'examples/protocol-domain/templates/project/domain.md.tmpl',
  );
  const originalManifest = parse(await readFile(manifestPath, 'utf8')) as TemplateManifest;
  const template =
    options.transformTemplate?.(await readFile(templatePath, 'utf8')) ??
    (await readFile(templatePath, 'utf8'));
  originalManifest.bundles[0]!.files[0]!.sha256 = createHash('sha256')
    .update(template)
    .digest('hex');
  options.transformManifest?.(originalManifest);
  const manifest = stringify(originalManifest);
  const resolver: TemplateResolver = {
    supports: () => true,
    resolve(uri) {
      if (uri === 'memory:manifest') {
        return Promise.resolve({
          uri: 'https://example.com/template-manifest.yaml',
          bytes: new TextEncoder().encode(manifest),
        });
      }
      return Promise.resolve({
        uri: options.resolvedTemplateUri ?? uri,
        bytes: new TextEncoder().encode(template),
      });
    },
  };
  return {
    manifestUri: 'memory:manifest',
    expectedProtocol: protocol,
    derivedType: 'project',
    parameters: await protocolParameters(),
    resolvers: [resolver],
  };
}

describe('template manifests and rendering', () => {
  it('parses the valid manifest', async () => {
    const bytes = await readFile(
      resolve(repositoryRoot, 'examples/protocol-domain/template-manifest.yaml'),
    );
    expect(parseTemplateManifest(bytes).protocol).toBe(protocol);
  });

  it('rejects traversal in a manifest fixture', async () => {
    const bytes = await readFile(resolve(packageRoot, 'test/fixtures/traversal-manifest.yaml'));
    expect(() => parseTemplateManifest(bytes)).toThrow('Invalid template manifest');
  });

  it('rejects duplicate JSON keys and unsafe YAML manifest features', () => {
    const duplicate = new TextEncoder().encode('{"version":"1.0.0-rc.1","version":"1.0.0-rc.1"}');
    const anchored = new TextEncoder().encode(
      'version: &version "1.0.0-rc.1"\nkind: "domain.md/template-manifest"\n',
    );
    expect(() => parseTemplateManifest(duplicate)).toThrow();
    expect(() => parseTemplateManifest(anchored)).toThrow('forbidden YAML');
  });

  it('renders deterministically and strips template markers', async () => {
    const parameters = await protocolParameters();
    const request = {
      manifestUri: protocolManifestUri(),
      expectedProtocol: protocol,
      derivedType: 'project' as const,
      parameters,
    };
    const first = await renderTemplateBundle(request);
    const second = await renderTemplateBundle(request);
    expect(first.report.ok).toBe(true);
    expect(first.files[0]?.sha256).toBe(second.files[0]?.sha256);
    expect(new TextDecoder().decode(first.files[0]?.bytes)).not.toContain('x-template');
    expect(first.provenance).not.toContain('Community Field Services');
  });

  it('rejects missing, undeclared, and wrong-type parameters', async () => {
    const base = {
      manifestUri: protocolManifestUri(),
      expectedProtocol: protocol,
      derivedType: 'project' as const,
    };
    await expect(
      renderTemplateBundle({ ...base, parameters: { name: 'Only name' } }),
    ).rejects.toThrow('purpose');
    await expect(
      renderTemplateBundle({
        ...base,
        parameters: { ...(await protocolParameters()), extra: true },
      }),
    ).rejects.toThrow('Undeclared');
    await expect(
      renderTemplateBundle({ ...base, parameters: { name: 3, purpose: 'test' } }),
    ).rejects.toThrow('must be string');
  });

  it('rejects protocol and manifest integrity mismatches', async () => {
    await expect(
      renderTemplateBundle({
        manifestUri: protocolManifestUri(),
        expectedProtocol: 'did:ixo:entity:protocol:wrong',
        derivedType: 'project',
        parameters: await protocolParameters(),
      }),
    ).rejects.toThrow('protocol');
    await expect(
      renderTemplateBundle({
        manifestUri: protocolManifestUri(),
        manifestSha256: '0'.repeat(64),
        expectedProtocol: protocol,
        derivedType: 'project',
        parameters: await protocolParameters(),
      }),
    ).rejects.toThrow('SHA-256 mismatch');
  });

  it('rejects file digest mismatch', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'domain-md-manifest-'));
    try {
      const sourceRoot = resolve(repositoryRoot, 'examples/protocol-domain');
      const template = await readFile(resolve(sourceRoot, 'templates/project/domain.md.tmpl'));
      await writeFile(resolve(root, 'domain.md.tmpl'), template);
      const manifest = `version: "1.0.0-rc.1"\nkind: "domain.md/template-manifest"\nprotocol: "${protocol}"\nprotocol_version: "1"\nbundles:\n  - derived_type: "project"\n    bundle_version: "1"\n    files:\n      - role: "domain.md"\n        path: "templates/project/domain.md.tmpl"\n        media_type: "text/markdown"\n        max_bytes: 1048576\n        sha256: "${createHash('sha256').update('wrong').digest('hex')}"\n        required: true\n`;
      await writeFile(resolve(root, 'manifest.yaml'), manifest);
      await expect(
        renderTemplateBundle({
          manifestUri: pathToFileURL(resolve(root, 'manifest.yaml')).href,
          expectedProtocol: protocol,
          derivedType: 'project',
          parameters: await protocolParameters(),
          resolvers: [
            {
              supports: () => true,
              resolve(uri) {
                return Promise.resolve({
                  uri: uri.endsWith('manifest.yaml') ? 'https://example.com/manifest.yaml' : uri,
                  bytes: uri.endsWith('manifest.yaml')
                    ? new TextEncoder().encode(manifest)
                    : template,
                });
              },
            },
          ],
        }),
      ).rejects.toThrow('SHA-256 mismatch');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('requires pinned remote manifests and explicit IPFS gateways', async () => {
    await expect(
      renderTemplateBundle({
        manifestUri: 'https://example.com/manifest.yaml',
        expectedProtocol: protocol,
        derivedType: 'project',
        parameters: {},
        resolvers: [],
      }),
    ).rejects.toThrow('require --manifest-sha256');
    await expect(
      renderTemplateBundle({
        manifestUri: 'ipfs://bafybeigdyrzt/manifest.yaml',
        expectedProtocol: protocol,
        derivedType: 'project',
        parameters: {},
        resolvers: [],
      }),
    ).rejects.toThrow('explicit HTTPS gateway');
    await expect(
      renderTemplateBundle({
        manifestUri: 'unsupported:manifest',
        expectedProtocol: protocol,
        derivedType: 'project',
        parameters: {},
        resolvers: [],
      }),
    ).rejects.toThrow('No template resolver');
  });

  it('requires a digest for an IPFS manifest below the CID root', async () => {
    const request = await memoryBundle();
    request.manifestUri = 'ipfs://bafybeigdyrzt/path/manifest.yaml';
    request.ipfsGateway = 'https://example.com/';
    request.resolvers = [
      {
        supports: () => true,
        async resolve(uri) {
          const source = await readFile(
            resolve(repositoryRoot, 'examples/protocol-domain/template-manifest.yaml'),
          );
          return { uri, bytes: source };
        },
      },
    ];
    await expect(renderTemplateBundle(request)).rejects.toThrow('explicit SHA-256');
  });

  it.each([
    [
      'invalid declaration',
      (source: string) => source.replace('fill_at: "author"', 'fill_at: "runtime"'),
      'must declare',
    ],
    [
      'unknown structured parameter',
      (source: string) => source.replace('$param: name', '$param: undeclared'),
      'Unknown structured',
    ],
    [
      'unknown Markdown parameter',
      (source: string) => source.replace('{{name}}', '{{undeclared}}'),
      'Unknown Markdown',
    ],
    [
      'unresolved placeholder',
      (source: string) => `${source}\n{{invalid marker}}\n`,
      'Unresolved placeholder',
    ],
    [
      'unused required parameter',
      (source: string) =>
        source
          .replace('  purpose:\n    $param: purpose', '  purpose: "literal"')
          .replace('{{purpose}}', 'a literal purpose'),
      'declared but unused',
    ],
    [
      'non-scalar Markdown parameter',
      (source: string) =>
        source
          .replace(
            '    - { name: "purpose", type: "string", required: true, fill_at: "author" }',
            '    - { name: "purpose", type: "string", required: true, fill_at: "author" }\n    - { name: "settings", type: "object", required: false, fill_at: "author" }',
          )
          .replace('{{name}} operates', '{{name}} {{settings}} operates'),
      'Markdown parameters',
    ],
  ] as const)('rejects %s', async (_label, transform, message) => {
    const request = await memoryBundle({ transformTemplate: transform });
    if (message === 'Markdown parameters') request.parameters.settings = { private: false };
    await expect(renderTemplateBundle(request)).rejects.toThrow(message);
  });

  it('rejects missing frontmatter, invalid YAML, and marker mismatches', async () => {
    await expect(
      renderTemplateBundle(await memoryBundle({ transformTemplate: () => '# no frontmatter\n' })),
    ).rejects.toThrow('requires YAML frontmatter');
    await expect(
      renderTemplateBundle(
        await memoryBundle({ transformTemplate: () => '---\ninvalid: [\n---\n' }),
      ),
    ).rejects.toThrow();
    await expect(
      renderTemplateBundle(
        await memoryBundle({
          transformTemplate: (source) => source.replace('is_template: true', 'is_template: false'),
        }),
      ),
    ).rejects.toThrow('marker mismatch');
    await expect(
      renderTemplateBundle(
        await memoryBundle({
          transformTemplate: (source) =>
            source.replace('document_revision: "0.1.0"', 'document_revision: &revision "0.1.0"'),
        }),
      ),
    ).rejects.toThrow('unsafe or excessive YAML');
    await expect(
      renderTemplateBundle(
        await memoryBundle({
          transformTemplate: (source) => source.replace('name: "purpose"', 'name: "name"'),
        }),
      ),
    ).rejects.toThrow('Duplicate template parameter');
  });

  it('requires a matching bundle and rendered domain.md', async () => {
    const missingBundle = await memoryBundle();
    missingBundle.derivedType = 'service';
    await expect(renderTemplateBundle(missingBundle)).rejects.toThrow('no service bundle');

    const noDomain = await memoryBundle({
      transformManifest(manifest) {
        manifest.bundles[0]!.files[0]!.role = 'supporting';
        manifest.bundles[0]!.files[0]!.path = 'templates/project/notes.md.tmpl';
      },
    });
    await expect(renderTemplateBundle(noDomain)).rejects.toThrow('must contain');

    const wrongPathType = await memoryBundle({
      transformManifest(manifest) {
        manifest.bundles[0]!.files[0]!.path = 'templates/service/domain.md.tmpl';
      },
    });
    await expect(renderTemplateBundle(wrongPathType)).rejects.toThrow('does not match bundle type');
  });

  it('rejects a resolver that crosses from a remote manifest to a local resource', async () => {
    await expect(
      renderTemplateBundle(
        await memoryBundle({ resolvedTemplateUri: 'file:///private/template.md.tmpl' }),
      ),
    ).rejects.toThrow('local file resources');
  });

  it('enforces each template file max_bytes declaration', async () => {
    const request = await memoryBundle({
      transformManifest(manifest) {
        manifest.bundles[0]!.files[0]!.max_bytes = 1;
      },
    });
    await expect(renderTemplateBundle(request)).rejects.toThrow('max_bytes');
  });

  it('verifies raw sha2-256 CIDs and rejects unsupported or mismatched CIDs', async () => {
    const good = await memoryBundle();
    const resolver = good.resolvers![0]!;
    const manifestResource = await resolver.resolve('memory:manifest', {
      maxBytes: 1_000_000,
      timeoutMs: 1_000,
    });
    const digest = await sha256.digest(manifestResource.bytes);
    const goodCid = CID.createV1(raw.code, digest).toString();
    good.manifestCid = goodCid;
    await expect(renderTemplateBundle(good)).resolves.toHaveProperty('report.ok', true);

    const unsupported = await memoryBundle();
    unsupported.manifestCid = CID.createV1(0x71, digest).toString();
    await expect(renderTemplateBundle(unsupported)).rejects.toThrow('raw sha2-256');

    const mismatch = await memoryBundle();
    mismatch.manifestCid = CID.createV1(
      raw.code,
      await sha256.digest(new TextEncoder().encode('other')),
    ).toString();
    await expect(renderTemplateBundle(mismatch)).rejects.toThrow('CID mismatch');

    const invalid = await memoryBundle();
    invalid.manifestCid = 'not-a-cid';
    await expect(renderTemplateBundle(invalid)).rejects.toThrow('Invalid CID');
  });
});

describe('resolver security', () => {
  it('rejects credentials and private redirect targets', async () => {
    const malicious = (
      await readFile(resolve(packageRoot, 'test/fixtures/malicious-redirect.txt'), 'utf8')
    ).trim();
    expect(() => validateHttpsTarget(new URL(malicious))).toThrow('Credentials');
    expect(() =>
      validateHttpsTarget(new URL('https://example.com/template'), ['127.0.0.1']),
    ).toThrow('non-public');
  });

  it('rejects loopback SSRF before connecting', async () => {
    await expect(
      new HttpsTemplateResolver().resolve('https://127.0.0.1/template', {
        maxBytes: 100,
        timeoutMs: 100,
      }),
    ).rejects.toThrow('non-public');
  });

  it('rejects file symlinks', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'domain-md-file-'));
    try {
      const target = resolve(root, 'target.txt');
      const link = resolve(root, 'link.txt');
      await writeFile(target, 'safe');
      await symlink(target, link);
      await expect(
        new FileTemplateResolver().resolve(pathToFileURL(link).href, {
          maxBytes: 100,
          timeoutMs: 100,
        }),
      ).rejects.toThrow('symlinks');
      await expect(
        new FileTemplateResolver().resolve(pathToFileURL(target).href, {
          maxBytes: 1,
          timeoutMs: 100,
        }),
      ).rejects.toThrow('exceeds');

      const actualDirectory = resolve(root, 'actual');
      const aliasDirectory = resolve(root, 'alias');
      await mkdir(actualDirectory);
      await writeFile(resolve(actualDirectory, 'nested.txt'), 'safe');
      await symlink(actualDirectory, aliasDirectory, 'dir');
      await expect(
        new FileTemplateResolver().resolve(
          pathToFileURL(resolve(aliasDirectory, 'nested.txt')).href,
          {
            maxBytes: 100,
            timeoutMs: 100,
          },
        ),
      ).rejects.toThrow('symlinks');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
