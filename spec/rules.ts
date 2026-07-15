export type RuleSeverity = 'error' | 'warning' | 'info';

export interface RuleDefinition {
  code: string;
  severity: RuleSeverity;
  description: string;
}

export const RULES: RuleDefinition[] = [
  {
    code: 'file-too-large',
    severity: 'error',
    description:
      'Reject domain input that exceeds the configured byte limit before model construction.',
  },
  {
    code: 'encoding',
    severity: 'error',
    description: 'Require strict UTF-8 without a byte-order mark.',
  },
  {
    code: 'missing-frontmatter',
    severity: 'error',
    description: 'Require YAML frontmatter at the beginning of every domain.md.',
  },
  {
    code: 'frontmatter-fence',
    severity: 'error',
    description: 'Require exactly one valid frontmatter fence at the beginning of the document.',
  },
  {
    code: 'frontmatter-shape',
    severity: 'error',
    description: 'Require frontmatter to decode to a mapping.',
  },
  {
    code: 'unsafe-yaml',
    severity: 'error',
    description:
      'Reject duplicate keys, aliases, anchors, custom tags, merge keys, and unsafe YAML limits.',
  },
  {
    code: 'schema',
    severity: 'error',
    description: 'Require frontmatter to satisfy the matching domain.md JSON Schema.',
  },
  {
    code: 'profile-mismatch',
    severity: 'error',
    description: 'Require an asserted profile to match the document profile.',
  },
  {
    code: 'template-placeholder',
    severity: 'error',
    description: 'Reject unresolved authoring or publication placeholders in conforming output.',
  },
  {
    code: 'secret-in-index',
    severity: 'error',
    description: 'Reject secret-bearing fields and private key material.',
  },
  {
    code: 'privacy-public-sensitive',
    severity: 'error',
    description: 'Reject public access for sensitive documents, resources, and services.',
  },
  {
    code: 'duplicate-entry-id',
    severity: 'error',
    description:
      'Require controller, right, resource, flow, and transition identifiers to be unique.',
  },
  {
    code: 'duplicate-section',
    severity: 'error',
    description: 'Reject duplicate canonical Markdown sections.',
  },
  {
    code: 'missing-required-section',
    severity: 'error',
    description: 'Require every section declared by validation.required_sections.',
  },
  {
    code: 'section-order',
    severity: 'warning',
    description: 'Report canonical sections that appear out of order.',
  },
  {
    code: 'unknown-section',
    severity: 'info',
    description: 'Preserve and report unknown Markdown sections.',
  },
  {
    code: 'unknown-top-level-key',
    severity: 'warning',
    description: 'Report unknown non-extension frontmatter fields.',
  },
  {
    code: 'document-contract',
    severity: 'error',
    description:
      'Enforce universal roles, manifest authority, disclosure, privacy, and profile identity rules.',
  },
  {
    code: 'broken-local-reference',
    severity: 'error',
    description:
      'Require locally scoped controller, right, resource, claim, flow, and transition references to resolve.',
  },
  {
    code: 'source-authority',
    severity: 'error',
    description:
      'Require fact-scoped authority sources to appear in the conflict-resolution order.',
  },
  {
    code: 'incomplete-claim-contract',
    severity: 'error',
    description:
      'Require claim evidence, rubric, determination, review, and next-action contracts.',
  },
  {
    code: 'invalid-flow',
    severity: 'error',
    description:
      'Require valid, reachable, right-gated flow transitions and review for consequential effects.',
  },
  {
    code: 'template-contract',
    severity: 'error',
    description:
      'Require a pinned protocol, derived type, allowlisted path, parameter schema, and verified file identity.',
  },
  {
    code: 'integrity-mismatch',
    severity: 'error',
    description: 'Reject bytes that do not match their declared SHA-256 digest or CID.',
  },
  {
    code: 'network-policy',
    severity: 'error',
    description:
      'Reject unsafe HTTPS or IPFS retrieval, redirects, credentials, and private network targets.',
  },
  {
    code: 'runtime-external-checks-required',
    severity: 'info',
    description:
      'Identify checks that static validation cannot prove for anchored and runtime profiles.',
  },
];
