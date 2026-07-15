export const SPEC_VERSION = '1.0.0-rc.1';
export const SCHEMA_ID = `urn:ixo:domain-md:schema:${SPEC_VERSION}`;
export const TEMPLATE_SCHEMA_ID = `urn:ixo:domain-md:template-manifest-schema:${SPEC_VERSION}`;

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
