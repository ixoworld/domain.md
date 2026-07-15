---
version: "1.0.0-rc.1"
kind: "domain.md"
conformance:
  spec_version: "1.0.0-rc.1"
  schema: "urn:ixo:domain-md:schema:1.0.0-rc.1"
  profile: "authoring_draft"
document_revision: "0.1.0"
name: "Verified Services Protocol"
description: "Operating index for agents coordinating verified field-service delivery, evidence review, and settlement."
last_updated: "2026-06-27"
domain:
  id: "urn:uuid:323e4567-e89b-42d3-a456-426614174000"
  iid: null
  type: "protocol"
  class: null
  network: { chain_id: "ixo-5", environment: "mainnet", resolver: "ixo-did-resolver", blocksync_endpoint: "https://example-blocksync", rpc_endpoint: null }
  status: "draft"
  purpose: "Coordinate buyers, providers, verifiers, agents, claims, evidence, and settlement for verified services."
  operating_boundary: "Service requests, evidence submission, claim review, outcome determination, and settlement."
source_of_truth:
  protocol_state: "ixo-protocol"
  iid_document: null
  graph_query_layer: "ixo-blocksync"
  private_collaboration: "ixo-matrix"
  claims_registry: "claim-collection:field-services"
  evidence_store: "resource:evidence-store"
  conflict_resolution_order: [ "protocol_state", "iid_document", "udid", "credential", "claim", "claim_collection_state", "blocksync", "matrix_state", "domain_md", "user_prompt", "agent_memory" ]
  authority_scopes:
    - { fact: "controller", sources: [ "protocol_state", "iid_document" ] }
    - { fact: "right", sources: [ "protocol_state", "iid_document" ] }
    - { fact: "claim_status", sources: [ "protocol_state", "udid", "claim", "claim_collection_state", "blocksync" ] }
    - { fact: "domain_intent", sources: [ "domain_md" ] }
documents:
  anchoring: { method: "none", reference: null, cid: null, verified_at: null }
  not_applicable: []
  entries:
    - { role: "description", category: "universal", manifest_type: null, name: "Verified Field Services — Description", uri: null, cid: null, media_type: "text/markdown", version: "1.2.0", owner: "did:ixo:dao:marketplace-operators", update_authority: [ "did:ixo:dao:marketplace-operators" ], authority: "interpretive", disclosure_pass: 2, required_for_tasks: [ "onboarding", "read_domain_state" ], sensitivity: "public", access_policy: "public", agent_use: { read: true, cite: true, summarize: true }, freshness: { last_verified: null, max_age: "P180D" }, supersedes: null }
    - { role: "changelog", category: "universal", manifest_type: null, name: "Verified Field Services — Changelog", uri: null, cid: null, media_type: "text/markdown", version: null, owner: "did:ixo:dao:marketplace-operators", update_authority: [ "did:ixo:dao:marketplace-operators" ], authority: "advisory", disclosure_pass: 2, required_for_tasks: [ "submit_or_evaluate_claim", "move_funds_or_settle" ], sensitivity: "internal", access_policy: "role_based", agent_use: { read: true, cite: true, summarize: true }, freshness: { last_verified: null, max_age: "P30D" }, supersedes: null }
    - { role: "manifest", category: "manifest", manifest_type: "charter", name: "Marketplace Operators — Charter", uri: null, cid: null, media_type: "text/markdown", version: "2.0.0", owner: "did:ixo:dao:marketplace-operators", update_authority: [ "did:ixo:dao:marketplace-operators" ], authority: "defining", disclosure_pass: 3, required_for_tasks: [ "participate_in_governance", "diligence", "dispute" ], sensitivity: "public", access_policy: "public", agent_use: { read: true, cite: true, summarize: true }, freshness: { last_verified: null, max_age: "P365D" }, supersedes: null }
agent_default_mode:
  mode: "propose_only"
  overrides: { move_value: false, issue_credentials: false, change_rights: false, change_rubrics: false }
  human_review_required_for: [ "high_value_action", "ambiguous_evidence", "payment_release", "credential_issuance", "rights_change" ]
controllers:
  summary: { primary_controller: "did:ixo:dao:marketplace-operators", governance_model: "dao", agent_controllers_allowed: false }
  entries:
    - id: "did:ixo:dao:marketplace-operators"
      type: "dao"
      name: "Marketplace Operators DAO"
      role: "Primary project controller"
      verification_methods: []
      addresses: []
      authorities: [ "update_iid", "manage_services", "grant_rights", "revoke_rights", "manage_accounts" ]
      approval_policy: { threshold: "2/3", quorum: "50%", timelock: "24h", escalation: "governance-room" }
      limitations: [ "Cannot bypass claim-evaluation requirements for settlement." ]
      audit_requirements: { log_to: "protocol", signature_required: true }
services:
  entries:
    - id: "#matrix"
      type: "matrix"
      name: "Project coordination room"
      endpoint: "matrix:!field-services:ixo.world"
      service_did: null
      auth: { method: "matrix_access_token", required_scopes: [ "room.read" ] }
      allowed_agent_uses: [ "read", "notify" ]
      forbidden_agent_uses: [ "invite_without_controller_approval" ]
      data_classification: "confidential"
      canonical: false
      fallback_service: null
resources:
  entries:
    - id: "rubric-service-delivery-v1"
      type: "rubric"
      name: "Service Delivery Evidence Rubric v1"
      uri: "resource:rubric-service-delivery-v1"
      cid: null
      hash: null
      version: "1.0.0"
      owner: "did:ixo:dao:marketplace-operators"
      update_authority: [ "did:ixo:dao:marketplace-operators" ]
      access_policy: "role_based"
      sensitivity: "internal"
      agent_use: { read: true, cite: true, summarize: true, transform: false, write: false }
      freshness: { last_verified: null, max_age: "P90D" }
      canonical_for: [ "rubric" ]
rights:
  agent_baseline:
    require_explicit_grant_for: [ "write", "evaluate", "execute", "pay", "issue", "govern" ]
  entries:
    - id: "right:evidence-oracle:evaluate-service-claim"
      type: "evaluate_claim"
      effect: "allow"
      subject: "did:ixo:agent:evidence-review-oracle"
      object: "claim-collection:field-services"
      action: "create_evaluation_claim"
      capability: { format: "ucan", reference: "ucan://example" }
      conditions: { flow_state: "evaluating", claim_type: "service_delivery", max_value: null, not_before: "2026-06-27T00:00:00Z", expiry: "2026-12-31T23:59:59Z", role_required: "evidence_reviewer", credential_required: "vc:evidence-reviewer", human_review: true }
      revocation: { method: "ucan-revoke", authority: [ "did:ixo:dao:marketplace-operators" ] }
      audit: { record_as: "evaluation_claim", signature_required: true }
    - id: "right:verifier:determine-service-claim"
      type: "verify_claim"
      effect: "allow"
      subject: "did:ixo:dao:marketplace-operators"
      object: "claim-collection:field-services"
      action: "record_determination"
      capability: { format: "policy", reference: "resource:service-delivery-governance-v1" }
      conditions: { flow_state: "review_required", claim_type: "service_delivery", max_value: null, not_before: null, expiry: null, role_required: "verifier", credential_required: null, human_review: true }
      revocation: { method: "controller-policy", authority: [ "did:ixo:dao:marketplace-operators" ] }
      audit: { record_as: "udid", signature_required: true }
claims:
  collections:
    - id: "claim-collection:field-services"
      name: "Field Service Delivery Claims"
      purpose: "Evaluate whether field service orders were completed with sufficient evidence."
      owner: "did:ixo:dao:marketplace-operators"
      claim_types:
        - id: "service_delivery"
          schema: "resource:service-delivery-claim-schema-v1"
          schema_version: "1.0.0"
          fact_schema: "resource:service-delivery-fact-schema-v1"
          evidence_requirements:
            - { resource_id: "resource:field-photo-schema-v1", required: true, max_age: "P30D", sensitivity: "restricted" }
            - { resource_id: "resource:gps-attestation-schema-v1", required: true, max_age: "P30D", sensitivity: "restricted" }
          evaluation_kit: "resource:evaluation-kit-service-delivery-v1"
          rubric: { resource_id: "rubric-service-delivery-v1", version: "1.0.0", order: [ "identity", "location", "completion", "quality" ], disqualifiers: [ "identity_mismatch", "tampered_evidence" ], reason_codes: [ "complete", "insufficient_evidence", "manual_review" ] }
          evaluator_right: "right:evidence-oracle:evaluate-service-claim"
          determiner_right: "right:verifier:determine-service-claim"
          udid: { required: true, schema: "resource:service-delivery-udid-v1", record_authority: "right:verifier:determine-service-claim" }
          allowed_outcomes: [ "approved", "rejected", "manual_review_required", "disputed" ]
          human_review_policy: { required_for: [ "rejected", "disputed", "manual_review_required", "payment" ], reviewer_right: "right:verifier:determine-service-claim", approval_proof: "udid" }
          next_actions:
            - { outcome: "approved", flow_id: "flow:service-delivery", transition: "determined_to_actioned", settlement_policy: "resource:field-service-settlement-v1" }
            - { outcome: "rejected", flow_id: "flow:service-delivery", transition: "determined_to_closed", settlement_policy: null }
protocols:
  - { id: "did:ixo:entity:protocol:verified-services", version: "1.0.0", constraints: [ "settlement_requires_approved_udid" ] }
pods:
  entries:
    - id: "pod:field-services"
      name: "Field Services POD"
      purpose: "Coordinate evidence review and settlement."
      matrix_room: null
      members: [ "did:ixo:dao:marketplace-operators", "did:ixo:agent:evidence-review-oracle" ]
      roles:
        - { id: "evidence_reviewer", responsibilities: [ "review evidence" ], rights: [ "right:evidence-oracle:evaluate-service-claim" ] }
      blueprints: []
      flows:
        - id: "flow:service-delivery"
          name: "Service delivery evaluation"
          trigger: { type: "claim", reference: "claim-collection:field-services" }
          initial_state: "submitted"
          states: [ "submitted", "evaluating", "review_required", "determined", "actioned", "closed" ]
          human_review_states: [ "review_required", "determined" ]
          allowed_agent_actions: [ "read_claim", "read_evidence", "read_rubric", "create_evaluation_claim", "propose_transition" ]
          disabled_agent_actions: [ "execute_transition" ]
          transitions:
            - { id: "submitted_to_evaluating", from: "submitted", to: "evaluating", actor_rights: [ "right:evidence-oracle:evaluate-service-claim" ], required_evidence: [ "resource:field-photo-schema-v1", "resource:gps-attestation-schema-v1" ], checks: [ "authority_verified", "evidence_present" ], human_review: false, effects: [ "none" ] }
            - { id: "evaluating_to_review_required", from: "evaluating", to: "review_required", actor_rights: [ "right:evidence-oracle:evaluate-service-claim" ], required_evidence: [ "resource:service-delivery-fact-schema-v1" ], checks: [ "evaluation_claim_recorded" ], human_review: false, effects: [ "message" ] }
            - { id: "review_required_to_determined", from: "review_required", to: "determined", actor_rights: [ "right:verifier:determine-service-claim" ], required_evidence: [ "resource:service-delivery-udid-v1" ], checks: [ "human_review_proof", "signed_udid" ], human_review: true, effects: [ "none" ] }
            - { id: "determined_to_actioned", from: "determined", to: "actioned", actor_rights: [ "right:verifier:determine-service-claim" ], required_evidence: [ "resource:service-delivery-udid-v1" ], checks: [ "approved_udid", "treasury_authorization" ], human_review: true, effects: [ "payment" ] }
            - { id: "determined_to_closed", from: "determined", to: "closed", actor_rights: [ "right:verifier:determine-service-claim" ], required_evidence: [ "resource:service-delivery-udid-v1" ], checks: [ "rejected_udid" ], human_review: true, effects: [ "none" ] }
      value_mechanisms: [ "payment", "settlement" ]
accounts:
  entries:
    - name: "payouts"
      address: "ixo1..."
      chain_id: "ixo-5"
      owner: "did:ixo:dao:marketplace-operators"
      purpose: "Provider settlement after verified service delivery."
      asset_types: [ "IXO", "stablecoin" ]
      controllers: [ "did:ixo:dao:marketplace-operators" ]
      authz_grants: []
      spending_policy: { max_single_transaction: { amount: "1000", denom: "uixo" }, daily_limit: { amount: "5000", denom: "uixo" }, allowed_recipients: [], requires_claim: true, requires_udid: true, requires_human_approval: true }
      settlement_triggers:
        - { claim_type: "service_delivery", outcome_required: "approved", flow_state_required: "determined", action: "pay" }
      audit: { record_as: "protocol_tx" }
privacy:
  default_policy: "private_by_default"
  protocol_layer:
    may_publish: [ "DID", "controller", "service_reference", "resource_reference", "claim_reference", "proof" ]
    must_not_publish: [ "private_evidence_payload", "personal_data", "unredacted_trace" ]
  unauthorized_read_behavior: "deny"
validation:
  lint_profile: "strict"
  max_document_bytes: 1048576
  max_linked_document_bytes: 2097152
  required_sections: [ "Overview", "Authority & Control", "Rights & Capabilities", "Privacy & Source-of-Truth Boundaries", "Do's and Don'ts" ]
  required_frontmatter: [ "version", "kind", "conformance", "document_revision", "domain.id", "source_of_truth", "controllers.summary", "rights.agent_baseline", "privacy.default_policy", "agent_default_mode.mode" ]
  stale_after: "P30D"
  review_required_for_changes_to: [ "controllers", "rights", "accounts", "privacy", "source_of_truth", "claims.collections.evaluation_kit", "claims.collections.rubric", "agents", "agent_default_mode" ]
protocol: {}
critical_do_not:
  - "Do not release payment without an approved UDID and account authorization."
  - "Do not expose private evidence in public protocol metadata."
  - "Do not let an agent execute a Flow transition unless explicitly delegated."
---
# domain.md
## Overview
Coordinates verified field-service delivery between buyers, providers, verifiers, funders, and evidence-review agents. Full description: `documents[role=description]`; founding mandate and principles: `documents[role=manifest]` (charter).
## Authority & Control
The Marketplace Operators DAO controls domain settings, service configuration, account policy, and rights delegation. Mandate and non-negotiable commitments: `documents[role=manifest]` (charter).
## Rights & Capabilities
Agents are default-denied. The Evidence Review Oracle may create an Evaluation Claim only under its scoped, unexpired right; a verifier with the determination right records the reviewed UDID.
## Claims, Evidence & Evaluation
The Evidence Review Oracle inspects permitted evidence and creates an Evaluation Claim. It does not approve payment or close the Flow.
## Privacy & Source-of-Truth Boundaries
Private evidence remains in the authorized evidence service. Public protocol state carries only references and proofs; canonical conflict resolution is fact-scoped.
## Do's and Don'ts
Cite evidence. Record authority. Escalate ambiguity. Never treat chat, private reasoning, or unreviewed model output as canonical state.
## Changelog
Most recent significant change: service-delivery rubric updated to v1. Full semantic history with proof pointers (governing proposal, rubric CID): `documents[role=changelog]`.
