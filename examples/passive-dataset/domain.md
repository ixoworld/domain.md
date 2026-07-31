---
version: "1.0.0-rc.3"
kind: "domain.md"
conformance:
  spec_version: "1.0.0-rc.3"
  schema: "urn:ixo:domain-md:schema:1.0.0-rc.3"
  profile: "authoring_draft"
document_revision: "0.1.0"
name: "Public Biodiversity Dataset"
description: "A passive, read-only index of public biodiversity observations."
last_updated: "2026-07-31"
domain:
  id: "urn:uuid:423e4567-e89b-42d3-a456-426614174000"
  iid: null
  type: "dataset"
  class: null
  network: { chain_id: "ixo-5", environment: "mainnet", resolver: "ixo-did-resolver", blocksync_endpoint: null, rpc_endpoint: null }
  status: "draft"
  purpose: "Help readers discover public biodiversity observation records."
  operating_boundary: "Read-only discovery of public metadata; no agent, controller automation, executable governance, or state-changing action."
source_of_truth:
  protocol_state: "ixo-protocol"
  iid_document: null
  graph_query_layer: null
  private_collaboration: null
  claims_registry: null
  evidence_store: null
  conflict_resolution_order: [ "protocol_state", "domain_md" ]
  authority_scopes:
    - { fact: "domain_intent", sources: [ "domain_md" ] }
documents:
  anchoring: { method: "none", reference: null, cid: null, verified_at: null }
  not_applicable: [ "governance", "agents", "operations" ]
  entries:
    - { id: "description", role: "description", category: "universal", manifest_type: null, name: "Public Biodiversity Dataset — Description", uri: null, cid: null, media_type: "text/markdown", version: "1.0.0", owner: "did:ixo:entity:dataset-curator", update_authority: [ "did:ixo:entity:dataset-curator" ], authority: "interpretive", disclosure_pass: 1, required_for_tasks: [ "onboarding", "read_domain_state" ], sensitivity: "public", access_policy: "public", agent_use: { read: true, cite: true, summarize: true }, freshness: { last_verified: null, max_age: "P180D" }, supersedes: null }
    - { id: "changelog", role: "changelog", category: "universal", manifest_type: null, name: "Public Biodiversity Dataset — Changelog", uri: null, cid: null, media_type: "text/markdown", version: null, owner: "did:ixo:entity:dataset-curator", update_authority: [ "did:ixo:entity:dataset-curator" ], authority: "advisory", disclosure_pass: 1, required_for_tasks: [ "read_domain_state" ], sensitivity: "public", access_policy: "public", agent_use: { read: true, cite: true, summarize: true }, freshness: { last_verified: null, max_age: "P180D" }, supersedes: null }
constitution:
  status: "not_applicable"
  reason: "This domain is a passive, read-only dataset index with no agents, automated controllers, executable governance, or state-changing capabilities."
  subject: "urn:uuid:423e4567-e89b-42d3-a456-426614174000"
  type: "con:OperationalConstitution"
  subject_profile:
    subject_types: [ "con:KnowledgeAsset", "con:InformationObject" ]
    archetypes: [ "con:Verified" ]
    identity: [ "urn:uuid:423e4567-e89b-42d3-a456-426614174000" ]
    purposes: []
    interests: []
    values: []
    rights: []
    obligations: []
    capabilities: []
    claims: []
    wallets: []
    authorities: []
    memory: []
    evidence_policies: []
    evaluation_policies: []
    decision_policies: []
    settlement_policies: []
    governance: []
    custodians: []
    stewards: []
    owners: []
    beneficiaries: []
    oracles: []
    agentic_twins: []
agent_default_mode:
  mode: "read_only"
  overrides: { move_value: false, issue_credentials: false, change_rights: false, change_rubrics: false }
  human_review_required_for: [ "any_state_change" ]
controllers:
  summary: { primary_controller: "did:ixo:entity:dataset-curator", governance_model: "single_controller", agent_controllers_allowed: false }
  entries:
    - id: "did:ixo:entity:dataset-curator"
      type: "organisation"
      name: "Dataset Curator"
      role: "Maintains the descriptive index"
      verification_methods: []
      addresses: []
      authorities: [ "update_iid" ]
      approval_policy: { threshold: null, quorum: null, timelock: null, escalation: null }
      limitations: [ "No authority is delegated to agents." ]
      audit_requirements: { log_to: "protocol", signature_required: true }
rights:
  agent_baseline:
    require_explicit_grant_for: [ "write", "evaluate", "execute", "pay", "issue", "govern" ]
  entries: []
privacy:
  default_policy: "public_by_exception"
  protocol_layer:
    may_publish: [ "public_dataset_metadata", "public_resource_reference" ]
    must_not_publish: [ "personal_data", "private_observation_payload" ]
  unauthorized_read_behavior: "deny"
validation:
  lint_profile: "strict"
  max_document_bytes: 1048576
  max_linked_document_bytes: 2097152
  required_sections: [ "Overview", "Authority & Control", "Constitutional Governance", "Rights & Capabilities", "Privacy & Source-of-Truth Boundaries", "Do's and Don'ts" ]
  required_frontmatter: [ "version", "kind", "conformance", "document_revision", "domain.id", "source_of_truth", "constitution", "controllers.summary", "rights.agent_baseline", "privacy.default_policy", "agent_default_mode.mode" ]
  stale_after: "P180D"
  review_required_for_changes_to: [ "constitution", "controllers", "rights", "privacy", "source_of_truth", "agent_default_mode" ]
critical_do_not:
  - "Do not infer that read-only metadata grants authority to change source records."
  - "Do not add agent or executable-governance behavior without replacing the not_applicable declaration with a complete constitutional package."
---
# domain.md
## Overview
This domain indexes public biodiversity observation metadata for read-only discovery.
## Authority & Control
The Dataset Curator maintains the descriptive index. Live protocol and IID state prevail over this document.
## Constitutional Governance
A constitution is not applicable while the domain remains passive and read-only. Any future agentic or executable behavior requires a complete constitutional package before activation.
## Rights & Capabilities
No rights are granted to agents and no state-changing capability is exposed.
## Privacy & Source-of-Truth Boundaries
Only public metadata and resource references may be published. The source dataset remains authoritative for observation records.
## Do's and Don'ts
Read and cite public metadata. Never treat the index as authorization to alter source records.
## Changelog
Initial passive rc.3 example.
