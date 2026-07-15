import { lookup } from 'node:dns/promises';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { request } from 'node:https';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ipaddr from 'ipaddr.js';

import type {
  ResolvedTemplateResource,
  TemplateResolver,
  TemplateResolverContext,
} from './types.js';

function isPublicAddress(address: string): boolean {
  const parsed = ipaddr.parse(address);
  const range = parsed.range();
  return range === 'unicast';
}

export function validateHttpsTarget(url: URL, addresses: string[] = []): void {
  if (url.protocol !== 'https:') throw new Error('Only HTTPS template retrieval is allowed.');
  if (url.username || url.password) throw new Error('Credentials in template URLs are forbidden.');
  if (!url.hostname) throw new Error('Template URL hostname is required.');
  if (addresses.some((address) => !isPublicAddress(address))) {
    throw new Error(`Template hostname ${url.hostname} resolves to a non-public address.`);
  }
}

export class FileTemplateResolver implements TemplateResolver {
  supports(uri: string): boolean {
    return uri.startsWith('file:') || !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(uri);
  }

  async resolve(uri: string, context: TemplateResolverContext): Promise<ResolvedTemplateResource> {
    const path = resolve(uri.startsWith('file:') ? fileURLToPath(uri) : uri);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error('Template resources must be regular files, not symlinks.');
    if (stat.size > context.maxBytes)
      throw new Error(`Template resource exceeds ${context.maxBytes} bytes.`);
    const canonical = await realpath(path);
    if (canonical !== path) throw new Error('Template resource paths must not contain symlinks.');
    return { uri: pathToFileURL(canonical).href, bytes: await readFile(canonical) };
  }

  static async resolveRelative(manifestUri: string, logicalPath: string): Promise<string> {
    const manifestPath = fileURLToPath(manifestUri);
    const root = await realpath(resolve(manifestPath, '..'));
    const requested = resolve(root, logicalPath);
    const lexicalTraversal = relative(root, requested);
    if (
      lexicalTraversal.startsWith('..') ||
      lexicalTraversal.startsWith('/') ||
      lexicalTraversal === ''
    ) {
      throw new Error(`Template path escapes or aliases the manifest root: ${logicalPath}`);
    }
    let current = root;
    for (const component of lexicalTraversal.split(/[\\/]/)) {
      current = resolve(current, component);
      if ((await lstat(current)).isSymbolicLink())
        throw new Error(`Template path contains a symlink: ${logicalPath}`);
    }
    const target = await realpath(requested);
    const traversal = relative(root, target);
    if (traversal.startsWith('..') || traversal.startsWith('/') || traversal === '') {
      throw new Error(`Template path escapes or aliases the manifest root: ${logicalPath}`);
    }
    return pathToFileURL(target).href;
  }
}

interface HttpsResolverOptions {
  maxRedirects?: number;
}

export class HttpsTemplateResolver implements TemplateResolver {
  readonly maxRedirects: number;

  constructor(options: HttpsResolverOptions = {}) {
    this.maxRedirects = options.maxRedirects ?? 3;
  }

  supports(uri: string): boolean {
    return uri.startsWith('https:');
  }

  async resolve(uri: string, context: TemplateResolverContext): Promise<ResolvedTemplateResource> {
    return this.fetch(new URL(uri), context, 0);
  }

  private async fetch(
    url: URL,
    context: TemplateResolverContext,
    redirects: number,
  ): Promise<ResolvedTemplateResource> {
    validateHttpsTarget(url);
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (addresses.length === 0)
      throw new Error(`Template hostname ${url.hostname} did not resolve.`);
    validateHttpsTarget(
      url,
      addresses.map((entry) => entry.address),
    );
    const approved = addresses[0];
    if (!approved) throw new Error(`Template hostname ${url.hostname} did not resolve.`);

    return new Promise((resolvePromise, reject) => {
      const req = request(
        url,
        {
          headers: { accept: 'application/yaml, application/json, text/markdown, text/plain' },
          lookup(_hostname, _options, callback) {
            callback(null, approved.address, approved.family);
          },
          servername: url.hostname,
        },
        (response) => {
          const status = response.statusCode ?? 0;
          const location = response.headers.location;
          if (status >= 300 && status < 400 && location) {
            response.resume();
            if (redirects >= this.maxRedirects) {
              reject(new Error('Template retrieval exceeded the redirect limit.'));
              return;
            }
            const redirected = new URL(location, url);
            this.fetch(redirected, context, redirects + 1).then(resolvePromise, reject);
            return;
          }
          if (status !== 200) {
            response.resume();
            reject(new Error(`Template retrieval returned HTTP ${status}.`));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          response.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > context.maxBytes) {
              req.destroy(new Error(`Template resource exceeds ${context.maxBytes} bytes.`));
              return;
            }
            chunks.push(chunk);
          });
          response.on('end', () => {
            resolvePromise({
              uri: url.href,
              bytes: Buffer.concat(chunks),
              ...(typeof response.headers['content-type'] === 'string'
                ? { mediaType: response.headers['content-type'] }
                : {}),
            });
          });
        },
      );
      req.setTimeout(context.timeoutMs, () =>
        req.destroy(new Error('Template retrieval timed out.')),
      );
      req.on('error', reject);
      req.end();
    });
  }
}

export class IpfsTemplateResolver implements TemplateResolver {
  private readonly gateway: URL;
  private readonly https: HttpsTemplateResolver;

  constructor(gateway: string, httpsResolver = new HttpsTemplateResolver()) {
    this.gateway = new URL(gateway.endsWith('/') ? gateway : `${gateway}/`);
    validateHttpsTarget(this.gateway);
    this.https = httpsResolver;
  }

  supports(uri: string): boolean {
    return uri.startsWith('ipfs:');
  }

  async resolve(uri: string, context: TemplateResolverContext): Promise<ResolvedTemplateResource> {
    const source = new URL(uri);
    const cid = source.hostname;
    if (!cid) throw new Error('IPFS URI must include a CID host.');
    const path = source.pathname.replace(/^\/+/, '');
    const target = new URL(`ipfs/${cid}/${path}`, this.gateway);
    const result = await this.https.resolve(target.href, context);
    return { ...result, uri };
  }
}

export function relativeTemplateUri(manifestUri: string, logicalPath: string): string {
  if (manifestUri.startsWith('ipfs:')) {
    const base = new URL(manifestUri);
    const root = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1);
    base.pathname = `${root}${logicalPath}`;
    return base.href;
  }
  return new URL(logicalPath, manifestUri).href;
}
