import { createHash } from 'node:crypto';
import { basename } from 'node:path';

import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import { isAlias, parseDocument, stringify, visit as visitYaml } from 'yaml';

import {
  MAX_LINKED_BYTES,
  MAX_SCALAR_LENGTH,
  MAX_YAML_DEPTH,
  MAX_YAML_NODES,
  SPEC_VERSION,
} from '../constants.js';
import { lint } from '../lint.js';
import type { DomainRecord } from '../types.js';
import { TemplateValidationError } from './errors.js';
import { parseTemplateManifest } from './manifest.js';
import {
  FileTemplateResolver,
  HttpsTemplateResolver,
  IpfsTemplateResolver,
  relativeTemplateUri,
} from './resolver.js';
import type {
  RenderedFile,
  RenderTemplateRequest,
  RenderTemplateResult,
  ResolvedTemplateResource,
  TemplateFileRecord,
  TemplateResolver,
} from './types.js';

function sha(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function deterministicUuid(seed: string): string {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function verifyIdentity(
  resource: ResolvedTemplateResource,
  expectedSha?: string | null,
  expectedCid?: string | null,
): Promise<void> {
  if (expectedSha && sha(resource.bytes) !== expectedSha.toLowerCase())
    throw new TemplateValidationError(`SHA-256 mismatch for ${resource.uri}.`);
  if (expectedCid) {
    let cid: CID;
    try {
      cid = CID.parse(expectedCid);
    } catch {
      throw new TemplateValidationError(`Invalid CID ${expectedCid}.`);
    }
    if (cid.code !== 0x55 || cid.multihash.code !== sha256.code) {
      throw new TemplateValidationError(
        `CID verification supports raw sha2-256 CIDs only: ${expectedCid}`,
      );
    }
    const digest = await sha256.digest(resource.bytes);
    if (!Buffer.from(digest.digest).equals(Buffer.from(cid.multihash.digest)))
      throw new TemplateValidationError(`CID mismatch for ${resource.uri}.`);
  }
}

function chooseResolver(uri: string, resolvers: TemplateResolver[]): TemplateResolver {
  const resolver = resolvers.find((candidate) => candidate.supports(uri));
  if (!resolver) throw new Error(`No template resolver supports ${uri}.`);
  return resolver;
}

function isRecord(value: unknown): value is DomainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  fill_at: 'author';
}

function parameterDefinitions(marker: DomainRecord): ParameterDefinition[] {
  if (!Array.isArray(marker.parameters))
    throw new TemplateValidationError('Template marker parameters must be an array.');
  const seen = new Set<string>();
  return marker.parameters.map((value) => {
    if (
      !isRecord(value) ||
      typeof value.name !== 'string' ||
      !['string', 'number', 'boolean', 'object', 'array'].includes(String(value.type)) ||
      typeof value.required !== 'boolean' ||
      value.fill_at !== 'author'
    ) {
      throw new TemplateValidationError(
        'Every template parameter must declare name, supported type, required, and fill_at: author.',
      );
    }
    if (seen.has(value.name))
      throw new TemplateValidationError(`Duplicate template parameter ${value.name}.`);
    seen.add(value.name);
    return {
      name: value.name,
      type: value.type as ParameterDefinition['type'],
      required: value.required === true,
      fill_at: 'author',
    };
  });
}

function valueMatches(value: unknown, type: ParameterDefinition['type']): boolean {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isRecord(value);
  return typeof value === type;
}

function substitute(
  value: unknown,
  parameters: Record<string, unknown>,
  allowed: Map<string, ParameterDefinition>,
  used: Set<string>,
): unknown {
  if (Array.isArray(value))
    return value.map((child) => substitute(child, parameters, allowed, used));
  if (!isRecord(value)) return value;
  if (Object.keys(value).length === 1 && typeof value.$param === 'string') {
    const definition = allowed.get(value.$param);
    if (!definition)
      throw new TemplateValidationError(`Unknown structured parameter ${value.$param}.`);
    const resolved = parameters[value.$param];
    if (resolved === undefined)
      throw new TemplateValidationError(
        `Required structured parameter ${value.$param} is unresolved.`,
      );
    if (!valueMatches(resolved, definition.type))
      throw new TemplateValidationError(`Parameter ${value.$param} must be ${definition.type}.`);
    used.add(value.$param);
    return resolved;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      substitute(child, parameters, allowed, used),
    ]),
  );
}

function markdownEscape(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    throw new TemplateValidationError('Markdown parameters must be strings, numbers, or booleans.');
  }
  return String(value)
    .replace(/[\\`*_[\]<>]/g, '\\$&')
    .replace(/&/g, '&amp;');
}

function renderMarkdownTemplate(
  source: string,
  file: TemplateFileRecord,
  expectedProtocol: string,
  derivedType: string,
  parameters: Record<string, unknown>,
  draftId: string,
): Uint8Array {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  if (!match?.[1])
    throw new TemplateValidationError(`Template ${file.path} requires YAML frontmatter.`);
  const yaml = parseDocument(match[1], { prettyErrors: true, uniqueKeys: true, version: '1.2' });
  if (yaml.errors.length > 0)
    throw new TemplateValidationError(yaml.errors.map((error) => error.message).join('; '));
  const unsafe = new Set<string>();
  let nodes = 0;
  let depth = 0;
  let scalarTooLong = false;
  visitYaml(yaml, {
    Node(_key, node, path) {
      const candidate = node as { anchor?: string; tag?: string; value?: unknown };
      nodes += 1;
      depth = Math.max(depth, path.length + 1);
      if (typeof candidate.value === 'string' && candidate.value.length > MAX_SCALAR_LENGTH)
        scalarTooLong = true;
      if (isAlias(node)) unsafe.add('alias');
      if (candidate.anchor) unsafe.add('anchor');
      if (candidate.tag?.startsWith('!')) unsafe.add('custom-tag');
    },
    Pair(_key, pair) {
      const key = pair.key as { value?: unknown } | null;
      if (key?.value === '<<') unsafe.add('merge-key');
    },
  });
  if (nodes > MAX_YAML_NODES || depth > MAX_YAML_DEPTH || scalarTooLong || unsafe.size > 0) {
    throw new TemplateValidationError(`Template ${file.path} contains unsafe or excessive YAML.`);
  }
  const frontmatter = yaml.toJS({ maxAliasCount: 0 }) as DomainRecord;
  const marker = frontmatter['x-template'];
  const markerKeys = new Set([
    'is_template',
    'instantiates_type',
    'protocol',
    'template_version',
    'parameters',
  ]);
  if (
    !isRecord(marker) ||
    marker.is_template !== true ||
    marker.protocol !== expectedProtocol ||
    marker.instantiates_type !== derivedType ||
    typeof marker.template_version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(marker.template_version) ||
    Object.keys(marker).some((key) => !markerKeys.has(key) && !key.startsWith('x-'))
  ) {
    throw new TemplateValidationError(`Template marker mismatch in ${file.path}.`);
  }
  const definitions = parameterDefinitions(marker);
  const allowed = new Map(definitions.map((definition) => [definition.name, definition]));
  for (const key of Object.keys(parameters))
    if (!allowed.has(key)) throw new TemplateValidationError(`Undeclared parameter ${key}.`);
  for (const definition of definitions) {
    if (definition.required && parameters[definition.name] === undefined)
      throw new TemplateValidationError(`Required parameter ${definition.name} is unresolved.`);
    if (
      parameters[definition.name] !== undefined &&
      !valueMatches(parameters[definition.name], definition.type)
    )
      throw new TemplateValidationError(`Parameter ${definition.name} must be ${definition.type}.`);
  }
  delete frontmatter['x-template'];
  const used = new Set<string>();
  const renderedFrontmatter = substitute(frontmatter, parameters, allowed, used) as DomainRecord;
  if (isRecord(renderedFrontmatter.domain)) {
    renderedFrontmatter.domain.id = `urn:uuid:${draftId}`;
    renderedFrontmatter.domain.iid = null;
    renderedFrontmatter.domain.type = derivedType;
    renderedFrontmatter.domain.class = expectedProtocol;
    renderedFrontmatter.domain.status = 'draft';
  }
  renderedFrontmatter.version = SPEC_VERSION;
  if (isRecord(renderedFrontmatter.conformance))
    renderedFrontmatter.conformance.profile = 'authoring_draft';

  const body = source
    .slice(match[0].length)
    .replace(/\{\{([A-Za-z0-9_.-]+)\}\}/g, (_whole, name: string) => {
      const definition = allowed.get(name);
      if (!definition) throw new TemplateValidationError(`Unknown Markdown parameter ${name}.`);
      const value = parameters[name];
      if (value === undefined)
        throw new TemplateValidationError(`Markdown parameter ${name} is unresolved.`);
      used.add(name);
      return markdownEscape(value);
    });
  for (const definition of definitions) {
    if (definition.required && !used.has(definition.name))
      throw new TemplateValidationError(
        `Required parameter ${definition.name} was declared but unused.`,
      );
  }
  if (/\{\{[^{}\n]+\}\}/.test(body))
    throw new TemplateValidationError(`Unresolved placeholder remains in ${file.path}.`);
  return new TextEncoder().encode(
    `---\n${stringify(renderedFrontmatter, { lineWidth: 0 }).trimEnd()}\n---\n${body.replace(/^\n/, '')}`,
  );
}

async function resolveRelative(manifestUri: string, path: string): Promise<string> {
  return manifestUri.startsWith('file:')
    ? FileTemplateResolver.resolveRelative(manifestUri, path)
    : relativeTemplateUri(manifestUri, path);
}

export async function renderTemplateBundle(
  request: RenderTemplateRequest,
): Promise<RenderTemplateResult> {
  const resolvers = request.resolvers ?? [
    new FileTemplateResolver(),
    new HttpsTemplateResolver(),
    ...(request.ipfsGateway ? [new IpfsTemplateResolver(request.ipfsGateway)] : []),
  ];
  if (request.manifestUri.startsWith('https:') && !request.manifestSha256 && !request.manifestCid) {
    throw new Error('HTTPS manifests require --manifest-sha256 or --manifest-cid.');
  }
  if (request.manifestUri.startsWith('ipfs:') && !request.ipfsGateway) {
    throw new Error('IPFS templates require an explicit HTTPS gateway.');
  }
  const context = { maxBytes: MAX_LINKED_BYTES, timeoutMs: request.timeoutMs ?? 10_000 };
  const manifestResource = await chooseResolver(request.manifestUri, resolvers).resolve(
    request.manifestUri,
    context,
  );
  const ipfsManifest = request.manifestUri.startsWith('ipfs:')
    ? new URL(request.manifestUri)
    : undefined;
  if (
    ipfsManifest &&
    ipfsManifest.pathname !== '' &&
    ipfsManifest.pathname !== '/' &&
    !request.manifestSha256
  ) {
    throw new Error('IPFS manifests below a root path require an explicit SHA-256 digest.');
  }
  const impliedCid =
    ipfsManifest && (ipfsManifest.pathname === '' || ipfsManifest.pathname === '/')
      ? ipfsManifest.hostname
      : undefined;
  await verifyIdentity(manifestResource, request.manifestSha256, request.manifestCid ?? impliedCid);
  let manifest;
  try {
    manifest = parseTemplateManifest(manifestResource.bytes);
  } catch (error) {
    throw new TemplateValidationError(
      `Template manifest is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (manifest.protocol !== request.expectedProtocol)
    throw new TemplateValidationError(
      'Template manifest protocol does not match expectedProtocol.',
    );
  const bundle = manifest.bundles.find(
    (candidate) => candidate.derived_type === request.derivedType,
  );
  if (!bundle)
    throw new TemplateValidationError(`Template manifest has no ${request.derivedType} bundle.`);
  const parameterDigest = sha(new TextEncoder().encode(canonical(request.parameters)));
  const draftId = deterministicUuid(
    `${manifest.protocol}:${bundle.bundle_version}:${sha(manifestResource.bytes)}:${parameterDigest}`,
  );

  const rendered: RenderedFile[] = [];
  for (const file of bundle.files) {
    const uri = file.uri ?? (await resolveRelative(manifestResource.uri, file.path));
    const resource = await chooseResolver(uri, resolvers).resolve(uri, context);
    if (!manifestResource.uri.startsWith('file:') && resource.uri.startsWith('file:')) {
      throw new TemplateValidationError('Remote manifests cannot resolve local file resources.');
    }
    if (resource.bytes.byteLength > file.max_bytes) {
      throw new TemplateValidationError(
        `Template ${file.path} exceeds its declared max_bytes limit.`,
      );
    }
    await verifyIdentity(resource, file.sha256, file.cid);
    let source: string;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(resource.bytes);
    } catch {
      throw new TemplateValidationError(`Template ${file.path} is not valid UTF-8.`);
    }
    const bytes =
      file.media_type === 'text/markdown'
        ? renderMarkdownTemplate(
            source,
            file,
            request.expectedProtocol,
            request.derivedType,
            request.parameters,
            draftId,
          )
        : resource.bytes;
    rendered.push({
      role: file.role,
      path: file.path.replace(/^templates\/[a-z0-9_-]+\//, '').replace(/\.tmpl$/, ''),
      bytes,
      sha256: sha(bytes),
      sourceUri: resource.uri,
    });
  }
  const domain = rendered.find((file) => basename(file.path) === 'domain.md');
  if (!domain) throw new TemplateValidationError('Rendered bundle must contain domain.md.');
  const domainText = new TextDecoder().decode(domain.bytes);
  const report = lint(domainText, { sourceName: domain.path, expectedProfile: 'authoring_draft' });
  if (!report.ok)
    throw new TemplateValidationError(
      `Rendered domain.md failed validation: ${report.findings
        .filter((item) => item.severity === 'error')
        .map((item) => `${item.code}: ${item.message}`)
        .join('; ')}`,
    );
  const provenance = stringify(
    {
      provenance: {
        state: 'authoring_draft',
        specification_version: SPEC_VERSION,
        protocol: manifest.protocol,
        protocol_version: manifest.protocol_version,
        manifest: { uri: manifestResource.uri, sha256: sha(manifestResource.bytes) },
        bundle: { derived_type: bundle.derived_type, version: bundle.bundle_version },
        draft_domain_id: `urn:uuid:${draftId}`,
        files: rendered.map((file) => ({
          role: file.role,
          path: file.path,
          source_uri: file.sourceUri,
          sha256: file.sha256,
        })),
        parameters_digest: parameterDigest,
      },
    },
    { lineWidth: 0 },
  );
  return { files: rendered, provenance, report, manifest };
}
