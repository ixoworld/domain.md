export const SPEC_VERSION = '1.0.0-rc.1';
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
] as const;
