import { describe, expect, it } from 'vitest';

import { lint } from '../src/lint.js';
import { parseDomain } from '../src/parser.js';
import { getProfile, inferMode, validateSemantics } from '../src/semantic.js';
import { example } from './helpers.js';

describe('lint', () => {
  it.each([
    ['project-authoring', 'derived'],
    ['protocol-domain', 'protocol'],
    ['service-domain', 'derived'],
  ] as const)('validates %s as %s', async (name, mode) => {
    const report = lint(await example(name));
    expect(report.ok, JSON.stringify(report.findings)).toBe(true);
    expect(report.mode).toBe(mode);
    expect(report.status).toBe('static-pass');
  });

  it('rejects unresolved placeholders', async () => {
    const report = lint((await example()).replace('Verified Field Services POD', '{{name}}'));
    expect(report.findings.some((finding) => finding.code === 'template-placeholder')).toBe(true);
  });

  it('rejects secret-bearing fields', async () => {
    const report = lint(
      (await example()).replace(
        'name: "Verified Field Services POD"',
        'api_key: "not-a-real-key"\nname: "Verified Field Services POD"',
      ),
    );
    expect(report.findings.some((finding) => finding.code === 'secret-in-index')).toBe(true);
  });

  it('rejects credential-bearing URIs', async () => {
    const report = lint(
      (await example()).replace(
        'endpoint: "matrix:!field-services:ixo.world"',
        'endpoint: "https://user:password@example.com/service"',
      ),
    );
    expect(
      report.findings.some(
        (finding) => finding.code === 'secret-in-index' && finding.message.includes('URI'),
      ),
    ).toBe(true);
  });

  it('detects duplicate identifiers and broken references', async () => {
    const duplicated = (await example()).replace(
      'id: "right:verifier:determine-service-claim"',
      'id: "right:evidence-oracle:evaluate-service-claim"',
    );
    const report = lint(duplicated);
    expect(report.findings.some((finding) => finding.code === 'duplicate-entry-id')).toBe(true);
    expect(report.findings.some((finding) => finding.code === 'broken-local-reference')).toBe(true);
  });

  it('detects an unreachable flow state', async () => {
    const changed = (await example()).replace(
      'states: [ "submitted", "evaluating", "review_required", "determined", "actioned", "closed" ]',
      'states: [ "submitted", "evaluating", "review_required", "determined", "actioned", "closed", "orphaned" ]',
    );
    expect(
      lint(changed).findings.some(
        (finding) => finding.code === 'invalid-flow' && finding.message.includes('unreachable'),
      ),
    ).toBe(true);
  });

  it('rejects persisted drafts with null document identities', async () => {
    const changed = (await example()).replace(
      'profile: "authoring_draft"',
      'profile: "persisted_draft"',
    );
    expect(lint(changed).findings.some((finding) => finding.code === 'schema')).toBe(true);
  });

  it('preserves extensions and reports unknown sections', async () => {
    const changed =
      (await example()).replace(
        'document_revision: "0.1.0"',
        'x-ixo-test: true\ndocument_revision: "0.1.0"',
      ) + '\n## Extension Section\n\nPreserve me.\n';
    const report = lint(changed);
    expect(report.findings.some((finding) => finding.code === 'unknown-top-level-key')).toBe(false);
    expect(report.findings.some((finding) => finding.code === 'unknown-section')).toBe(true);
  });

  it('marks runtime validation as static and lists external checks', async () => {
    const changed = (await example()).replace('profile: "authoring_draft"', 'profile: "runtime"');
    const report = lint(changed);
    expect(report.externalChecksRequired.some((check) => check.code === 'chain-anchor')).toBe(true);
    expect(
      report.findings.some((finding) => finding.code === 'runtime-external-checks-required'),
    ).toBe(true);
  });

  it('enforces required, unique, canonically ordered sections', async () => {
    const base = await example();
    const duplicate = lint(`${base}\n## Overview\nRepeated.\n`);
    const reordered = lint(
      base
        .replace('## Overview', '## Temporary Section')
        .replace('## Authority & Control', '## Overview')
        .replace('## Temporary Section', '## Authority & Control'),
    );
    const missing = lint(base.replace('## Authority & Control', '## Renamed Authority'));
    expect(duplicate.findings.some((finding) => finding.code === 'duplicate-section')).toBe(true);
    expect(reordered.findings.some((finding) => finding.code === 'section-order')).toBe(true);
    expect(missing.findings.some((finding) => finding.code === 'missing-required-section')).toBe(
      true,
    );
  });

  it('enforces the document role and disclosure contract', async () => {
    const base = await example();
    const missing = lint(base.replace('role: "description"', 'role: "supporting"'));
    const duplicate = lint(base.replace('role: "changelog"', 'role: "description"'));
    const manifest = lint(
      base.replace(
        'category: "manifest", manifest_type: "charter"',
        'category: "universal", manifest_type: "charter"',
      ),
    );
    const disclosure = lint(
      base.replace(
        'sensitivity: "internal", access_policy: "role_based"',
        'sensitivity: "internal", access_policy: "public"',
      ),
    );
    expect(
      missing.findings.some(
        (finding) =>
          finding.code === 'document-contract' && finding.message.includes('description'),
      ),
    ).toBe(true);
    expect(
      duplicate.findings.some(
        (finding) => finding.code === 'document-contract' && finding.message.includes('Duplicate'),
      ),
    ).toBe(true);
    expect(
      manifest.findings.some(
        (finding) => finding.code === 'document-contract' && finding.message.includes('Manifest'),
      ),
    ).toBe(true);
    expect(
      disclosure.findings.some(
        (finding) =>
          finding.code === 'document-contract' && finding.message.includes('cannot be public'),
      ),
    ).toBe(true);
  });

  it('enforces controller and source authority references', async () => {
    const base = await example();
    const primary = lint(
      base.replace(
        'primary_controller: "did:ixo:dao:marketplace-operators"',
        'primary_controller: "did:ixo:dao:missing"',
      ),
    );
    const authority = lint(
      base.replace(
        'sources: [ "protocol_state", "iid_document" ]',
        'sources: [ "protocol_state", "undeclared_source" ]',
      ),
    );
    expect(
      primary.findings.some(
        (finding) =>
          finding.code === 'broken-local-reference' &&
          finding.message.includes('Primary controller'),
      ),
    ).toBe(true);
    expect(authority.findings.some((finding) => finding.code === 'source-authority')).toBe(true);
  });

  it('enforces flow state, right, and review invariants', async () => {
    const base = await example();
    const initial = lint(base.replace('initial_state: "submitted"', 'initial_state: "missing"'));
    const state = lint(
      base.replace('from: "submitted", to: "evaluating"', 'from: "unknown", to: "evaluating"'),
    );
    const right = lint(
      base.replace(
        'actor_rights: [ "right:evidence-oracle:evaluate-service-claim" ]',
        'actor_rights: [ "right:missing" ]',
      ),
    );
    const review = lint(
      base.replace(
        'human_review: true, effects: [ "payment" ]',
        'human_review: false, effects: [ "payment" ]',
      ),
    );
    expect(
      initial.findings.some(
        (finding) => finding.code === 'invalid-flow' && finding.message.includes('initial state'),
      ),
    ).toBe(true);
    expect(
      state.findings.some(
        (finding) => finding.code === 'invalid-flow' && finding.message.includes('unknown state'),
      ),
    ).toBe(true);
    expect(
      right.findings.some(
        (finding) =>
          finding.code === 'broken-local-reference' && finding.message.includes('missing right'),
      ),
    ).toBe(true);
    expect(
      review.findings.some(
        (finding) => finding.code === 'invalid-flow' && finding.message.includes('human review'),
      ),
    ).toBe(true);
  });

  it('enforces POD role rights and privacy access boundaries', async () => {
    const base = await example();
    const pod = lint(
      base.replace(
        'rights: [ "right:evidence-oracle:evaluate-service-claim" ]',
        'rights: [ "right:missing" ]',
      ),
    );
    const privacy = lint(
      base.replace(
        'access_policy: "role_based"\n      sensitivity: "internal"',
        'access_policy: "public"\n      sensitivity: "internal"',
      ),
    );
    expect(
      pod.findings.some(
        (finding) =>
          finding.code === 'broken-local-reference' && finding.message.includes('POD role'),
      ),
    ).toBe(true);
    expect(privacy.findings.some((finding) => finding.code === 'privacy-public-sensitive')).toBe(
      true,
    );
  });

  it('enforces claim rights, resources, outcomes, flows, and transitions', async () => {
    const base = await example();
    const evaluator = lint(
      base.replace(
        'evaluator_right: "right:evidence-oracle:evaluate-service-claim"',
        'evaluator_right: "right:missing"',
      ),
    );
    const reviewer = lint(
      base.replace(
        'reviewer_right: "right:verifier:determine-service-claim"',
        'reviewer_right: "right:missing"',
      ),
    );
    const rubric = lint(
      base.replace('resource_id: "rubric-service-delivery-v1"', 'resource_id: "missing-rubric"'),
    );
    const evidence = lint(
      base.replace(
        'resource_id: "resource:field-photo-schema-v1"',
        'resource_id: "missing-evidence"',
      ),
    );
    const outcome = lint(
      base.replace('outcome: "approved", flow_id:', 'outcome: "undeclared", flow_id:'),
    );
    const flow = lint(base.replace('flow_id: "flow:service-delivery"', 'flow_id: "flow:missing"'));
    const transition = lint(
      base.replace('transition: "determined_to_actioned"', 'transition: "missing_transition"'),
    );
    expect(
      evaluator.findings.some((finding) => finding.message.includes('missing evaluator_right')),
    ).toBe(true);
    expect(reviewer.findings.some((finding) => finding.message.includes('reviewer right'))).toBe(
      true,
    );
    expect(
      rubric.findings.some((finding) => finding.message.includes('rubric does not resolve')),
    ).toBe(true);
    expect(evidence.findings.some((finding) => finding.message.includes('evidence resource'))).toBe(
      true,
    );
    expect(outcome.findings.some((finding) => finding.code === 'incomplete-claim-contract')).toBe(
      true,
    );
    expect(flow.findings.some((finding) => finding.message.includes('next-action flow'))).toBe(
      true,
    );
    expect(
      transition.findings.some((finding) => finding.message.includes('next-action transition')),
    ).toBe(true);
  });

  it('reports profile mismatches, unknown keys, and scalar private keys', async () => {
    const parsed = parseDomain(await example());
    expect(parsed.document).toBeDefined();
    const document = structuredClone(parsed.document!);
    document.frontmatter.unregistered = true;
    document.frontmatter.note = '-----BEGIN PRIVATE KEY-----';
    const findings = validateSemantics(document, 'runtime');
    expect(findings.some((finding) => finding.code === 'profile-mismatch')).toBe(true);
    expect(findings.some((finding) => finding.code === 'unknown-top-level-key')).toBe(true);
    expect(
      findings.some(
        (finding) => finding.code === 'secret-in-index' && finding.message.includes('Private key'),
      ),
    ).toBe(true);
  });

  it('infers standalone and absent metadata safely', () => {
    expect(inferMode({ domain: { type: 'custom' } })).toBe('standalone');
    expect(inferMode({})).toBeNull();
    expect(getProfile({})).toBeNull();
  });

  it('returns a structured report when parsing fails', () => {
    const report = lint('# missing frontmatter', { sourceName: 'broken.md' });
    expect(report.sourceName).toBe('broken.md');
    expect(report.document).toBeUndefined();
    expect(report.mode).toBeNull();
    expect(report.profile).toBeNull();
  });

  it('lists the persisted-draft external verification boundary', async () => {
    const report = lint(
      (await example()).replace('profile: "authoring_draft"', 'profile: "persisted_draft"'),
    );
    expect(report.externalChecksRequired.map((check) => check.code)).toEqual(['cid-verification']);
  });
});
