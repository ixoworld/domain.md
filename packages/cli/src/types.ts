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

export type ConstitutionStatus =
  'not_applicable' | 'draft' | 'adopted' | 'in_force' | 'suspended' | 'superseded';

export type ConstitutionalInstrumentFunction =
  'constitutive' | 'governing' | 'amending' | 'interpretive' | 'executable';

export interface LegalEffect {
  status: 'none' | 'claimed' | 'verified' | 'unknown';
  jurisdiction: string | null;
  authority_evidence: string[];
}

export interface ConstitutionalInstrument {
  document_ref: string;
  type: string;
  functions: ConstitutionalInstrumentFunction[];
  canonical: boolean;
  effective_from: string | null;
  effective_until: string | null;
}

export interface ConstitutionalGovernance {
  authority_sources: string[];
  decision_procedure: string | null;
  amendment_procedure: string | null;
  interpretation_procedure: string | null;
  dispute_resolution_procedure: string | null;
  suspension_procedure: string | null;
  dissolution_procedure: string | null;
}

export interface ConstitutionalExecution {
  mode: 'human_interpreted' | 'machine_assisted' | 'machine_executable' | 'hybrid';
  implementations: string[];
  conformance_tests: string[];
  enforcement_points: string[];
  failure_policy: 'deny' | 'pause_and_escalate';
  human_review_required_for: string[];
}

export interface ConstitutionalAI {
  mode: 'none' | 'context_only' | 'critique_and_revise' | 'policy_evaluate' | 'hybrid';
  applies_to_agents: string[];
  principles: string[];
  critique_procedure: string | null;
  revision_procedure: string | null;
  decision_procedure: string | null;
  model_profile: string | null;
  conflict_policy: 'canonical_authority_prevails';
  audit_record: string | null;
}

export interface ConstitutionDeclaration {
  status: ConstitutionStatus;
  reason: string | null;
  subject: string;
  type: string;
  legal_effect?: LegalEffect;
  norms?: string[];
  instruments?: ConstitutionalInstrument[];
  governance?: ConstitutionalGovernance;
  execution?: ConstitutionalExecution;
  constitutional_ai?: ConstitutionalAI;
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
