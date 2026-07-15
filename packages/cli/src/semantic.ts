import type { Ajv as AjvCore, Options } from 'ajv';
import Ajv2020Import, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';

import { CANONICAL_SECTIONS, KNOWN_TOP_LEVEL_KEYS } from './constants.js';
import { getSchema } from './spec.js';
import type {
  ConformanceProfile,
  DomainDocument,
  DomainMode,
  DomainRecord,
  Finding,
} from './types.js';

const AUTHOR_PLACEHOLDER = /\{\{[^{}\n]+\}\}/;
const PUBLISH_PLACEHOLDER = /<<FILL_AT_PUBLISH:[A-Za-z0-9_.-]+>>/;
const Ajv2020 = Ajv2020Import as unknown as new (options?: Options) => AjvCore;
const addFormats = addFormatsImport as unknown as (ajv: AjvCore) => AjvCore;

function compileSchema(): ValidateFunction {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    strictTypes: false,
  });
  addFormats(ajv);
  return ajv.compile(getSchema());
}

const validateSchema = compileSchema();

function isRecord(value: unknown): value is DomainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function records(value: unknown, key: string): DomainRecord[] {
  return isRecord(value) && Array.isArray(value[key]) ? value[key].filter(isRecord) : [];
}

function add(
  findings: Finding[],
  severity: Finding['severity'],
  code: string,
  message: string,
  path?: string,
): void {
  findings.push({
    severity,
    code,
    message,
    path: path && path.length > 0 ? path : '/',
    location: { line: 1, column: 1 },
  });
}

function locate(document: DomainDocument, finding: Finding): Finding {
  const section = document.sections.find((candidate) => candidate.heading === finding.path);
  if (section) return { ...finding, location: section.location };
  const segment = finding.path.split('/').filter(Boolean).at(-1);
  if (!segment) return finding;
  const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lines = document.raw.split(/\r?\n/);
  const line = lines.findIndex((value) => new RegExp(`^\\s*(?:-\\s*)?${escaped}:`).test(value));
  if (line < 0) return finding;
  const column = (lines[line]?.search(/\S/) ?? 0) + 1;
  return { ...finding, location: { line: line + 1, column } };
}

function uniqueIds(entries: DomainRecord[], label: string, findings: Finding[]): Set<string> {
  const result = new Set<string>();
  for (const entry of entries) {
    if (typeof entry.id !== 'string') continue;
    const id = entry.id.normalize('NFC');
    if (result.has(id))
      add(findings, 'error', 'duplicate-entry-id', `Duplicate ${label} id ${JSON.stringify(id)}.`);
    result.add(id);
  }
  return result;
}

function externalReference(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) || value.startsWith('baf');
}

function inspectSecrets(value: unknown, findings: Finding[], path = ''): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => inspectSecrets(child, findings, `${path}/${index}`));
    return;
  }
  if (!isRecord(value)) {
    if (
      typeof value === 'string' &&
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)
    ) {
      add(findings, 'error', 'secret-in-index', 'Private key material is forbidden.', path);
    }
    if (
      typeof value === 'string' &&
      (/:\/\/[^\s/@:]+:[^\s/@]+@/.test(value) ||
        /[?&](?:access_token|api_key|bearer_token|secret|signature)=[^&#\s]+/i.test(value))
    ) {
      add(
        findings,
        'error',
        'secret-in-index',
        'Credential-bearing URI content is forbidden.',
        path,
      );
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
    if (
      /(^|_)(secret|private_key|seed_phrase|mnemonic|access_token|api_key|bearer_token)($|_)/i.test(
        key,
      )
    ) {
      add(
        findings,
        'error',
        'secret-in-index',
        `Secret-bearing key ${JSON.stringify(key)} is forbidden.`,
        childPath,
      );
    }
    inspectSecrets(child, findings, childPath);
  }
}

function validateSections(document: DomainDocument, findings: Finding[]): void {
  const seen = new Set<string>();
  let previous = -1;
  for (const section of document.sections) {
    if (seen.has(section.heading) && CANONICAL_SECTIONS.includes(section.heading as never)) {
      add(
        findings,
        'error',
        'duplicate-section',
        `Duplicate section ${JSON.stringify(section.heading)}.`,
        section.heading,
      );
    }
    seen.add(section.heading);
    const index = CANONICAL_SECTIONS.indexOf(section.heading as never);
    if (index < 0)
      add(
        findings,
        'info',
        'unknown-section',
        `Unknown section ${JSON.stringify(section.heading)} is preserved.`,
        section.heading,
      );
    else if (index < previous)
      add(
        findings,
        'warning',
        'section-order',
        `Section ${JSON.stringify(section.heading)} is out of canonical order.`,
        section.heading,
      );
    else previous = index;
  }
  const validation = document.frontmatter.validation;
  const required =
    isRecord(validation) && Array.isArray(validation.required_sections)
      ? validation.required_sections.filter((item): item is string => typeof item === 'string')
      : [];
  for (const section of required) {
    if (!seen.has(section))
      add(
        findings,
        'error',
        'missing-required-section',
        `Missing required section ${JSON.stringify(section)}.`,
        section,
      );
  }
}

function documentEntries(value: unknown): DomainRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  return records(value, 'entries');
}

function validateDocuments(frontmatter: DomainRecord, findings: Finding[]): void {
  const entries = documentEntries(frontmatter.documents);
  const roles = entries
    .map((entry) => entry.role)
    .filter((role): role is string => typeof role === 'string');
  for (const required of ['description', 'changelog']) {
    if (!roles.includes(required))
      add(
        findings,
        'error',
        'document-contract',
        `Missing universal document role ${required}.`,
        '/documents/entries',
      );
  }
  const duplicates = roles.filter((role, index) => roles.indexOf(role) !== index);
  for (const role of new Set(duplicates))
    add(
      findings,
      'error',
      'document-contract',
      `Duplicate document role ${role}.`,
      '/documents/entries',
    );
  for (const entry of entries) {
    if (
      entry.role === 'manifest' &&
      (entry.category !== 'manifest' ||
        entry.authority !== 'defining' ||
        entry.disclosure_pass !== 3)
    ) {
      add(
        findings,
        'error',
        'document-contract',
        'Manifest documents must be defining category manifest at disclosure pass 3.',
        '/documents/entries',
      );
    }
    if (entry.sensitivity !== 'public' && entry.access_policy === 'public') {
      add(
        findings,
        'error',
        'document-contract',
        `Sensitive document role ${String(entry.role)} cannot be public.`,
        '/documents/entries',
      );
    }
  }
}

function validateAuthority(
  frontmatter: DomainRecord,
  findings: Finding[],
): { rights: Set<string>; resources: Set<string> } {
  const controllerEntries = records(frontmatter.controllers, 'entries');
  const controllerIds = uniqueIds(controllerEntries, 'controller', findings);
  const summary =
    isRecord(frontmatter.controllers) && isRecord(frontmatter.controllers.summary)
      ? frontmatter.controllers.summary
      : undefined;
  if (
    typeof summary?.primary_controller === 'string' &&
    !controllerIds.has(summary.primary_controller)
  ) {
    add(
      findings,
      'error',
      'broken-local-reference',
      'Primary controller does not resolve.',
      '/controllers/summary/primary_controller',
    );
  }
  const rightEntries = records(frontmatter.rights, 'entries');
  const rights = uniqueIds(rightEntries, 'right', findings);
  const resources = uniqueIds(records(frontmatter.resources, 'entries'), 'resource', findings);
  uniqueIds(records(frontmatter.services, 'entries'), 'service', findings);
  uniqueIds(records(frontmatter.linked_entities, 'entries'), 'linked entity', findings);
  uniqueIds(records(frontmatter.pods, 'entries'), 'POD', findings);
  uniqueIds(records(frontmatter.agents, 'entries'), 'agent', findings);

  if (isRecord(frontmatter.source_of_truth)) {
    const order = new Set(
      Array.isArray(frontmatter.source_of_truth.conflict_resolution_order)
        ? frontmatter.source_of_truth.conflict_resolution_order.filter(
            (item): item is string => typeof item === 'string',
          )
        : [],
    );
    for (const scope of records(frontmatter.source_of_truth, 'authority_scopes')) {
      if (!Array.isArray(scope.sources)) continue;
      for (const source of scope.sources) {
        if (typeof source === 'string' && !order.has(source)) {
          add(
            findings,
            'error',
            'source-authority',
            `Authority source ${JSON.stringify(source)} is absent from conflict_resolution_order.`,
            '/source_of_truth/authority_scopes',
          );
        }
      }
    }
  }
  return { rights, resources };
}

interface FlowIndexEntry {
  transitions: Set<string>;
}

function validateFlows(
  frontmatter: DomainRecord,
  rights: Set<string>,
  findings: Finding[],
): Map<string, FlowIndexEntry> {
  const index = new Map<string, FlowIndexEntry>();
  for (const pod of records(frontmatter.pods, 'entries')) {
    for (const role of records(pod, 'roles')) {
      if (!Array.isArray(role.rights)) continue;
      for (const right of role.rights) {
        if (typeof right === 'string' && !rights.has(right)) {
          add(
            findings,
            'error',
            'broken-local-reference',
            `POD role ${String(role.id)} references missing right ${right}.`,
            '/pods/entries/roles',
          );
        }
      }
    }
    for (const flow of records(pod, 'flows')) {
      if (typeof flow.id !== 'string') continue;
      if (index.has(flow.id))
        add(
          findings,
          'error',
          'duplicate-entry-id',
          `Duplicate flow id ${flow.id}.`,
          '/pods/entries/flows',
        );
      const states = new Set(
        Array.isArray(flow.states)
          ? flow.states.filter((item): item is string => typeof item === 'string')
          : [],
      );
      const transitions = records(flow, 'transitions');
      const transitionIds = uniqueIds(transitions, `transition in ${flow.id}`, findings);
      index.set(flow.id, { transitions: transitionIds });
      const initial = typeof flow.initial_state === 'string' ? flow.initial_state : '';
      if (!states.has(initial))
        add(
          findings,
          'error',
          'invalid-flow',
          `Flow ${flow.id} initial state is not declared.`,
          '/pods/entries/flows',
        );
      const reachable = new Set(initial ? [initial] : []);
      let changed = true;
      while (changed) {
        changed = false;
        for (const transition of transitions) {
          if (
            typeof transition.from === 'string' &&
            typeof transition.to === 'string' &&
            reachable.has(transition.from) &&
            !reachable.has(transition.to)
          ) {
            reachable.add(transition.to);
            changed = true;
          }
        }
      }
      for (const transition of transitions) {
        if (
          (typeof transition.from === 'string' && !states.has(transition.from)) ||
          (typeof transition.to === 'string' && !states.has(transition.to))
        ) {
          add(
            findings,
            'error',
            'invalid-flow',
            `Flow ${flow.id} transition ${String(transition.id)} references an unknown state.`,
            '/pods/entries/flows',
          );
        }
        if (Array.isArray(transition.actor_rights)) {
          for (const right of transition.actor_rights) {
            if (typeof right === 'string' && !rights.has(right))
              add(
                findings,
                'error',
                'broken-local-reference',
                `Flow ${flow.id} references missing right ${right}.`,
                '/pods/entries/flows',
              );
          }
        }
        const effects = Array.isArray(transition.effects) ? transition.effects.map(String) : [];
        if (
          effects.some((effect) =>
            ['credential', 'payment', 'mint', 'burn', 'transfer'].includes(effect),
          ) &&
          transition.human_review !== true
        ) {
          add(
            findings,
            'error',
            'invalid-flow',
            `Consequential transition ${flow.id}/${String(transition.id)} requires human review.`,
            '/pods/entries/flows',
          );
        }
      }
      for (const state of states) {
        if (!reachable.has(state))
          add(
            findings,
            'error',
            'invalid-flow',
            `Flow ${flow.id} state ${state} is unreachable.`,
            '/pods/entries/flows',
          );
      }
    }
  }
  return index;
}

function validateClaims(
  frontmatter: DomainRecord,
  rights: Set<string>,
  resources: Set<string>,
  flows: Map<string, FlowIndexEntry>,
  findings: Finding[],
): void {
  const collections = records(frontmatter.claims, 'collections');
  uniqueIds(collections, 'claim collection', findings);
  for (const collection of collections) {
    const claimTypes = records(collection, 'claim_types');
    uniqueIds(claimTypes, 'claim type', findings);
    for (const claim of claimTypes) {
      for (const field of ['evaluator_right', 'determiner_right']) {
        const right = claim[field];
        if (typeof right === 'string' && !rights.has(right))
          add(
            findings,
            'error',
            'broken-local-reference',
            `Claim ${String(claim.id)} references missing ${field} ${right}.`,
            '/claims/collections',
          );
      }
      const review = isRecord(claim.human_review_policy) ? claim.human_review_policy : undefined;
      if (typeof review?.reviewer_right === 'string' && !rights.has(review.reviewer_right)) {
        add(
          findings,
          'error',
          'broken-local-reference',
          `Claim ${String(claim.id)} reviewer right does not resolve.`,
          '/claims/collections',
        );
      }
      const rubric = isRecord(claim.rubric) ? claim.rubric : undefined;
      if (
        typeof rubric?.resource_id === 'string' &&
        !externalReference(rubric.resource_id) &&
        !resources.has(rubric.resource_id)
      ) {
        add(
          findings,
          'error',
          'broken-local-reference',
          `Claim ${String(claim.id)} rubric does not resolve.`,
          '/claims/collections',
        );
      }
      for (const requirement of records(claim, 'evidence_requirements')) {
        if (
          typeof requirement.resource_id === 'string' &&
          !externalReference(requirement.resource_id) &&
          !resources.has(requirement.resource_id)
        ) {
          add(
            findings,
            'error',
            'broken-local-reference',
            `Claim ${String(claim.id)} evidence resource does not resolve.`,
            '/claims/collections',
          );
        }
      }
      const outcomes = new Set(Array.isArray(claim.allowed_outcomes) ? claim.allowed_outcomes : []);
      for (const action of records(claim, 'next_actions')) {
        if (!outcomes.has(action.outcome))
          add(
            findings,
            'error',
            'incomplete-claim-contract',
            `Claim ${String(claim.id)} next action uses an undeclared outcome.`,
            '/claims/collections',
          );
        const flow = typeof action.flow_id === 'string' ? flows.get(action.flow_id) : undefined;
        if (!flow)
          add(
            findings,
            'error',
            'broken-local-reference',
            `Claim ${String(claim.id)} next-action flow does not resolve.`,
            '/claims/collections',
          );
        else if (typeof action.transition !== 'string' || !flow.transitions.has(action.transition))
          add(
            findings,
            'error',
            'broken-local-reference',
            `Claim ${String(claim.id)} next-action transition does not resolve.`,
            '/claims/collections',
          );
      }
    }
  }
}

function validatePrivacy(frontmatter: DomainRecord, findings: Finding[]): void {
  for (const entry of [
    ...records(frontmatter.documents, 'entries'),
    ...records(frontmatter.resources, 'entries'),
  ]) {
    if (entry.sensitivity !== 'public' && entry.access_policy === 'public') {
      const label =
        typeof entry.id === 'string'
          ? entry.id
          : typeof entry.role === 'string'
            ? entry.role
            : 'entry';
      add(
        findings,
        'error',
        'privacy-public-sensitive',
        `Sensitive ${label} cannot use public access.`,
        '/privacy',
      );
    }
  }
  for (const service of records(frontmatter.services, 'entries')) {
    const auth = isRecord(service.auth) ? service.auth : undefined;
    if (service.data_classification !== 'public' && auth?.method === 'none') {
      add(
        findings,
        'error',
        'privacy-public-sensitive',
        `Non-public service ${String(service.id)} requires an authentication boundary.`,
        '/services/entries',
      );
    }
  }
}

export function inferMode(frontmatter: DomainRecord): DomainMode | null {
  if (!isRecord(frontmatter.domain)) return null;
  if (frontmatter.domain.type === 'protocol') return 'protocol';
  if (typeof frontmatter.domain.class === 'string') return 'derived';
  return 'standalone';
}

export function getProfile(frontmatter: DomainRecord): ConformanceProfile | null {
  return isRecord(frontmatter.conformance) && typeof frontmatter.conformance.profile === 'string'
    ? (frontmatter.conformance.profile as ConformanceProfile)
    : null;
}

export function validateSemantics(
  document: DomainDocument,
  expectedProfile?: ConformanceProfile,
): Finding[] {
  const findings: Finding[] = [];
  if (!validateSchema(document.frontmatter)) {
    for (const error of validateSchema.errors ?? []) {
      add(
        findings,
        'error',
        'schema',
        `${error.instancePath || '$'} ${error.message ?? 'is invalid'}.`,
        error.instancePath || '/',
      );
    }
  }
  const profile = getProfile(document.frontmatter);
  if (expectedProfile !== undefined && profile !== expectedProfile) {
    add(
      findings,
      'error',
      'profile-mismatch',
      `Expected ${expectedProfile}, found ${String(profile)}.`,
      '/conformance/profile',
    );
  }
  if (AUTHOR_PLACEHOLDER.test(document.raw) || PUBLISH_PLACEHOLDER.test(document.raw)) {
    add(
      findings,
      'error',
      'template-placeholder',
      'Conforming domain.md output contains an unresolved placeholder.',
    );
  }
  for (const key of Object.keys(document.frontmatter)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key) && !key.startsWith('x-'))
      add(
        findings,
        'warning',
        'unknown-top-level-key',
        `Unknown top-level key ${JSON.stringify(key)}.`,
        `/${key}`,
      );
  }
  inspectSecrets(document.frontmatter, findings);
  validateSections(document, findings);
  validateDocuments(document.frontmatter, findings);
  const { rights, resources } = validateAuthority(document.frontmatter, findings);
  const flows = validateFlows(document.frontmatter, rights, findings);
  validateClaims(document.frontmatter, rights, resources, flows, findings);
  validatePrivacy(document.frontmatter, findings);
  if (profile === 'anchored' || profile === 'runtime') {
    add(
      findings,
      'info',
      'runtime-external-checks-required',
      'Static validation cannot prove all anchored or runtime checks.',
    );
  }
  return findings.map((finding) => locate(document, finding));
}
