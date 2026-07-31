export const PACKAGE_VERSION = '0.3.0';
export const SPEC_VERSION = '1.0.0-rc.3';
export const SCHEMA_ID = `urn:ixo:domain-md:schema:${SPEC_VERSION}`;
export const TEMPLATE_SCHEMA_ID = `urn:ixo:domain-md:template-manifest-schema:${SPEC_VERSION}`;
export const ORACLE_CAPSULE_CONTRACT = 'ixo.earth/oracle-capsule/v0alpha1';
export const ORACLE_CAPSULE_SCHEMA_ID = 'urn:ixo:domain-md:x-oracle-capsule:manifest:0.1.0';
export const ORACLE_CAPSULE_SOURCE_LOCK_SCHEMA_ID =
  'urn:ixo:domain-md:x-oracle-capsule:source-lock:0.1.0';
export const ORACLE_CAPSULE_MEDIA_TYPE = 'application/vnd.ixo.oracle-capsule+json';
export const ORACLE_CAPSULE_SOURCE_LOCK_MEDIA_TYPE =
  'application/vnd.ixo.oracle-capsule.source-lock+json';
export const ORACLE_CAPSULE_LIMITS = {
  maxBytes: 1_048_576,
  maxDepth: 64,
  maxNodes: 10_000,
  maxScalarLength: 10_000,
  maxLockedFiles: 10_000,
  maxLockedBytes: 67_108_864,
} as const;
export const ORACLE_CAPSULE_EXTERNAL_CHECKS = [
  'oracle-identity-current',
  'subject-domain-current',
  'capability-current-and-unrevoked',
  'trusted-time-available',
  'private-resource-access-authorized',
  'human-review-authorized',
  'runtime-distribution-trusted',
  'receipt-signer-current-and-unrevoked',
] as const;
export const MAX_DOMAIN_BYTES = 1024 * 1024;
export const MAX_LINKED_BYTES = 2 * 1024 * 1024;
export const MAX_YAML_DEPTH = 64;
export const MAX_YAML_NODES = 10_000;
export const MAX_SCALAR_LENGTH = 10_000;
export const EXTERNAL_CHECKS = [
  {
    code: 'cid-verification',
    category: 'integrity',
    reason: 'Resolve external bytes and verify their declared CIDs.',
  },
  {
    code: 'did-iid-resolution',
    category: 'identity',
    reason: 'Resolve the current DID/IID state with the configured resolver.',
  },
  {
    code: 'canonical-state-consistency',
    category: 'identity',
    reason: 'Compare the document with current fact-scoped canonical state.',
  },
  {
    code: 'capability-revocation',
    category: 'authorization',
    reason: 'Verify live delegation and revocation state before acting.',
  },
  {
    code: 'trusted-clock',
    category: 'time',
    reason: 'Evaluate time-bound grants against a trusted clock.',
  },
  {
    code: 'chain-anchor',
    category: 'chain',
    reason: 'Verify the declared chain anchor and confirmation policy.',
  },
  {
    code: 'constitutional-instrument-cid',
    category: 'integrity',
    reason: 'Verify every constitutional instrument against its declared CID and exact bytes.',
  },
  {
    code: 'constitutional-authority-current',
    category: 'authorization',
    reason: 'Resolve current adoption, amendment, interpretation, and enforcement authority.',
  },
  {
    code: 'constitutional-effective-status',
    category: 'time',
    reason:
      'Verify effective, suspended, and superseded status against a trusted clock and canonical state.',
  },
  {
    code: 'constitutional-implementation-integrity',
    category: 'integrity',
    reason: 'Verify executable governance code and conformance-test identities.',
  },
  {
    code: 'constitutional-enforcement-deployment',
    category: 'authorization',
    reason: 'Verify the declared enforcement point is deployed and authorized for this subject.',
  },
  {
    code: 'constitutional-ai-profile-binding',
    category: 'authorization',
    reason:
      'Verify the active agent and model profile are bound to the declared principles and procedures.',
  },
] as const;

export const CANONICAL_SECTIONS = [
  'Overview',
  'Operating Model',
  'Authority & Control',
  'Constitutional Governance',
  'Services',
  'Resources',
  'Rights & Capabilities',
  'Claims, Evidence & Evaluation',
  'Linked Entities',
  'Accounts & Value',
  'POD, Flows & Agents',
  'Privacy & Source-of-Truth Boundaries',
  'Playbooks',
  "Do's and Don'ts",
  'Changelog',
] as const;

export const KNOWN_TOP_LEVEL_KEYS = new Set([
  'version',
  'kind',
  'conformance',
  'document_revision',
  'name',
  'description',
  'last_updated',
  'maintainers',
  'domain',
  'source_of_truth',
  'documents',
  'constitution',
  'agent_default_mode',
  'controllers',
  'services',
  'resources',
  'rights',
  'claims',
  'linked_entities',
  'accounts',
  'pods',
  'agents',
  'privacy',
  'graph_policy',
  'validation',
  'critical_do_not',
  'governance',
  'protocols',
  'asset',
  'deed',
  'protocol',
  'investment',
  'x-oracle-capsule',
]);

export const CONSTITUTION_STATUSES = [
  'not_applicable',
  'draft',
  'adopted',
  'in_force',
  'suspended',
  'superseded',
] as const;

export const CONSTITUTION_TYPES = [
  'con:OperationalConstitution',
  'con:PersonalConstitution',
  'con:AssetConstitution',
  'con:FinancialSubjectConstitution',
  'con:WorkConstitution',
  'con:ServiceConstitution',
  'con:OracleConstitution',
  'con:InformationSubjectConstitution',
  'con:PlaceConstitution',
  'con:BiologicalSubjectConstitution',
  'con:NetworkConstitution',
  'con:StateConstitution',
  'con:InternationalOrganizationConstitution',
  'con:OrganizationalConstitution',
  'con:CorporateConstitution',
  'con:TrustConstitution',
  'con:CooperativeConstitution',
  'con:PartnershipConstitution',
  'con:FoundationConstitution',
  'con:PublicBodyConstitution',
  'con:ProjectConstitution',
  'con:ProtocolConstitution',
  'con:DAOConstitution',
  'con:AgenticConstitution',
  'con:SchemeConstitution',
] as const;

export const CONSTITUTIONAL_SUBJECT_TYPES = [
  'con:Person',
  'con:Organization',
  'con:Asset',
  'con:Commodity',
  'con:FinancialInstrument',
  'con:PropertyRight',
  'con:Agreement',
  'con:Deed',
  'con:Project',
  'con:Work',
  'con:Protocol',
  'con:Service',
  'con:Oracle',
  'con:Claim',
  'con:Credential',
  'con:Evidence',
  'con:Decision',
  'con:Outcome',
  'con:Place',
  'con:BiologicalEntity',
  'con:Network',
  'con:AgenticTwin',
] as const;

export const CONSTITUTIONAL_ARCHETYPES = [
  'con:Stewarded',
  'con:Owned',
  'con:Managed',
  'con:Governed',
  'con:Regulated',
  'con:Verified',
  'con:Settled',
] as const;

export const CONSTITUTION_INSTRUMENT_FUNCTIONS = [
  'constitutive',
  'governing',
  'amending',
  'interpretive',
  'executable',
] as const;

export const CONSTITUTION_EXECUTION_MODES = [
  'human_interpreted',
  'machine_assisted',
  'machine_executable',
  'hybrid',
] as const;

export const CONSTITUTION_AI_MODES = [
  'none',
  'context_only',
  'critique_and_revise',
  'policy_evaluate',
  'hybrid',
] as const;
