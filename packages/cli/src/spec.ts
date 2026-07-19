import { readFileSync } from 'node:fs';

import type { DomainRecord } from './types.js';

const assets = new URL('../assets/', import.meta.url);

function readAsset(name: string): string {
  return readFileSync(new URL(name, assets), 'utf8');
}

export function getSpecification(): string {
  return readAsset('spec.md');
}

export function getSchema(): DomainRecord {
  return JSON.parse(getSchemaSource()) as DomainRecord;
}

export function getSchemaSource(): string {
  return readAsset('domain-md.schema.json');
}

export function getTemplateManifestSchema(): DomainRecord {
  return JSON.parse(readAsset('template-manifest.schema.json')) as DomainRecord;
}

export function getOracleCapsuleSchema(): DomainRecord {
  return JSON.parse(readAsset('oracle-capsule.schema.json')) as DomainRecord;
}

export function getOracleCapsuleSourceLockSchema(): DomainRecord {
  return JSON.parse(readAsset('oracle-capsule-source-lock.schema.json')) as DomainRecord;
}

export function getOracleCapsuleContract(): string {
  return readAsset('oracle-capsule-manifest-contract.md');
}

export function getOracleCapsuleJcsVectors(): unknown {
  return JSON.parse(readAsset('oracle-capsule-jcs-vectors.json')) as unknown;
}

export function getRules(): {
  specVersion: string;
  rules: Array<{ code: string; severity: string; description: string }>;
} {
  return JSON.parse(readAsset('rules.json')) as ReturnType<typeof getRules>;
}
