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

export const EXTERNAL_CHECKS = [
  'cid-verification',
  'did-iid-resolution',
  'canonical-state-consistency',
  'capability-revocation',
  'trusted-clock',
  'chain-anchor',
  'constitutional-instrument-cid',
  'constitutional-authority-current',
  'constitutional-effective-status',
  'constitutional-implementation-integrity',
  'constitutional-enforcement-deployment',
  'constitutional-ai-profile-binding',
] as const;

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
