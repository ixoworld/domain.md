import type { LintReport } from '../types.js';

export type TemplateRole =
  | 'domain.md'
  | 'description'
  | 'changelog'
  | 'manifest'
  | 'playbook'
  | 'schema'
  | 'resource'
  | 'policy'
  | 'supporting';

export type TemplateDerivedType =
  | 'dao'
  | 'organisation'
  | 'project'
  | 'asset'
  | 'deed'
  | 'investment'
  | 'oracle'
  | 'service'
  | 'dataset'
  | 'device'
  | 'place'
  | 'portfolio'
  | 'marketplace'
  | 'pod'
  | 'claim_collection'
  | 'custom';

export interface TemplateFileRecord {
  role: TemplateRole;
  path: string;
  media_type: 'text/markdown' | 'application/yaml' | 'application/json' | 'text/plain';
  max_bytes: number;
  uri?: string;
  cid?: string | null;
  sha256?: string | null;
  required: boolean;
}

export interface TemplateBundleRecord {
  derived_type: TemplateDerivedType;
  bundle_version: string;
  files: TemplateFileRecord[];
}

export interface TemplateManifest {
  version: '1.0.0-rc.1';
  kind: 'domain.md/template-manifest';
  protocol: string;
  protocol_version: string;
  bundles: TemplateBundleRecord[];
}

export interface ResolvedTemplateResource {
  uri: string;
  bytes: Uint8Array;
  mediaType?: string;
}

export interface TemplateResolverContext {
  maxBytes: number;
  timeoutMs: number;
}

export interface TemplateResolver {
  supports(uri: string): boolean;
  resolve(uri: string, context: TemplateResolverContext): Promise<ResolvedTemplateResource>;
}

export interface RenderTemplateRequest {
  manifestUri: string;
  expectedProtocol: string;
  derivedType: TemplateDerivedType;
  parameters: Record<string, unknown>;
  manifestSha256?: string;
  manifestCid?: string;
  ipfsGateway?: string;
  resolvers?: TemplateResolver[];
  timeoutMs?: number;
}

export interface RenderedFile {
  role: string;
  path: string;
  bytes: Uint8Array;
  sha256: string;
  sourceUri: string;
}

export interface RenderTemplateResult {
  files: RenderedFile[];
  provenance: string;
  report: LintReport;
  manifest: TemplateManifest;
}
