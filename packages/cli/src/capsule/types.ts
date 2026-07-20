import type { Finding, SourceLocation } from '../types.js';

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface StrictJsonOptions {
  sourceName?: string;
  maxBytes?: number;
  maxDepth?: number;
  maxNodes?: number;
  maxScalarLength?: number;
}

export interface StrictJsonDocument {
  value: JsonValue;
  raw: string;
  sourceName: string;
  locations: ReadonlyMap<string, SourceLocation>;
}

export interface StrictJsonResult {
  ok: boolean;
  document?: StrictJsonDocument;
  findings: Finding[];
}

export type CapsuleExternalCheckCategory =
  'identity' | 'authorization' | 'time' | 'privacy' | 'review' | 'distribution' | 'signer';

export interface CapsuleExternalCheck {
  code: string;
  category: CapsuleExternalCheckCategory;
  reason: string;
}

export interface CapsuleValidationOptions extends StrictJsonOptions {
  expectedIdentity?: {
    cid: string;
    sha256: string;
    bytes?: number;
  };
  sourceLock?: string | Uint8Array;
  lockedFiles?: Readonly<Record<string, string | Uint8Array>>;
}

export interface CapsuleValidationReport {
  tool: '@ixo/domain.md';
  contract: 'ixo.earth/oracle-capsule/v0alpha1';
  sourceName: string;
  status: 'static-pass' | 'fail';
  ok: boolean;
  findings: Finding[];
  externalChecksRequired: CapsuleExternalCheck[];
  manifest?: JsonValue;
}

export interface JcsGoldenVector {
  name: string;
  input: string;
  canonical?: string;
  sha256?: string;
  errorCode?: string;
}
