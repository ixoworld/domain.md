import { describe, expect, it } from 'vitest';

import { lint } from '../src/lint.js';
import { parseDomain } from '../src/parser.js';
import { getProfile, inferMode, validateSemantics } from '../src/semantic.js';
import { example } from './helpers.js';

describe('lint', () => {
  it.each([
    ['passive-dataset', 'standalone'],
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

  it('enforces constitutional subject, applicability, instruments, and legal authority', async () => {
    const base = await example();
    const subject = lint(
      base.replace(
        'subject: "urn:uuid:123e4567-e89b-42d3-a456-426614174000"',
        'subject: "urn:uuid:523e4567-e89b-42d3-a456-426614174000"',
      ),
    );
    const notApplicable = lint(
      base.replace('constitution:\n  status: "draft"', 'constitution:\n  status: "not_applicable"'),
    );
    const instrument = lint(
      base.replace('document_ref: "domain-charter"', 'document_ref: "missing"'),
    );
    const legalEffect = lint(
      base.replace(
        'legal_effect: { status: "unknown", jurisdiction: null, authority_evidence: [] }',
        'legal_effect: { status: "verified", jurisdiction: null, authority_evidence: [] }',
      ),
    );
    const duplicateDocument = lint(
      base.replace('id: "changelog", role: "changelog"', 'id: "description", role: "changelog"'),
    );
    expect(subject.findings.some((finding) => finding.code === 'constitution-required')).toBe(true);
    expect(
      notApplicable.findings.some(
        (finding) => finding.code === 'constitution-not-applicable-invalid',
      ),
    ).toBe(true);
    expect(
      instrument.findings.some(
        (finding) => finding.code === 'constitutional-instrument-unresolved',
      ),
    ).toBe(true);
    expect(
      legalEffect.findings.some(
        (finding) => finding.code === 'constitutional-authority-unverified',
      ),
    ).toBe(true);
    expect(
      duplicateDocument.findings.some((finding) => finding.code === 'duplicate-entry-id'),
    ).toBe(true);
  });

  it('rejects missing and structurally incomplete constitutional packages', async () => {
    const parsed = parseDomain(await example());
    expect(parsed.document).toBeDefined();
    const missing = structuredClone(parsed.document!);
    delete missing.frontmatter.constitution;
    const incomplete = structuredClone(parsed.document!);
    const constitution = incomplete.frontmatter.constitution as Record<string, unknown>;
    delete constitution.legal_effect;
    delete constitution.governance;
    expect(
      validateSemantics(missing).some((finding) => finding.code === 'constitution-required'),
    ).toBe(true);
    expect(
      validateSemantics(incomplete).some((finding) => finding.code === 'constitution-required'),
    ).toBe(true);
  });

  it('rejects invalid effective periods and unresolved constitutional authority', async () => {
    const base = await example();
    const effectivePeriod = lint(
      base.replace(
        'effective_from: null, effective_until: null',
        'effective_from: "2026-12-31T00:00:00Z", effective_until: "2026-01-01T00:00:00Z"',
      ),
    );
    const legalAuthority = lint(
      base.replace(
        'legal_effect: { status: "unknown", jurisdiction: null, authority_evidence: [] }',
        'legal_effect: { status: "verified", jurisdiction: "https://example.org/jurisdiction", authority_evidence: [ "missing-authority" ] }',
      ),
    );
    const governance = lint(
      base
        .replace('authority_sources: [ "domain-charter" ]', 'authority_sources: [ "missing" ]')
        .replace(
          'decision_procedure: "resource:project-decision-procedure-v1"',
          'decision_procedure: "missing-decision-procedure"',
        ),
    );
    expect(
      effectivePeriod.findings.some(
        (finding) => finding.code === 'constitution-conflicts-canonical',
      ),
    ).toBe(true);
    expect(
      legalAuthority.findings.some(
        (finding) => finding.code === 'constitutional-authority-unverified',
      ),
    ).toBe(true);
    expect(
      governance.findings.filter(
        (finding) => finding.code === 'constitutional-authority-unverified',
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('enforces executable governance, constitutional AI, supersession, and amendments', async () => {
    const base = await example();
    const executable = lint(
      base
        .replace('mode: "machine_assisted"', 'mode: "hybrid"')
        .replace(
          'conformance_tests: [ "resource:project-constitutional-tests-v1" ]',
          'conformance_tests: []',
        ),
    );
    const constitutionalAI = lint(
      base.replace(
        'critique_procedure: "resource:constitutional-critique-v1"',
        'critique_procedure: null',
      ),
    );
    const selfAuthorization = lint(
      base.replace(
        'conflict_policy: "canonical_authority_prevails"',
        'conflict_policy: "model_authorizes"',
      ),
    );
    const superseded = lint(
      base.replace('constitution:\n  status: "draft"', 'constitution:\n  status: "superseded"'),
    );
    const amendment = lint(
      base
        .replace(
          'functions: [ "constitutive", "governing" ]',
          'functions: [ "constitutive", "governing", "amending" ]',
        )
        .replace(
          'amendment_procedure: "resource:project-amendment-procedure-v1"',
          'amendment_procedure: null',
        ),
    );
    expect(
      executable.findings.some((finding) => finding.code === 'constitutional-execution-incomplete'),
    ).toBe(true);
    expect(
      constitutionalAI.findings.some((finding) => finding.code === 'constitutional-ai-incomplete'),
    ).toBe(true);
    expect(
      selfAuthorization.findings.some(
        (finding) => finding.code === 'schema' || finding.code === 'constitutional-ai-incomplete',
      ),
    ).toBe(true);
    expect(
      superseded.findings.some((finding) => finding.code === 'constitution-conflicts-canonical'),
    ).toBe(true);
    expect(
      amendment.findings.some((finding) => finding.code === 'constitutional-amendment-unapproved'),
    ).toBe(true);
  });

  it('rejects unresolved executable and Constitutional-AI dependencies', async () => {
    const base = await example();
    const execution = lint(
      base
        .replace('mode: "machine_assisted"', 'mode: "hybrid"')
        .replace(
          'implementations: [ "resource:project-constitutional-policy-v1" ]',
          'implementations: [ "missing-implementation" ]',
        )
        .replace(
          'conformance_tests: [ "resource:project-constitutional-tests-v1" ]',
          'conformance_tests: [ "missing-test" ]',
        )
        .replace('enforcement_points: [ "#matrix" ]', 'enforcement_points: [ "missing-service" ]'),
    );
    const noAI = lint(base.replace('mode: "critique_and_revise"', 'mode: "none"'));
    const aiDependencies = lint(
      base
        .replace(
          'applies_to_agents: [ "did:ixo:agent:evidence-review-oracle" ]',
          'applies_to_agents: [ "did:ixo:agent:missing" ]',
        )
        .replace(
          'principles: [ "resource:constitutional-principles-v1" ]',
          'principles: [ "missing-principles" ]',
        ),
    );
    expect(
      execution.findings.filter((finding) => finding.code === 'constitutional-execution-incomplete')
        .length,
    ).toBeGreaterThanOrEqual(3);
    expect(noAI.findings.some((finding) => finding.code === 'constitutional-ai-incomplete')).toBe(
      true,
    );
    expect(
      aiDependencies.findings.filter((finding) => finding.code === 'constitutional-ai-incomplete')
        .length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('rejects a constitutional package attached to a passive exemption', async () => {
    const passive = await example('passive-dataset');
    const changed = passive.replace(
      '  type: "con:Constitution"\nagent_default_mode:',
      [
        '  type: "con:Constitution"',
        '  execution:',
        '    mode: "machine_executable"',
        '    implementations: [ "resource:runtime" ]',
        '    conformance_tests: [ "resource:tests" ]',
        '    enforcement_points: [ "service:gate" ]',
        '    failure_policy: "deny"',
        '    human_review_required_for: []',
        'agent_default_mode:',
      ].join('\n'),
    );
    expect(
      lint(changed).findings.some(
        (finding) => finding.code === 'constitution-not-applicable-invalid',
      ),
    ).toBe(true);
  });

  it.each([
    ['company', 'con:CorporateConstitution', 'con:ArticlesOfAssociation'],
    ['trust', 'con:TrustConstitution', 'con:TrustDeed'],
    ['cooperative', 'con:CooperativeConstitution', 'con:CooperativeStatutes'],
    ['DAO', 'con:DAOConstitution', 'con:DAOCharter'],
    ['agentic twin', 'con:AgenticConstitution', 'con:AgenticConstitutionDocument'],
  ])('accepts the %s constitutional catalogue mapping', async (_name, type, instrument) => {
    const changed = (await example('service-domain'))
      .replace('type: "con:AgenticConstitution"', `type: "${type}"`)
      .replace('type: "con:AgenticConstitutionDocument"', `type: "${instrument}"`);
    const report = lint(changed);
    expect(report.ok, JSON.stringify(report.findings)).toBe(true);
  });

  it('does not automatically classify a deed subject as a constitution', async () => {
    const changed = (await example('passive-dataset'))
      .replace('  type: "dataset"', '  type: "deed"')
      .replace('agent_default_mode:', 'deed: {}\nagent_default_mode:');
    const report = lint(changed);
    expect(report.ok, JSON.stringify(report.findings)).toBe(true);
    expect(report.document?.frontmatter.constitution).toHaveProperty('status', 'not_applicable');
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
