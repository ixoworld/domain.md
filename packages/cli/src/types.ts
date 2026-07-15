export type Severity = 'error' | 'warning' | 'info';
export type ConformanceProfile = 'authoring_draft' | 'persisted_draft' | 'anchored' | 'runtime';
export type DomainMode = 'derived' | 'protocol' | 'standalone';
export type DomainRecord = Record<string, unknown>;

export interface SourceLocation {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface Finding {
  severity: Severity;
  code: string;
  message: string;
  path: string;
  location: SourceLocation;
  remediation?: string;
}

export interface DomainSection {
  heading: string;
  content: string;
  location: SourceLocation;
}

export interface DomainDocument {
  frontmatter: DomainRecord;
  sections: DomainSection[];
  sourceName: string;
  raw: string;
}

export interface ParseOptions {
  sourceName?: string;
  maxBytes?: number;
}

export interface ParseResult {
  ok: boolean;
  document?: DomainDocument;
  findings: Finding[];
}

export interface LintOptions extends ParseOptions {
  expectedProfile?: ConformanceProfile;
}

export interface FindingSummary {
  errors: number;
  warnings: number;
  infos: number;
}

export interface ExternalCheck {
  code: string;
  category: 'integrity' | 'identity' | 'authorization' | 'time' | 'chain';
  reason: string;
}

export interface LintReport {
  tool: '@ixo/domain.md';
  toolVersion: string;
  specVersion: string;
  sourceName: string;
  mode: DomainMode | null;
  profile: ConformanceProfile | null;
  status: 'static-pass' | 'fail';
  ok: boolean;
  summary: FindingSummary;
  findings: Finding[];
  externalChecksRequired: ExternalCheck[];
  document?: DomainDocument;
}

export type ChangeClassification = 'security-sensitive' | 'operational' | 'narrative';

export interface DomainChange {
  path: string;
  classification: ChangeClassification;
  before?: unknown;
  after?: unknown;
}

export interface DiffOptions {
  failOn?: 'regression' | 'review';
}

export interface DiffReport {
  before: FindingSummary;
  after: FindingSummary;
  changes: DomainChange[];
  conformanceRegression: boolean;
  requiresReview: boolean;
  regression: boolean;
}

export interface ExportOptions {
  format: 'json' | 'sarif';
  sourceName?: string;
}
