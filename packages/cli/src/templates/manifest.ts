import type { Ajv as AjvCore, Options } from 'ajv';
import Ajv2020Import from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import { isAlias, parseDocument, visit as visitYaml } from 'yaml';

import {
  MAX_LINKED_BYTES,
  MAX_SCALAR_LENGTH,
  MAX_YAML_DEPTH,
  MAX_YAML_NODES,
} from '../constants.js';
import { getTemplateManifestSchema } from '../spec.js';
import type { TemplateManifest } from './types.js';

const Ajv2020 = Ajv2020Import as unknown as new (options?: Options) => AjvCore;
const addFormats = addFormatsImport as unknown as (ajv: AjvCore) => AjvCore;
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
const validate = ajv.compile(getTemplateManifestSchema());

export function parseTemplateManifest(bytes: Uint8Array): TemplateManifest {
  if (bytes.byteLength > MAX_LINKED_BYTES)
    throw new Error(`Template manifest exceeds ${MAX_LINKED_BYTES} bytes.`);
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const document = parseDocument(source, { prettyErrors: true, uniqueKeys: true, version: '1.2' });
  if (document.errors.length > 0 || document.warnings.length > 0) {
    throw new Error(
      [...document.errors, ...document.warnings].map((item) => item.message).join('; '),
    );
  }
  const unsafe = new Set<string>();
  let nodes = 0;
  let depth = 0;
  let scalarTooLong = false;
  visitYaml(document, {
    Node(_key, node, path) {
      const candidate = node as { anchor?: string; tag?: string; value?: unknown };
      nodes += 1;
      depth = Math.max(depth, path.length + 1);
      if (typeof candidate.value === 'string' && candidate.value.length > MAX_SCALAR_LENGTH)
        scalarTooLong = true;
      if (isAlias(node)) unsafe.add('alias');
      if (candidate.anchor) unsafe.add('anchor');
      if (candidate.tag?.startsWith('!')) unsafe.add('custom-tag');
    },
    Pair(_key, pair) {
      const key = pair.key as { value?: unknown } | null;
      if (key?.value === '<<') unsafe.add('merge-key');
    },
  });
  if (nodes > MAX_YAML_NODES || depth > MAX_YAML_DEPTH || scalarTooLong) {
    throw new Error('Template manifest exceeds YAML node, depth, or scalar limits.');
  }
  if (unsafe.size > 0)
    throw new Error(
      `Template manifest contains forbidden YAML features: ${[...unsafe].sort().join(', ')}.`,
    );
  const value: unknown = document.toJS({ maxAliasCount: 0 });
  if (!validate(value)) {
    const message = (validate.errors ?? [])
      .map((error) => `${error.instancePath || '$'} ${error.message ?? 'is invalid'}`)
      .join('; ');
    throw new Error(`Invalid template manifest: ${message}`);
  }
  const manifest = value as TemplateManifest;
  const derivedTypes = new Set<string>();
  for (const bundle of manifest.bundles) {
    if (derivedTypes.has(bundle.derived_type))
      throw new Error(`Duplicate template bundle ${bundle.derived_type}.`);
    derivedTypes.add(bundle.derived_type);
    const paths = new Set<string>();
    for (const file of bundle.files) {
      if (!file.path.startsWith(`templates/${bundle.derived_type}/`)) {
        throw new Error(
          `Template path ${file.path} does not match bundle type ${bundle.derived_type}.`,
        );
      }
      if (paths.has(file.path)) throw new Error(`Duplicate template path ${file.path}.`);
      paths.add(file.path);
    }
    const domainFiles = bundle.files.filter((file) => file.role === 'domain.md');
    if (
      domainFiles.length !== 1 ||
      domainFiles[0]?.media_type !== 'text/markdown' ||
      domainFiles[0].required !== true ||
      domainFiles[0].path !== `templates/${bundle.derived_type}/domain.md.tmpl`
    ) {
      throw new Error(
        `Template bundle ${bundle.derived_type} must contain exactly one required Markdown domain.md.`,
      );
    }
  }
  return manifest;
}
