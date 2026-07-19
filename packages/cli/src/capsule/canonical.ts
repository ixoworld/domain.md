import { createHash } from 'node:crypto';

import type { JsonValue } from './types.js';

export class CapsuleCanonicalizationError extends Error {
  readonly code = 'capsule-canonicalization';
}

function canonical(value: unknown, path: string): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const low = value.charCodeAt(index + 1);
        if (!Number.isInteger(low) || low < 0xdc00 || low > 0xdfff)
          throw new CapsuleCanonicalizationError(`Lone high surrogate at ${path}.`);
        index += 1;
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        throw new CapsuleCanonicalizationError(`Lone low surrogate at ${path}.`);
      }
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new CapsuleCanonicalizationError(`Non-finite number at ${path}.`);
    if (Number.isInteger(value) && !Number.isSafeInteger(value))
      throw new CapsuleCanonicalizationError(`Unsafe integer at ${path}.`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((child, index) => canonical(child, `${path}/${index}`)).join(',')}]`;
  }
  if (typeof value === 'object' && value !== undefined) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${canonical(key, path)}:${canonical(record[key], `${path}/${key}`)}`)
      .join(',')}}`;
  }
  throw new CapsuleCanonicalizationError(`Unsupported JSON value at ${path}.`);
}

/** RFC 8785 JCS serialization for already parsed I-JSON-compatible values. */
export function canonicalizeCapsuleJson(value: JsonValue): string {
  return canonical(value, '/');
}

export function capsuleJcsSha256(value: JsonValue): string {
  return createHash('sha256').update(canonicalizeCapsuleJson(value), 'utf8').digest('hex');
}

/**
 * Release digests omit only metadata.release_digest, the one self-referential
 * field. Exact fetched-byte SHA/CID verification remains a separate operation.
 */
export function oracleCapsuleReleaseProjection(value: JsonValue): JsonValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new CapsuleCanonicalizationError('A capsule release must be a JSON object.');
  const root = structuredClone(value) as Record<string, JsonValue>;
  const metadata = root.metadata;
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))
    throw new CapsuleCanonicalizationError('A capsule release must contain metadata.');
  const projectedMetadata = { ...metadata } as Record<string, JsonValue>;
  delete projectedMetadata.release_digest;
  root.metadata = projectedMetadata;
  return root;
}

export function oracleCapsuleReleaseDigest(value: JsonValue): string {
  return capsuleJcsSha256(oracleCapsuleReleaseProjection(value));
}
