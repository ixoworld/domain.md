<!-- Generated from spec/spec.mdx and spec/rules.ts | version: 1.0.0-rc.1 -->
<!-- Do not edit directly. Run npm run spec:generate. -->

# domain.md Specification

|  |  |
| :---- | :---- |
| **Specification version** | `1.0.0-rc.1` |
| **Status** | `release-candidate` — suitable for controlled production pilots; promote to `1.0.0` only after resolver, anchoring, and migration interoperability tests pass |
| **Consumers** | AI agents, Agentic Oracles, Qi workflows, SDK automation, governance assistants, domain operators |
| **Purpose** | The index operating document an AI agent loads before acting within an IXO entity domain |
| **Normative artifacts** | This document plus `domain-md.schema.json`; neither artifact may be used without the matching version |
| **Encoding** | UTF-8, no byte-order mark; YAML 1.2 core schema; duplicate keys, aliases, custom tags, and merge keys are errors |

`domain.md` is the IXO-domain analogue of `claude.md` / `skill.md` / `design.md`: a persistent, machine-first context file that tells an agent **what domain it is in, where authority lives, what state is canonical, what it may inspect, what it may propose, and what it must never do without explicit authority.**

It indexes and constrains IXO state; it does **not** replace it. The IID/DID document and IXO Protocol remain canonical. `domain.md` adds the operating context — controllers, services, resources, rights, claims, linked entities, accounts, flows, agent authority — that raw identifiers do not carry.

The keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are used as described by RFC 2119 and RFC 8174 when they appear in capitals. The JSON Schema is normative for frontmatter shape and primitive constraints; this document is normative for semantic, authorization, lifecycle, and runtime behavior. If the two artifacts disagree, validation **MUST** fail with `spec-artifact-conflict`; an implementation **MUST NOT** choose whichever interpretation is more permissive. On a conflict between a conforming `domain.md` and live canonical domain state, agents apply §6.

---

## 0\. Conformance profiles and lifecycle

Every `domain.md` declares `conformance.spec_version`, `conformance.schema`, and one profile. Validators **MUST** validate the declared profile and **MUST NOT** silently downgrade it.

| Profile | Purpose | Required state |
| :---- | :---- | :---- |
| `authoring_draft` | Local, non-operational composition before persistence | `domain.id` MAY be a `urn:uuid`; `domain.iid` and document CIDs MAY be `null`; the document grants no runtime authority |
| `persisted_draft` | Content-addressed draft stored outside canonical IID state | every linked document has a verified CID; the index MAY remain unanchored and MAY still use a `urn:uuid` |
| `anchored` | Index identity is bound to the canonical IID | `domain.id` and `domain.iid` are DIDs; anchoring evidence identifies the exact `domain.md` CID; every linked-document CID verifies |
| `runtime` | Safe to load for live agent decisions | satisfies `anchored`; canonical sources resolve without conflict; required capabilities, freshness, and review policies pass runtime checks |

Profile names describe artifact assurance, not entity lifecycle. `domain.status` separately describes whether the entity is draft, active, paused, deprecated, or archived.

Template placeholders such as `{{name}}` and `<<FILL_AT_PUBLISH:...>>` are never valid in a conforming `domain.md`. Templates are pre-conformance inputs. An `authoring_draft` represents unknown identity with a generated `urn:uuid` and unknown CIDs with YAML `null`, then records the unresolved items outside normative frontmatter in its authoring report.

Conformance has two layers:

1. **Static conformance** — safe YAML parsing, JSON Schema validation, reference resolution, lint rules, and profile-specific invariants.
2. **Runtime conformance** — immutable-content verification, canonical IID/protocol resolution, capability and revocation checks, freshness checks, and policy evaluation against the current task.

Passing static conformance never proves runtime authorization.

---

## 1\. Principles

1. **Legible before active.** An agent loads the operating brief before it calls a tool, queries a service, submits a claim, mutates state, or votes.
2. **Preserve source-of-truth boundaries.** Protocol state, IID records, Blocksync graph reads, Matrix rooms, claims, evidence, rubrics, and UDIDs are distinct authorities and **MUST NOT** collapse into one opaque context. Protocol owns transaction/state truth; Blocksync is a read projection of it.
3. **Operationalise IID properties.** Each of `controllers`, `services`, `resources`, `rights`, `claims`, `linked_entities`, `accounts` carries the extra context needed to act, not just IDs (§4–§5).
4. **Progressive disclosure.** Load frontmatter \+ brief first; open deeper sections only when the task requires them (§3).
5. **Bounded agency by default.** Read and propose before execute. Human, governance, or protocol review is mandatory for high-value, irreversible, ambiguous, disputed, or authority-sensitive actions.

---

## 2\. Document structure

Two layers: normative YAML frontmatter, then human-readable Markdown.

```
---
# YAML frontmatter — normative, machine-readable operating index
---
# domain.md
## Overview
## Operating Model
## Authority & Control
## Services
## Resources
## Rights & Capabilities
## Claims, Evidence & Evaluation
## Linked Entities
## Accounts & Value
## POD, Flows & Agents
## Privacy & Source-of-Truth Boundaries
## Playbooks
## Do's and Don'ts
## Changelog
```

Sections use `##` headings. Any section **MAY** be omitted when irrelevant; present sections **SHOULD** appear in the order above. A duplicated canonical section is an **error**; an unknown section is **preserved with a warning**.

Processors **MUST** parse frontmatter with YAML 1.2 core semantics, reject duplicate mapping keys, aliases, anchors, merge keys, custom tags, non-UTF-8 input, and documents larger than the implementation's declared limit. The baseline interoperability limits are 1 MiB for `domain.md`, 2 MiB per linked text document, 64 mapping levels, 10,000 aggregate YAML nodes, and 10,000 scalar characters per field. Implementations MAY enforce lower limits when declared before parsing.

Where a `documents` entry backs a section (§4.4), the section is a **summary stub**: it carries enough for its disclosure pass and links to the backing document for Pass-3 depth — the index holds the summary, the linked file holds the full content. Default section ↔ role links: Overview → `description` (and the manifest for depth); Authority & Control → `governance`; Playbooks → `operations`; POD, Flows & Agents → `agents`; Privacy & Source-of-Truth Boundaries → `data-policy`; Changelog → `changelog`.

---

## 3\. Progressive disclosure

Three passes. Each pass references **only keys that exist in the schema (§4).**

### Pass 1 — Always load

```
version • kind • conformance • document_revision • domain.id • domain.type
source_of_truth                       (esp. iid_document, conflict_resolution_order)
documents                             (index + cids only; content loads per each entry's disclosure_pass)
agent_default_mode                    (mode, human_review_required_for)
controllers.summary
rights.agent_baseline
privacy.default_policy
critical_do_not
```

Purpose: never act before authority and source-of-truth boundaries are known. **Missing authority is denial, not ambiguity.**

### Pass 2 — Load by task intent

| Task intent | Required frontmatter | Required sections |
| :---- | :---- | :---- |
| Read domain state | `source_of_truth`, `services`, `resources`, `linked_entities` | Overview; Privacy & Source-of-Truth Boundaries |
| Submit / evaluate a claim | `claims`, `resources`, `rights`, `agents`, `pods.flows` | Claims, Evidence & Evaluation; POD, Flows & Agents |
| Update IID / domain settings | `controllers`, `rights`, `services`, `resources` | Authority & Control; Services; Resources |
| Use Matrix / private rooms | `services` (type `matrix`), `pods.matrix_room`, `privacy`, `agents` | POD, Flows & Agents; Privacy & Source-of-Truth Boundaries |
| Move funds / settle | `accounts`, `rights`, `claims`, `pods.flows`, `agent_default_mode.human_review_required_for` | Accounts & Value; Claims; Playbooks |
| Traverse related entities | `linked_entities`, `graph_policy`, `privacy` | Linked Entities; Privacy & Source-of-Truth Boundaries |
| Participate in governance | `controllers`, `governance`, `rights`, `claims` | Authority & Control; Playbooks |

### Pass 3 — Deep context, only when the task requires it

Schemas, rubrics, legal terms, protocol specs, evidence packages, account policies, DAO proposals, room state, linked-entity documents. An agent **MUST NOT** load private evidence, room history, account detail, or personal data unless the task requires it **and** a matching right, role, or delegation is present.

**Document disclosure.** Pass 1 loads the `documents` index (roles, cids, passes, sensitivity) — pointers, not content — so the agent knows what context exists and can verify it. A document's *content* loads when its `disclosure_pass` is reached **or** the current task intent appears in its `required_for_tasks`. Defaults: `description` and `changelog` at Pass 2; the manifest at Pass 3; operational docs at Pass 2\. Every fetched document is verified against its declared `cid` before use (§4.4); on mismatch, do not use it and flag.

---

## 4\. Frontmatter schema

### 4.1 Recognized top-level keys

**Core (always valid):** `version`, `kind`, `conformance`, `document_revision`, `name`, `description`, `last_updated`, `maintainers`, `domain`, `source_of_truth`, `documents`, `agent_default_mode`, `controllers`, `services`, `resources`, `rights`, `claims`, `linked_entities`, `accounts`, `pods`, `agents`, `privacy`, `graph_policy`, `validation`, `critical_do_not`.

**Conditional type blocks (valid only when `domain.type` matches, see §7):** `governance`, `protocols`, `asset`, `deed`, `protocol`, `investment`.

**Extensions:** any key prefixed `x-`.

An unknown, unprefixed top-level key produces a **warning**.

### 4.2 Reference convention

- A **bare id** (e.g. `rubric-service-delivery-v1`) refers to an entry in *this* file (a `resources.entries[].id`, `rights.entries[].id`, etc.) and **MUST** resolve locally — lint-checked.
- A **URI / CID / DID** or `resource:`\-prefixed string points outside the file and is **not** required to be defined locally.

### 4.3 Structural model

The block below is readable notation, not a substitute for `domain-md.schema.json`. A production validator **MUST** validate against the matching JSON Schema before applying the semantic lint rules in §13.

```
version: "1.0.0-rc.1"
kind: "domain.md"
conformance:
  spec_version: "1.0.0-rc.1"
  schema: "urn:ixo:domain-md:schema:1.0.0-rc.1"
  profile: "authoring_draft|persisted_draft|anchored|runtime"
document_revision: string                 # monotonic domain-controlled revision, e.g. semver or date-build id
name: string
description: string
last_updated: "YYYY-MM-DD"
maintainers:
  - { id: "did:ixo:...", name: string, role: string, contact: string | null }

domain:
  id: "did:ixo:entity:...|urn:uuid:..."  # urn:uuid only for authoring_draft or persisted_draft
  iid: "did:ixo:entity:..." | null        # required for anchored and runtime
  type: "dao|organisation|project|asset|deed|protocol|investment|oracle|service|dataset|device|place|portfolio|marketplace|pod|claim_collection|custom"
  class: "did:ixo:entity:..." | null
  class_binding:                            # required when class is non-null
    resource: string                       # immutable protocol class or template-manifest locator
    cid: string
    version: string
    merge_policy: "local_explicit_only"   # no implicit deep merge; omitted local keys do not inherit authority
  network:
    chain_id: string
    environment: "mainnet|testnet|devnet|local"
    resolver: string
    blocksync_endpoint: string | null
    rpc_endpoint: string | null
  status: "draft|active|paused|deprecated|archived"
  purpose: string
  operating_boundary: string

source_of_truth:
  protocol_state: "ixo-protocol"
  iid_document: "did:ixo:entity:..." | null   # null only before canonical registration
  graph_query_layer: "ixo-blocksync" | null
  private_collaboration: "ixo-matrix" | null
  claims_registry: string | null
  evidence_store: string | null
  code_repository: string | null
  ontology_contexts:
    - { uri: string, purpose: string }
  conflict_resolution_order:                # CANONICAL — see §6. Prose MUST NOT restate a different order.
    - "protocol_state"
    - "iid_document"
    - "udid"
    - "credential"
    - "claim"
    - "claim_collection_state"
    - "blocksync"                           # read projection; defer to protocol_state on any divergence
    - "matrix_state"
    - "domain_md"
    - "user_prompt"
    - "agent_memory"
  authority_scopes:                         # precedence applies only where a source is competent for the same fact
    - fact: "controller|right|account_balance|claim_status|credential_status|flow_state|domain_intent|custom"
      sources: [ string ]                   # ordered subset of conflict_resolution_order

documents:
  anchoring:
    method: "none|iid_linked_resource|content_address|resolver"
    reference: string | null                # canonical linked-resource/resolver reference
    cid: string | null                      # exact domain.md CID; null before anchoring
    verified_at: "YYYY-MM-DDTHH:mm:ssZ" | null
  not_applicable: [ "governance|data-policy|agents|operations" ]   # surfaces this domain lacks; suppresses operational-doc warnings
  entries:
    - role: "description|changelog|manifest|operations|governance|data-policy|agents|compliance|risk-register|custom"
      category: "universal|manifest|operational|advanced|extension"
      manifest_type: "charter|dossier|prospectus|terms|specification|datasheet|device-profile|custom" | null  # only when category: manifest
      name: string
      uri: string | null                # null only in authoring_draft
      cid: string | null                # null only in authoring_draft; REQUIRED from persisted_draft onward
      media_type: string
      version: string | null
      owner: "did:ixo:..."
      update_authority: [ "did:ixo:..." ]
      authority: "interpretive|defining|advisory"   # defining = manifest; advisory = changelog; else interpretive
      disclosure_pass: 1 | 2 | 3
      required_for_tasks: [ string ]    # task intents (§3 Pass 2) that pull this document early
      sensitivity: "public|internal|confidential|restricted|regulated"
      access_policy: "public|controller_only|role_based|capability_based|matrix_room|private|custom"
      agent_use: { read: boolean, cite: boolean, summarize: boolean }   # context only — never transform/write
      freshness: { last_verified: "YYYY-MM-DD" | null, max_age: string | null }
      supersedes: string | null         # prior manifest/doc cid, for amendments

agent_default_mode:
  mode: "read_only|propose_only|bounded_evaluate|bounded_execute"   # the capability CEILING (§8)
  overrides:                                # MAY only LOWER the ceiling; raising it requires a rights.entries grant
    move_value: false
    issue_credentials: false
    change_rights: false
    change_rubrics: false
  human_review_required_for:
    - "high_value_action"
    - "irreversible_state_change"
    - "ambiguous_evidence"
    - "disputed_claim"
    - "credential_issuance"
    - "payment_release"
    - "controller_change"
    - "rights_change"
    - "rubric_change"

controllers:
  summary:
    primary_controller: "did:ixo:..."
    governance_model: "single_controller|multisig|dao|group|hybrid|protocol_controlled"
    agent_controllers_allowed: boolean
  entries:
    - id: "did:ixo:..."
      type: "human|organisation|dao|group|multisig|agent|service|module_account|protocol"
      name: string
      role: string
      verification_methods:
        - { id: string, type: string,
            purpose: "authentication|assertionMethod|capabilityInvocation|capabilityDelegation|keyAgreement" }
      addresses:
        - { chain: string, address: string, purpose: string }
      authorities:                          # subset of: update_iid, manage_services, manage_resources,
        - string                            #   grant_rights, revoke_rights, submit_claim, evaluate_claim,
                                            #   verify_claim, issue_credential, manage_accounts,
                                            #   transfer_ownership, governance_vote
      approval_policy:
        { threshold: string | null, quorum: string | null, timelock: string | null, escalation: string | null }
      limitations: [ string ]
      audit_requirements:
        { log_to: "protocol|matrix|claim|udid|external", signature_required: boolean }

services:
  entries:
    - id: "#service-id"
      type: "registry|resolver|blocksync|matrix|qi|oracle|claim_api|evidence_store|credential_issuer|payment|escrow|dashboard|mcp|webhook|external_api|custom"
      name: string
      endpoint: string
      service_did: string | null
      auth:
        method: "none|did_auth|ucan|oauth|api_key|jwt|cosmos_signer|matrix_access_token|custom"
        required_scopes: [ string ]
      allowed_agent_uses: [ "read|query|submit|evaluate|notify|propose_transition" ]
      forbidden_agent_uses: [ string ]
      data_classification: "public|internal|confidential|restricted|regulated"
      canonical: boolean                    # true = source-of-truth service; false = convenience only
      fallback_service: string | null
      rate_limits: string | null
      verification: { expected_hash: string | null, health_check: string | null }

resources:
  entries:
    - id: string
      type: "schema|blueprint|flow|rubric|policy|legal|dataset|evidence|credential_template|model|notebook|dashboard|document|repo|matrix_room|ontology|asset_registry|investment_memo|deed_terms|custom"
      name: string
      uri: string
      cid: string | null
      hash: string | null
      version: string | null
      owner: "did:ixo:..."
      update_authority: [ "did:ixo:..." ]
      access_policy: "public|controller_only|role_based|capability_based|matrix_room|private|custom"
      sensitivity: "public|internal|confidential|restricted|regulated"
      agent_use: { read: boolean, cite: boolean, summarize: boolean, transform: boolean, write: boolean }
      freshness: { last_verified: "YYYY-MM-DD" | null, max_age: string | null }
      canonical_for: [ "claim_schema|evidence_rule|rubric|flow_state|account_policy|legal_terms|governance_policy" ]

rights:
  agent_baseline:
    require_explicit_grant_for:             # actions that ALWAYS need a matching rights.entries grant, regardless of mode
      - "write"
      - "evaluate"
      - "execute"
      - "pay"
      - "issue"
      - "mint"
      - "transfer"
      - "govern"
      - "delete"
      - "revoke"
  entries:
    - id: string
      type: "ownership|control|read|write|submit_claim|evaluate_claim|verify_claim|issue_credential|mint|burn|transfer|pay|escrow_release|vote|delegate|dispute|manage_agent|manage_account|update_iid|link_entity|custom"
      effect: "allow|deny"                  # deny overrides allow; absence of allow is denial
      subject: "did:ixo:..."
      object: "did:ixo:...|resource-id|claim-collection-id|account-name|flow-id"
      action: string
      capability:
        format: "ucan|cosmos_authz|did_auth|matrix_power_level|dao_proposal|policy|custom"
        reference: string | null
      conditions:
        flow_state: string | null
        claim_type: string | null
        max_value: { amount: string, denom: string } | null  # amount is an unsigned base-10 integer in base units
        not_before: "YYYY-MM-DDTHH:mm:ssZ" | null
        expiry: "YYYY-MM-DDTHH:mm:ssZ" | null
        role_required: string | null
        credential_required: string | null
        human_review: boolean
      revocation: { method: string, authority: [ "did:ixo:..." ] }
      audit: { record_as: "claim|evaluation_claim|udid|protocol_tx|matrix_event|external_log", signature_required: boolean }

claims:
  collections:
    - id: string
      name: string
      purpose: string
      owner: "did:ixo:..."
      claim_types:
        - id: string
          schema: string                    # bare id (local) or external ref — see §4.2
          schema_version: string
          fact_schema: string
          evidence_requirements:
            - { resource_id: string, required: boolean, max_age: string | null, sensitivity: "public|internal|confidential|restricted|regulated" }
          evaluation_kit: string | null
          rubric:
            resource_id: string
            version: string
            order: [ string ]
            disqualifiers: [ string ]
            reason_codes: [ string ]
          evaluator_right: string
          determiner_right: string
          udid: { required: boolean, schema: string, record_authority: string }
          allowed_outcomes: [ "approved|rejected|manual_review_required|partial_success|disputed" ]
          human_review_policy: { required_for: [ string ], reviewer_right: string, approval_proof: string }
          next_actions:
            - { outcome: string, flow_id: string, transition: string, settlement_policy: string | null }
  linked_claims:
    - id: string
      type: string
      subject: "did:ixo:..."
      issuer: "did:ixo:..."
      status: "submitted|evaluating|approved|rejected|disputed|closed|unknown"
      evidence: [ string ]
      udid: string | null
      agent_visibility: "visible|redacted|private|forbidden"

linked_entities:
  entries:
    - id: "did:ixo:entity:..."
      type: "<same enum as domain.type>"
      relationship: "owns|controls|implements|funds|verifies|issues|uses|contains|offers|requests|invests_in|governs|supplies|depends_on|replaces|derived_from|member_of|custom"
      direction: "outbound|inbound|bidirectional"
      role_in_domain: string
      authority_implication: "none|read_context|requires_right_check|inherits_policy|delegates_authority|custom"
      traversal_policy: { agent_may_resolve: boolean, max_depth: integer, require_privacy_check: boolean }
      canonical_reference: string | null

accounts:
  entries:
    - name: "treasury|operations|payouts|escrow|fees|rewards|investment|reserve|custom"
      address: string
      chain_id: string
      owner: "did:ixo:..."
      purpose: string
      asset_types: [ "IXO|stablecoin|impact_credit|outcome_unit|voucher|custom" ]
      controllers: [ "did:ixo:..." ]
      authz_grants:
        - { grantee: "did:ixo:...", msg_type_url: string, max_amount: { amount: string, denom: string } | null, expiry: "...Z" | null }
      spending_policy:
        max_single_transaction: { amount: string, denom: string } | null
        daily_limit: { amount: string, denom: string } | null
        allowed_recipients: [ string ]
        requires_claim: boolean
        requires_udid: boolean
        requires_human_approval: boolean
      settlement_triggers:
        - { claim_type: string, outcome_required: string, flow_state_required: string,
            action: "hold|release|pay|refund|mint|burn|transfer" }
      audit: { record_as: "protocol_tx|udid|claim|matrix_event|external_ledger" }

pods:
  entries:
    - id: string
      name: string
      purpose: string
      matrix_room: string | null
      members: [ "did:ixo:..." ]
      roles:
        - { id: string, responsibilities: [ string ], rights: [ string ] }   # rights = rights.entries ids
      blueprints: [ { resource_id: string } ]
      flows:
        - id: string
          name: string
          trigger: { type: "manual|claim|protocol_event|schedule|webhook|custom", reference: string | null }
          initial_state: string
          states: [ string ]
          human_review_states: [ string ]
          allowed_agent_actions: [ "read_claim|read_evidence|read_rubric|create_evaluation_claim|propose_transition" ]
          disabled_agent_actions: [ "execute_transition" ]
          transitions:
            - id: string
              from: string
              to: string
              actor_rights: [ string ]
              required_evidence: [ string ]
              checks: [ string ]
              human_review: boolean
              effects: [ "none|message|credential|payment|mint|burn|transfer|custom" ]
      value_mechanisms: [ "payment|reward|fee|credit|escrow|settlement" ]

agents:
  entries:
    - id: "did:ixo:agent-or-oracle"
      name: string
      type: "assistant|agentic_oracle|evaluation_oracle|workflow_bot|state_bot|monitor|custom"
      operator: "did:ixo:..."
      service: "#service-id"
      p_functions: [ "proofing|protocol_adherence|prediction|pattern_recognition|performance_monitoring|analysis|pathfinding|planning|risk_prevention|privacy_protection|governance_support|payment_recommendation|policy_enforcement|reporting" ]
      permitted_context: { domains: [...], claims: [...], resources: [...], rooms: [...] }
      permitted_outputs: [ "summary|risk_flag|evidence_gap|fact_ledger|evaluation_claim|recommendation|proposed_transition|human_review_request" ]
      forbidden_outputs: [ "unreviewed_final_approval|unbounded_payment|silent_rubric_change|private_reasoning_as_state" ]
      logging: { must_cite_evidence: boolean, must_record_authority: boolean, must_emit_trace: boolean, trace_visibility: "public_redacted|private_encrypted|both" }
      escalation: { human_role: string, matrix_room: string | null, timeout: string | null }

privacy:
  default_policy: "public_by_exception|private_by_default|mixed"
  protocol_layer:
    may_publish: [ "DID|controller|service_reference|resource_reference|claim_reference|proof|state_transition" ]
    must_not_publish: [ "private_evidence_payload|secret|personal_data|unredacted_trace" ]
  service_layer:
    encrypted_storage_required_for: [ "private_evidence|room_history|personal_data|commercial_terms|regulated_data" ]
  redaction: { public_trace_policy: string, citation_policy: string }
  unauthorized_read_behavior: "deny|redact|request_capability|escalate"

graph_policy:
  default_traversal: "same_domain_only|linked_entities_depth_1|explicit_allowlist|custom"
  max_depth: integer
  require_rights_check_for: [ "controller|account|private_resource|claim_evidence|investment_terms|beneficiary_data" ]

validation:
  lint_profile: "strict|standard|permissive"
  max_document_bytes: integer               # MUST be <= 1048576 for interoperable domain.md files
  max_linked_document_bytes: integer        # MUST be <= 2097152 for interoperable text documents
  required_sections: [ "Overview", "Authority & Control", "Rights & Capabilities", "Privacy & Source-of-Truth Boundaries", "Do's and Don'ts" ]
  required_frontmatter: [ "version", "kind", "conformance", "document_revision", "domain.id", "source_of_truth", "controllers.summary", "rights.agent_baseline", "privacy.default_policy", "agent_default_mode.mode" ]
  stale_after: "P30D"
  review_required_for_changes_to: [ "controllers", "rights", "accounts", "privacy", "source_of_truth", "claims.collections.evaluation_kit", "claims.collections.rubric", "agents", "agent_default_mode" ]   # see §14

critical_do_not:
  - "Do not treat chat history, a model response, or private reasoning as canonical domain state."
  - "Do not execute a state change without verified controller authority or an explicit, unexpired delegated right."
  - "Do not approve a high-value claim from an LLM response alone."
  - "Do not move value unless account policy, claim outcome, authority, and human-review requirements are all satisfied."
  - "Do not expose private evidence, personal data, or regulated data in public protocol fields."
```

### 4.4 Linked documents

`documents` carries operating **context** — interpretive, human-first files that describe and govern the domain. It is deliberately **not** `linkedResource`/`resources`: those are machine-consumed canonical artifacts (schemas, rubrics, evidence) registered on the IID, whereas `documents` are operating-layer files an agent reads to understand and run the domain. Three boundaries hold:

- `documents` ≠ `resources` — interpretive context vs. canonical machine artifacts.
- `changelog` ≠ the Blocksync transaction log — semantic significance pointing *up* to proofs, never an enumeration of chain events (Blocksync already holds the auditable transaction history).
- a manifest's defining facts ≠ live state — intent / terms / facts-of-record vs. current ownership, balance, controller, or claim status, which always resolve from canonical sources.

**Roles**

| Role | Category | Default pass | Expected when |
| :---- | :---- | :---: | :---- |
| `description` | universal | 2 | always — **error** if absent |
| `changelog` | universal | 2 | always — **error** if absent |
| manifest (typed below) | manifest | 3 | the domain type defines one — **warn** if absent |
| `operations` | operational | 2 | the domain has live flows |
| `governance` | operational | 2 | control is collective (dao/org/project/pod) |
| `data-policy` | operational | 2 | PII, regulated, or private evidence flows |
| `agents` | operational | 2 | ≥1 agent operates |
| `compliance` / `risk-register` | advanced | 3 | opt-in |
| `x-*` | extension | declared | opt-in |

Operational docs are **default** for any domain that has the corresponding surface; an absent operational doc warns unless the domain lists that surface in `documents.not_applicable`.

**Manifest — the polymorphic defining document.** Exactly one manifest per domain that has a defining form; its `manifest_type` follows `domain.type`:

| `domain.type` | `manifest_type` | Character |
| :---- | :---- | :---- |
| dao / organisation / project / pod | `charter` | normative — mandate, principles, non-negotiable commitments |
| asset | `dossier` | factual — specification, provenance, custody, condition-of-record |
| investment / portfolio | `prospectus` | offering — thesis, instruments, terms, risk disclosures |
| deed | `terms` | contractual — request/offer/agreement terms, acceptance criteria |
| protocol | `specification` | definitional — the protocol's defining narrative |
| dataset | `datasheet` | provenance — collection method, license, limitations |
| device | `device-profile` | technical — make/model, capabilities, calibration |

The manifest is the *full authoritative defining document* (Pass 3 — pulled for diligence, disputes, onboarding); `description` is the *short operating summary* (Pass 2 — read-me-first). Manifest amendments (a charter amendment, a prospectus supplement, an asset re-spec) are exactly what `changelog` records, linked via `supersedes`.

**Integrity — profile-aware anchored index and verified references.** `documents` files are not required to be individually registered on the IID. Instead an `anchored` or `runtime` `domain.md` identifies the canonical anchoring method, reference, exact CID, and verification time in `documents.anchoring`; the canonical IID state **MUST** resolve to the same CID. Every linked document carries the CID of its exact UTF-8 bytes and an explicit media type. Agents **MUST** fetch by an allowlisted scheme, enforce size and redirect limits, verify the returned bytes against the declared CID, and only then parse or disclose content. A mismatch, unsupported multicodec/hash, ambiguous gateway transform, or mutable response without immutable verification makes the document untrusted.

`domain.md` does not place its own CID in the bytes that are hashed. The `documents.anchoring.cid` field is therefore populated only in a canonical anchoring record or an out-of-band envelope, not by rewriting the already-hashed file. When the serialized `domain.md` carries the `documents.anchoring` object, its `cid` **MUST** remain `null`; the resolved IID linked-resource record supplies the exact CID and the runtime validator compares that record to the fetched bytes. Implementations that use a detached signed envelope MAY materialize the CID in the envelope's copy. This distinction removes the self-hash ambiguity.

In `authoring_draft`, linked-document `uri` and `cid` MAY be `null`. From `persisted_draft` onward, both are required and verified. Changing a document changes its CID and the containing `domain.md` bytes, so a new index CID and, for anchored profiles, a new canonical anchor are always required. Review scope may remain targeted according to §14, but integrity re-anchoring is never optional. Staleness is tracked per document via `freshness.max_age`; an old document does not by itself make the index bytes invalid, but it prevents `runtime` conformance when the current task requires that document.

**Authority.** All `documents` resolve at the `domain_md` precedence tier (§6); none may authorize a stateful or value-bearing action. Two role-specific rules:

- A **manifest** (`authority: defining`) is authoritative only for intent, terms, principles, and facts-of-record at issuance. For any fact also represented in canonical state — controller, ownership, balance, claim status — canonical state governs; a stale manifest never overrides it (lint: `manifest-overrides-canonical`).
- A **changelog** (`authority: advisory`) is semantic history: an agent uses it to understand change and flag staleness ("did the rubric or account policy change since this claim was submitted?"), never to authorize. On conflict with canonical state, treat the entry as premature or erroneous and flag.

All other roles are `interpretive` context only.

**Significance — what the changelog records.** An entry is **required** for every §14 security-sensitive change (controllers, rights, accounts, privacy, source\_of\_truth, rubric/evaluation\_kit, agents, manifest), **recommended** for operational changes, and optional for informational ones. Each entry points to the canonical proof (UDID, governance proposal, or rubric CID) and supplies the semantic "what changed and why" that the raw transaction does not.

---

## 5\. IID-property mappings

Each IID property **MUST** carry operating context beyond raw identifiers:

| IID property | Block | Required operating context |
| :---- | :---- | :---- |
| `controllers` | `controllers` | type, role, verification methods, signer addresses, approval threshold/quorum/timelock, limitations, escalation, audit target, agent-controller allowed? |
| `services` | `services` | type, auth method \+ scopes, allowed/forbidden agent uses, data classification, rate limits, fallback, health check, `canonical` vs convenience |
| `resources` / `linkedResource` | `resources` | type, URI/CID/hash, version, owner, update authority, access policy, sensitivity, freshness, `canonical_for`, agent read/cite/transform/write |
| `rights` / `accordedRight` | `rights` | capability format \+ reference, subject/object/action, conditions (flow\_state, claim\_type, max\_value, expiry, role, credential), human-review gate, revocation, audit |
| `claims` / `linkedClaim` | `claims` | collection, claim type \+ schema, evidence requirements, rubric, evaluation kit, allowed outcomes, status, UDID link, visibility, settlement policy |
| `linkedEntity` | `linked_entities` | relationship, direction, role, authority implication, traversal policy, canonical reference |
| `accounts` | `accounts` | address/chain, owner, controllers, authz grants, spending policy, settlement triggers, audit |

---

## 6\. Source-of-truth & conflict resolution

When two sources that are both competent for the same fact disagree, the default order is `source_of_truth.conflict_resolution_order`:

```
protocol_state ▸ iid_document ▸ udid ▸ credential ▸ claim ▸ claim_collection_state ▸ blocksync ▸ matrix_state ▸ domain_md ▸ user_prompt ▸ agent_memory
```

Rules:

- **Authority is scoped by fact.** `source_of_truth.authority_scopes` identifies which source types are competent for controllers, rights, balances, claim status, credential status, Flow state, domain intent, and any custom fact. A source absent from the matching scope is context, not a contender. If no scope covers the disputed fact, stop with `unscoped-authority-conflict`; do not apply the global list mechanically.
- **Blocksync is never independently authoritative.** It is a read projection; on any divergence from `protocol_state`, protocol state governs and the projection is treated as stale.
- **A model response, transcript, scratchpad, or dashboard is never sufficient authority** for settlement, credential issuance, controller change, or high-value state update.
- Prose **MUST NOT** restate a different order. If `domain.md` conflicts with resolved protocol/IID state, the file is wrong (lint: `canonical-conflict`).
- **Linked documents (§4.4) resolve at this `domain_md` tier** — advisory and interpretive, never authorizing. A manifest is additionally authoritative for intent, terms, and facts-of-record at issuance, but defers to canonical state for any on-chain fact.

---

## 7\. Domain-type profiles

A `domain.md` declares exactly one primary `domain.type` and **MAY** add secondary roles. Each type unlocks one conditional top-level block (§4.1).

`domain.class` records lineage; it does not implicitly import authority. When non-null, `domain.class_binding` **MUST** pin an immutable class resource, CID, version, and `local_explicit_only` merge policy. A runtime resolves the class only to validate constraints and defaults explicitly named by that class contract. Controllers, rights, accounts, privacy, agent authority, and value policies **MUST NOT** be inherited by omission. A missing local security-sensitive field is denial or a validation error, never permission inherited through a generic deep merge.

| Type | Required block | Agent-critical additions |
| :---- | :---- | :---- |
| **dao / organisation** | `governance: { proposal_service, voting_policy, quorum_policy, execution_policy, emergency_policy }` | who may draft/submit/vote/execute/veto; member & delegation rules; conflict-of-interest policy; treasury policy; private governance-room boundary |
| **project** | `protocols: [...]` \+ `pods` \+ `claims.collections` \+ `accounts` | lifecycle stage; protocol constraints; field/operator/verifier roles; claim & evidence flows; oracle services; payout/escrow/dispute paths |
| **asset** | `asset: { class, owner, custody_model, transfer_policy, valuation_policy }` | custody & ownership boundary; permitted transfers; provenance/linked claims; valuation evidence; issue/sell/retire/tokenize rights; compliance constraints |
| **deed** | `deed: { mode: request|offer|agreement|fulfillment, requester, provider, terms_resource, claim_collection, fulfillment_flow }` | what is requested/offered; acceptance criteria; instantiated claim collection; fulfillment evidence; settlement conditions; correction path |
| **protocol** | `protocol: { version, schemas, rubrics, compatible_domain_types, governance: { change_policy, deprecation_policy } }` | schema versioning; thresholds/disqualifiers; allowed outcomes; test fixtures; inheritance & migration rules |
| **investment / portfolio** | `investment: { thesis, instruments, investees, risk_policy, reporting_policy, disbursement_policy }` | allowed instruments; diligence resources; MNPI boundary; decision authority; milestone/disbursement claims; portfolio signals; reporting format |

Types without a profile row (`oracle`, `service`, `dataset`, `device`, `place`, `marketplace`, `pod`, `claim_collection`, `custom`) use only core blocks plus any documented `x-*` extension until a versioned profile is added. They **MUST NOT** borrow the required block or authority semantics of a superficially similar type. `dataset` and `device` retain the manifest mappings in §4.4 but have no extra authority-bearing top-level block in this version.

Each type also defines a **manifest** document (§4.4): `charter` for dao/organisation/project/pod, `dossier` for asset, `prospectus` for investment/portfolio, `terms` for deed, `specification` for protocol.

---

## 8\. Agent operating modes

`agent_default_mode.mode` sets a capability **ceiling**:

| Capability | `read_only` | `propose_only` | `bounded_evaluate` | `bounded_execute` |
| :---- | :---: | :---: | :---: | :---: |
| read / summarize | ✓ | ✓ | ✓ | ✓ |
| propose (draft, recommend, flag gaps, propose transition) | — | ✓ | ✓ | ✓ |
| evaluate (create Evaluation Claim) | — | — | ✓¹ | ✓¹ |
| execute transition | — | — | — | ✓² |
| move value / issue / mint / change rights / change rubrics | — | — | — | ✗³ |

¹ permitted claim types only • ² delegated, scoped, with capability ref \+ expiry \+ audit \+ revocation • ³ **never implied by mode** — always requires a specific `rights.entries` grant.

**Authorization resolution** (run per action):

```
allow(action) =
     canonical_action(action) is recognized
 AND mode_ceiling_allows(action)
 AND NOT overrides_disable(action)
 AND no matching, currently-valid deny grant exists
 AND (action ∉ rights.agent_baseline.require_explicit_grant_for
      OR a matching allow grant exists
         AND its capability proof and delegation chain verify
         AND it is not revoked
         AND not_before <= trusted_time < expiry
         AND subject, object, action, value denomination, Flow state, claim type,
             role, credential, and all custom conditions are satisfied)
 AND human review has a verifiable approval proof when required
```

Authorization is default-deny. Deny grants override allow grants at equal or broader scope. Subjects and objects compare by canonical DID/URI/resource identifiers, not display strings. Value limits compare unsigned base-unit integers only when denominations match exactly; conversion and price-oracle logic require a separate governed policy. Time checks use a declared trusted clock and fail closed when clock confidence is insufficient. `overrides` MAY only lower the ceiling. Raising it is invalid (lint: `open-ended-agent-authority`).

**Agentic Oracles** are identity-bound, authority-scoped, evidence-grounded, protocol-governed, and audit-producing. They MAY normalize facts, apply rubrics, recommend, produce determinations, trigger *delegated* actions, and route ambiguity. They MUST NOT silently change rubrics, exceed delegated authority, treat private reasoning as canonical state, or be the sole final authority for material settlement, credentialing, or governance.

---

## 9\. Claims, evidence, rubrics, UDIDs

For every evaluable claim type, `domain.md` MUST specify: schema and version; admissible evidence types with freshness and sensitivity; fact-ledger schema; a pinned rubric resource and version with ordered rules, disqualifiers, and reason codes; allowed outcomes; rights for evaluation and determination; the required UDID schema and record authority; a structured human-review policy; and outcome-specific next transitions or settlement-policy references. Free-form policy prose is explanatory only and cannot authorize an action.

**Evaluate facts, not files.** Evidence is turned into typed facts, then those facts are scored against a governed rubric — an evaluator MUST NOT decide directly over raw files or free-form model text. When a flow reaches a determination point, a **UDID** binds decision, evidence, authority, rubric, and proof trail together; settlement references the UDID, not a chat outcome.

```
claim_types:
  - id: "service_delivery"
    schema: "service-delivery-claim-schema-v1"
    schema_version: "1.0.0"
    fact_schema: "service-delivery-fact-schema-v1"
    evidence_requirements:
      - { resource_id: "field-photo-schema-v1", required: true, max_age: "P30D", sensitivity: "restricted" }
      - { resource_id: "gps-attestation-schema-v1", required: true, max_age: "P30D", sensitivity: "restricted" }
    evaluation_kit: "evaluation-kit-service-delivery-v1"
    rubric:
      resource_id: "rubric-service-delivery-v1"
      version: "1.0.0"
      order: [ "identity", "location", "completion", "quality" ]
      disqualifiers: [ "identity_mismatch", "tampered_evidence" ]
      reason_codes: [ "complete", "insufficient_evidence", "manual_review" ]
    evaluator_right: "right:evidence-oracle:evaluate-service-claim"
    determiner_right: "right:verifier:determine-service-claim"
    udid: { required: true, schema: "resource:service-delivery-udid-v1", record_authority: "right:verifier:determine-service-claim" }
    allowed_outcomes: [ "approved", "rejected", "manual_review_required", "disputed" ]
    human_review_policy:
      required_for: [ "rejected", "disputed", "manual_review_required", "payment" ]
      reviewer_right: "right:verifier:determine-service-claim"
      approval_proof: "udid"
    next_actions:
      - { outcome: "approved", flow_id: "flow:service-delivery", transition: "determined_to_actioned", settlement_policy: "resource:field-service-settlement-v1" }
      - { outcome: "rejected", flow_id: "flow:service-delivery", transition: "determined_to_closed", settlement_policy: null }
```

---

## 10\. PODs, Flows, Matrix

A POD is a secure operating domain where people, agents, services, claims, evidence, credentials, workflows, and value cooperate around a shared purpose — distinguished from a chat/DB/DAO by combining shared state \+ human roles \+ scoped agent authority \+ flows \+ verifiable outcomes.

Each **Flow** MUST define a typed trigger, one initial state, a finite set of unique state identifiers, and explicit transitions. Every transition names its source and target states, required actor rights, evidence, checks, human-review gate, and bounded effects. Transition identifiers, state identifiers, POD identifiers, and right references MUST resolve uniquely. Effects never authorize themselves: payment, credential, mint, burn, or transfer effects still require the matching right, account policy, claim/UDID condition, and human approval. Agents propose transitions; `execute_transition` stays in `disabled_agent_actions` unless explicitly delegated.

**Matrix** is the encrypted communication and shared-state layer (rooms, verifiable history, access controls, SDK surfaces). Reference it for human/agent collaboration and evidence exchange; never publish room history or private payloads to protocol fields.

---

## 11\. Privacy & boundaries

Separate **public protocol metadata** from **private service-layer data**:

- **Protocol layer** MAY publish DIDs, controllers, service/resource/claim references, proofs, and state transitions. It MUST NOT publish evidence payloads, secrets, personal data, or unredacted traces.
- **Service layer** MUST encrypt private evidence, room history, personal data, commercial terms, and regulated data; only references, proofs, or hashes are eligible for public fields.
- Define who may retrieve private payloads, what redaction precedes any citation or summary, and how an unauthorized read fails (`unauthorized_read_behavior`).
- The index itself **MUST NOT** contain credentials, bearer tokens, private keys, seed phrases, raw evidence, personal data, private room history, or sensitive query parameters. Private locators SHOULD be opaque identifiers resolved only after authorization; public URIs MUST NOT reveal confidential path names or identifiers.

---

## 12\. Agent runtime contract

The hot path an agent runs for every task:

1. **Load** — parse safely; validate the declared conformance profile against the matching schema; verify `kind: domain.md`; verify `domain.id` and, for anchored/runtime profiles, `source_of_truth.iid_document`. Treat missing authority as denial.
2. **Resolve** — resolve the current IID/DID document before stateful work; use Blocksync for graph reads only when configured and consistent with protocol state; use Matrix only for permitted context; resolve linked resources by URI/CID/hash and check freshness.
3. **Authorize** — run §8 authorization resolution; check Flow state before any claim, evaluation, payment, credential, or transition.
4. **Act** — cite evidence for every evidence-based output; emit Evaluation Claims where configured; refuse anything exceeding delegated authority.
5. **Record** — write determinations as UDIDs at determination points; log authority, inputs, evidence references, tool results, policy/rubric versions, reason codes, and outputs per the agent's `logging` policy. Never require, store, or expose private chain-of-thought; an audit trace contains decision-relevant facts and reproducible rationale only.
6. **Escalate** — route to human/governance review whenever the action is in `human_review_required_for` or the case is ambiguous, disputed, or high-value.

**Stop and escalate (never auto-proceed) when:** evidence is ambiguous; a claim is disputed; the action is high-value or irreversible; a credential, controller, rights, or rubric change is implied; value moves; or `domain.md` conflicts with resolved protocol/IID state.

**Unknown content:** `x-`\-prefixed keys are allowed; unknown sections are preserved; unknown unprefixed top-level keys warn; duplicate canonical sections error.

---

## 13\. Lint rules

| Rule | Severity | Check |
| :---- | :---- | :---- |
| `missing-frontmatter` | error | File does not start with YAML frontmatter |
| `unsafe-yaml` | error | Duplicate key, alias, anchor, merge key, custom tag, invalid UTF-8, or declared parser limit exceeded |
| `spec-artifact-conflict` | error | Normative prose and matching JSON Schema disagree |
| `invalid-conformance-profile` | error | Declared profile is unknown or its profile-specific invariants fail |
| `template-placeholder` | error | A conforming domain.md contains a template or publish placeholder |
| `invalid-kind` | error | `kind` ≠ `domain.md` |
| `missing-domain-id` | error | `domain.id` absent, or not a DID for anchored/runtime, or not a DID/URN UUID for a draft profile |
| `missing-source-of-truth` | error | No canonical IID/protocol source declared |
| `missing-controller` | error | No primary controller or governance model |
| `missing-rights-baseline` | error | No `rights.agent_baseline` and no `agent_default_mode.mode` |
| `open-ended-agent-authority` | error | `overrides` raise the mode ceiling, or an agent may execute/pay/issue/govern/update state with no scoped right |
| `account-without-policy` | error | Account has no spending/authz policy |
| `claim-without-schema` | error | Claim type lacks a schema |
| `privacy-public-sensitive` | error | Sensitive payload marked public |
| `broken-local-reference` | error | A bare-id reference (resource/right/flow/account) does not resolve in-file |
| `duplicate-entry-id` | error | IDs that share a namespace are not unique after canonical normalization |
| `invalid-class-binding` | error | `domain.class` is set without an immutable class resource, CID, version, and explicit merge policy |
| `invalid-cid` | error | CID is malformed, unsupported, or does not verify the exact fetched bytes |
| `unscoped-authority-conflict` | error | Conflicting facts have no applicable `authority_scopes` rule |
| `invalid-grant` | error | Grant matching, capability/delegation proof, revocation, time, denomination, or condition validation fails |
| `duplicate-section` | error | A canonical Markdown section appears more than once |
| `canonical-conflict` | error | `domain.md` conflicts with resolved IID/protocol state |
| `claim-without-review-path` | warning | Claim evaluation lacks a human-review or dispute path |
| `resource-without-sensitivity` | warning | Resource has no sensitivity/access policy |
| `service-without-auth-boundary` | warning | Service lacks auth method or allowed uses |
| `linked-entity-without-rel` | warning | Linked entity lacks a relationship |
| `stale-domain-index` | warning | `last_updated` older than `validation.stale_after` |
| `section-order` | warning | Canonical sections out of order |
| `prose-conflicts-yaml` | warning | Markdown appears to contradict frontmatter |
| `unknown-top-level-key` | warning | Unprefixed top-level key not in §4.1 |
| `missing-description-doc` | error | No `documents` entry with role `description` |
| `missing-changelog-doc` | error | No `documents` entry with role `changelog` |
| `document-without-cid` | error | A `persisted_draft`, `anchored`, or `runtime` document entry lacks a verified `cid` |
| `duplicate-document-role` | error | A canonical role (`description` / `changelog` / manifest) appears more than once |
| `manifest-overrides-canonical` | error | A manifest asserts a fact that conflicts with canonical state |
| `missing-manifest` | warning | `domain.type` defines a manifest type but no manifest entry exists |
| `operational-doc-expected` | warning | The domain has a surface (governance / agents / PII / flows) with no matching operational doc, not listed in `not_applicable` |
| `document-unanchored` | error for anchored/runtime; warning for drafts | Anchoring method/reference or canonical out-of-band CID evidence is absent or unverifiable |
| `document-pass-mismatch` | warning | `description` / `changelog` / manifest set to a non-standard `disclosure_pass` |
| `incomplete-claim-contract` | error | Evaluable claim lacks schema/version, fact schema, evidence policy, pinned rubric, evaluator/determiner rights, UDID policy, review proof, or next-action mapping |
| `invalid-flow` | error | Flow has missing/duplicate states or transitions, unresolved actor rights, unreachable states, or effects without corresponding policy references |
| `runtime-prerequisite-failed` | error | Runtime profile cannot verify canonical state, required capability, freshness, or review policy |

---

### Active rule registry

| Code | Severity | Description |
| --- | --- | --- |
| `file-too-large` | error | Reject domain input that exceeds the configured byte limit before model construction. |
| `encoding` | error | Require strict UTF-8 without a byte-order mark. |
| `missing-frontmatter` | error | Require YAML frontmatter at the beginning of every domain.md. |
| `frontmatter-fence` | error | Require exactly one valid frontmatter fence at the beginning of the document. |
| `frontmatter-shape` | error | Require frontmatter to decode to a mapping. |
| `unsafe-yaml` | error | Reject duplicate keys, aliases, anchors, custom tags, merge keys, and unsafe YAML limits. |
| `schema` | error | Require frontmatter to satisfy the matching domain.md JSON Schema. |
| `profile-mismatch` | error | Require an asserted profile to match the document profile. |
| `template-placeholder` | error | Reject unresolved authoring or publication placeholders in conforming output. |
| `secret-in-index` | error | Reject secret-bearing fields and private key material. |
| `privacy-public-sensitive` | error | Reject public access for sensitive documents, resources, and services. |
| `duplicate-entry-id` | error | Require controller, right, resource, flow, and transition identifiers to be unique. |
| `duplicate-section` | error | Reject duplicate canonical Markdown sections. |
| `missing-required-section` | error | Require every section declared by validation.required_sections. |
| `section-order` | warning | Report canonical sections that appear out of order. |
| `unknown-section` | info | Preserve and report unknown Markdown sections. |
| `unknown-top-level-key` | warning | Report unknown non-extension frontmatter fields. |
| `document-contract` | error | Enforce universal roles, manifest authority, disclosure, privacy, and profile identity rules. |
| `broken-local-reference` | error | Require locally scoped controller, right, resource, claim, flow, and transition references to resolve. |
| `source-authority` | error | Require fact-scoped authority sources to appear in the conflict-resolution order. |
| `incomplete-claim-contract` | error | Require claim evidence, rubric, determination, review, and next-action contracts. |
| `invalid-flow` | error | Require valid, reachable, right-gated flow transitions and review for consequential effects. |
| `template-contract` | error | Require a pinned protocol, derived type, allowlisted path, parameter schema, and verified file identity. |
| `integrity-mismatch` | error | Reject bytes that do not match their declared SHA-256 digest or CID. |
| `network-policy` | error | Reject unsafe HTTPS or IPFS retrieval, redirects, credentials, and private network targets. |
| `runtime-external-checks-required` | info | Identify checks that static validation cannot prove for anchored and runtime profiles. |

## 14\. Change control

A diff tool classifies changes by operational risk:

- **Security-sensitive — controller/governance review required:** `controllers`, `rights`, `accounts`, `privacy`, `source_of_truth`, `claims.collections.evaluation_kit`, `claims.collections.rubric`, `agents.permitted_outputs`, `agents.forbidden_outputs`, `agent_default_mode`, `critical_do_not`.
- **Operational — domain-operator review required:** `services`, `resources`, `linked_entities`, `pods`, `flows`, `claims.collections.evidence_requirements`, `graph_policy`.
- **Informational — maintainer review only:** `description`, Markdown Overview/Playbooks/Changelog, `x-*` fields.

`validation.review_required_for_changes_to` MUST stay consistent with the security-sensitive set above.

Document roles map onto the same tiers: a **manifest**, `governance`, `data-policy`, `compliance`, and `risk-register` — and any change to a security-sensitive document's `cid`, `update_authority`, `access_policy`, or `sensitivity` — are **security-sensitive**; `operations`, `agents`, and adding or removing operational docs are **operational**; `description` content, appending a `changelog` entry, document `freshness` updates, and `x-*` docs are **informational**.

**Changelog significance.** A `changelog` entry is **required** for every security-sensitive change, **recommended** for operational changes, and optional for informational ones. Each entry points to the canonical proof (UDID, governance proposal, rubric CID) and adds the semantic "what and why" the transaction log omits.

**Specification and migration control.** `version` and `conformance.spec_version` identify this specification, while `document_revision` identifies the domain artifact revision. Backward-compatible schema additions increment the specification minor version; incompatible field, authorization, canonicalization, or profile changes increment the major version. A domain may upgrade only through an explicit migration that records the source/target spec versions, deterministic transformation or manual steps, validation evidence, controller approval, and rollback/supersession policy. Runtime agents **MUST NOT** auto-migrate an authority-bearing document.

---

## 15\. Minimal compliant example

```
---
version: "1.0.0-rc.1"
kind: "domain.md"
conformance:
  spec_version: "1.0.0-rc.1"
  schema: "urn:ixo:domain-md:schema:1.0.0-rc.1"
  profile: "authoring_draft"
document_revision: "0.1.0"
name: "Verified Field Services POD"
description: "Operating index for agents coordinating verified field-service delivery, evidence review, and settlement."
last_updated: "2026-06-27"
domain:
  id: "urn:uuid:123e4567-e89b-42d3-a456-426614174000"
  iid: null
  type: "project"
  class: "did:ixo:entity:protocol:verified-services"
  class_binding: { resource: "ipfs://bafybeigdyrzt", cid: "bafybeigdyrzt", version: "1.0.0", merge_policy: "local_explicit_only" }
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
```

---

## 16\. Production processing and interoperability

A production implementation **MUST** execute these gates in order and emit a machine-readable conformance report:

1. **Acquire bytes** — enforce the declared byte limit before parsing; preserve the exact bytes for CID verification; reject compression bombs and ambiguous character encodings.
2. **Parse safely** — use YAML 1.2 core semantics with duplicate keys, aliases, anchors, merge keys, and custom tags disabled. YAML is data, never executable configuration.
3. **Validate structure** — select `domain-md.schema.json` by the exact declared spec version; reject unavailable or mismatched schema artifacts; apply profile-specific JSON Schema rules.
4. **Validate semantics** — run §13 lints, unique-ID and local-reference checks, class-binding checks, graph/Flow reachability, denomination-safe value checks, and prose/frontmatter consistency checks.
5. **Verify integrity** — verify each required CID over the exact returned bytes using supported multicodecs and hashes. Do not assume that two storage systems produce equivalent CIDs unless their codec, chunking, and hash contracts are explicitly compatible.
6. **Resolve runtime state** — for `anchored` and `runtime`, resolve canonical IID/protocol state and anchoring evidence, then apply fact-scoped conflict resolution.
7. **Authorize per action** — verify mode ceiling, deny/allow grants, capability/delegation proofs, revocation, trusted time, conditions, Flow state, value denomination, account policy, and human-review proof.
8. **Report** — return spec version, profile, input digest/CID, schema identity, validator version, errors, warnings, resolved canonical references, capability evidence identifiers, and final state. Never include secrets or private evidence in the report.

External retrieval **MUST** use an allowlist of schemes and destinations, block loopback/link-local/private-network targets unless explicitly configured, cap redirects and response bytes, separate authenticated from public fetches, and avoid forwarding authorization headers across origins. Mutable HTTP responses are context only unless verified against an immutable CID or digest.

Conformance fixtures **MUST** include valid authoring, persisted, anchored, and runtime examples plus failures for unsafe YAML, duplicate IDs, invalid class binding, missing CIDs, CID mismatch, stale required documents, broken references, deny/allow conflicts, expired/revoked capabilities, denomination mismatch, incomplete claim contracts, invalid/unreachable Flow transitions, private-data leakage, and canonical-state conflict.

Promotion from `1.0.0-rc.1` to `1.0.0` requires passing the same fixture corpus in at least two independent validators and completing interoperability tests against the production IID resolver, linked-resource anchoring path, content-addressed storage, capability verifier, and one end-to-end claim → UDID → reviewed settlement loop.

---

## 17\. Adoption path

Start with one complete operating loop, then scale:

one domain → one POD → one Claim Collection → one claim type → one evidence schema → one rubric → one Flow → one scoped agent → one human-review path → one UDID determination → one settlement policy (if value moves).

Test the complete, incomplete, rejected, disputed, and edge-case submissions before adding a second loop.

---

## 18\. Verified protocol-template manifests

A protocol MAY publish a template manifest with `kind: domain.md/template-manifest` to offer deterministic
starting bundles for derived domains. The matching `template-manifest.schema.json` is normative. Package and
specification versions remain independent; a manifest's `version` selects this specification, while
`protocol_version` and each `bundle_version` identify independently governed protocol artifacts.

Each bundle declares one `derived_type` and an allowlisted set of files. Every file entry MUST declare a
recognized `role`, a relative `.tmpl` path under `templates/<type>/`, a recognized media type, `max_bytes`, a
required/optional flag, and at least one immutable SHA-256 or CID identity. A bundle MUST contain exactly one
required Markdown file with role `domain.md`. Bundle types and logical paths MUST be unique within their
respective scopes. Paths containing traversal, absolute paths, ambiguous separators, or symbolic links are
invalid.

Remote HTTPS manifests MUST be pinned by SHA-256 or CID before their bytes are parsed. An `ipfs://` root URI
is pinned by its CID; an IPFS URI below the root additionally requires a manifest SHA-256. IPFS resolution
requires an explicitly configured HTTPS gateway. HTTPS resolution MUST reject credentials in URLs,
non-HTTPS redirects, private/reserved/link-local/loopback destinations, DNS rebinding, excess redirects,
timeouts, oversized responses, and resolver results that cross from a remote manifest to a local file.
Native IXO VFS resolution is outside this release until a stable endpoint, authentication model, and
capability contract are normative.

A Markdown `domain.md.tmpl` MUST carry an `x-template` mapping that binds the exact protocol DID, derived
type, template version, and parameter declarations. Typed YAML substitutions use a whole-node
`{$param: name}` form only. Markdown prose substitutions use declared `{{name}}` markers only and are
escaped as Markdown text. Unknown parameters, unresolved parameters, type mismatches, unresolved markers,
and required declarations that are never used are errors. Conforming rendered output contains no
`x-template` metadata or template markers.

Initialization is a local authoring operation, not an authority-bearing action. A renderer MUST generate a
deterministic `urn:uuid` draft identity from the verified template and parameter inputs, set unresolved IID
and receipt/CID values to YAML `null`, produce a provenance record containing source identities and output
digests but not raw parameter values, and run full static `authoring_draft` validation. It MUST render into a
temporary sibling directory and atomically rename only after validation succeeds. It MUST NOT overwrite a
non-empty target, persist to VFS, anchor, publish, register an entity, execute a Flow, grant a right, or move
value.

---

## Grounding

Builds on IXO primitives: DID-anchored IID entity domains (controllers, services, resources, accorded rights, linked claims/entities, accounts); IXO Protocol state truth with Blocksync as an indexed read projection; IXO Matrix as the encrypted collaboration layer; PODs and Qi Flows for coordinated workflows; UDIDs for determination provenance; Agentic Oracles as authority-scoped, evidence-grounded, audit-producing agents; and the claim-evaluation protocol (typed facts → governed rubric → recorded decision). Structurally it follows the `DESIGN.md` pattern: normative YAML tokens first, ordered `##` prose second, explicit consumer behavior for unknown and duplicate content.
