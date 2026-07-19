# x-oracle-capsule experimental architecture decision

- Status: proposed for independent architecture and security review
- Contract status: experimental, pre-schema
- Decision owner: Oracle Capsule project architecture reviewers
- Implementation gate: IXO-3752

## Decision

An Oracle Capsule is a portable, immutable release description for one Agentic Oracle. It binds one Oracle identity `domain.md`, exactly one pinned Master skill, the runtime contract it expects, requested tool capabilities, effect ceilings, and build provenance. A capsule never replaces live IXO authority, subject-domain policy, evidence, Flow state, human approval, or signer receipts.

The portable contract has three layers:

1. An Oracle identity `domain.md` uses the top-level `x-oracle-capsule` extension to point to one immutable companion manifest.
2. The companion manifest describes one immutable capsule release and content-addresses every executable or policy-bearing artifact in that release.
3. A conforming runtime supplies the minimal kernel, verifies the release, resolves live authority and revocation state, activates only effective tools, records the run, and refuses any request outside the intersection of all applicable ceilings.

This design is host-neutral. Codex, Claude, CLI, MCP, or another model host may provide a reasoning shell, but the host is not the authority provider, durable state store, verifier, signer, revocation registry, or audit ledger.

## Contract identity and package boundaries

The first experimental contract is identified as follows:

| Item                  | Frozen value                                                                  |
| --------------------- | ----------------------------------------------------------------------------- |
| Extension key         | `x-oracle-capsule`                                                            |
| Manifest `apiVersion` | `ixo.earth/oracle-capsule/v0alpha1`                                           |
| Manifest `kind`       | `OracleCapsuleRelease`                                                        |
| Schema URI            | `urn:ixo:domain-md:x-oracle-capsule:manifest:0.1.0`                           |
| Media type            | `application/vnd.ixo.oracle-capsule+json`                                     |
| Digest                | SHA-256 over the exact fetched bytes                                          |
| Content address       | CIDv1 using the raw codec and SHA2-256 multihash over the exact fetched bytes |
| Text encoding         | UTF-8 without a byte-order mark                                               |

The schema URI names a versioned contract; it is not a network authority. The schema and validator shipped by `domain.md` are authoritative for static conformance at that version. A resolver MUST NOT fetch a mutable schema at runtime and silently change validation semantics.

The capsule is not a monolithic mutable workspace. Its package boundaries are:

- **Oracle identity document:** the anchored `domain.md` for the Oracle DID/IID. It owns identity and operating context.
- **Companion manifest:** a small immutable JSON document referenced by `x-oracle-capsule`. It owns release composition and constraints, but grants no live authority.
- **Master skill artifact:** exactly one immutable source bundle. Its lock lists every relative path, byte length, and SHA-256 digest. Extraction rejects links, devices, absolute paths, traversal, duplicate paths, and content beyond declared limits.
- **Tool adapters:** runtime-supplied implementations identified by contract and digest. They are not embedded secrets and are activated only after policy resolution.
- **Runtime state:** memory, traces, receipts, Flow state, evidence, credentials, and secrets are never part of the release package.
- **Host adapter:** host-specific transport and presentation code. It may narrow behavior but MUST NOT reinterpret the portable contract, add authority, or weaken a kernel invariant.

The manifest and artifact locks use deterministic JSON serialization for generated hashes and signatures: UTF-8 JSON with object keys sorted by Unicode code unit, arrays kept in declared order, no insignificant whitespace, and numbers restricted to safe integers. The authoritative content address still covers the exact published bytes. The companion schema will make unsafe numeric or ambiguous values invalid.

## `domain.md` binding

The `x-oracle-capsule` value in the Oracle identity document will contain only the immutable binding needed to discover and verify the companion manifest:

| Field                 | Meaning                                 | Static enforcement                     |
| --------------------- | --------------------------------------- | -------------------------------------- |
| `contract`            | Exact experimental contract identifier  | Known constant for this schema version |
| `manifest.uri`        | Allowlisted immutable resolution URI    | URI syntax and allowed scheme          |
| `manifest.cid`        | CIDv1 of the exact manifest bytes       | CID syntax and supported codec/hash    |
| `manifest.sha256`     | Hex SHA-256 of the exact manifest bytes | Digest syntax                          |
| `manifest.media_type` | Companion media type                    | Exact frozen value                     |
| `manifest.schema`     | Versioned schema URI                    | Exact frozen value                     |
| `manifest.version`    | Capsule release semantic version        | SemVer syntax                          |

For an anchored or runtime profile, the Oracle identity document itself remains subject to the existing `documents.anchoring` and source-of-truth checks. The extension does not inherit authority through `domain.class_binding`, does not add a conditional Oracle profile, and does not reinterpret ordinary `documents`, `resources`, `services`, `agents`, or `rights` entries.

Those existing blocks remain useful without duplication:

- `domain.class_binding` may pin lineage constraints, using `local_explicit_only`; it cannot supply omitted authority or capsule state.
- `documents` contains human operating context. A risk register, data policy, and pilot authorization may be linked here with their existing authority and sensitivity semantics.
- `resources` contains canonical machine artifacts such as schemas, rubrics, evidence definitions, and evaluation kits. A capsule references their verified IDs or CIDs for a run; it does not copy or override them.
- `services` identifies resolvers, evidence stores, claim APIs, authority services, and other endpoints. Their live responses still require protocol-specific verification.
- `agents` declares the Oracle identity, ceilings, permitted context and outputs, forbidden outputs, and logging obligations. The capsule can only narrow these declarations.
- `rights` declares scoped grants and revocation methods. Manifest `requestedCapabilities` are requests, never grants.
- `source_of_truth` decides fact-scoped authority conflicts. The manifest, Master skill, prompt, memory, transcript, and model output are not added as canonical sources.

Until a versioned Oracle profile is separately standardized, `domain.type: oracle` continues to use the core specification plus this documented experimental extension.

## One owner and one enforcement point

Every security-relevant fact has one owning artifact and one primary enforcement point. Other layers may verify or narrow it, but may not redefine it.

| Fact or field group                                                                        | Owning artifact/source                                          | Primary enforcement point                            |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------- |
| Oracle DID/IID, controllers, service and resource registry                                 | Canonical IID/protocol state referenced by Oracle `domain.md`   | IID/protocol resolver                                |
| Operating context, source precedence, privacy, declared agent ceiling                      | Oracle identity `domain.md`                                     | `domain.md` runtime conformance gate                 |
| Subject claim schema, admissible evidence, rubric, outcomes, UDID and human-review policy  | Pinned subject-domain `domain.md` resources and canonical state | Evaluation preflight and subject-policy evaluator    |
| Capsule release name, version, artifact inventory, Master entrypoint, kernel compatibility | Companion manifest                                              | Capsule resolver before bootstrap                    |
| Artifact bytes and file inventory                                                          | Artifact CID/digest and source lock                             | Capsule resolver/extractor                           |
| Requested tool capabilities                                                                | Companion manifest                                              | Capability planner; request only                     |
| Effective tool authority                                                                   | Live, unexpired, unrevoked DID/capability grants                | Runtime capability gate immediately before each call |
| Revocation and trusted time                                                                | Canonical revocation provider and declared trusted clock        | Runtime authority provider                           |
| Flow state and permitted transition                                                        | Canonical Qi Flow/protocol state                                | Flow transition adapter                              |
| Evidence bytes, disclosure, consent and decryption rights                                  | Canonical evidence store plus subject policy and live grants    | Evidence adapter before disclosure                   |
| Human review or pilot authorization                                                        | Signed approval record from the named authority                 | Runtime review gate                                  |
| Signing or value movement                                                                  | External signer plus live authorization                         | Signer adapter; never the model host                 |
| Run inputs, policy/source pins, tool results, outputs and decisions                        | Runtime trace and receipt ledger                                | Runtime recorder and receipt verifier                |
| Prompt and transient model output                                                          | Model host session                                              | No authority; input/output filter only               |
| Durable memory                                                                             | Runtime memory store under class policy                         | Memory adapter                                       |

If two artifacts appear to own the same fact, resolution stops. The runtime applies the existing fact-scoped `source_of_truth.authority_scopes`; it never invents precedence from document order or model confidence.

## Minimal immutable host kernel

Only the following invariants are kernel responsibilities. They cannot be delegated to, overridden by, or rewritten by the Master skill:

1. Load the Oracle identity document and validate its declared conformance profile without downgrade.
2. Resolve the companion manifest and every artifact through allowlisted schemes with path, redirect, size, decompression, and network-boundary controls; verify both CID and SHA-256 before parsing or execution.
3. Enforce one immutable Master skill and refuse extra, missing, transformed, or unlocked executable files.
4. Compute the effective operating ceiling as the intersection of the identity document, capsule constraints, run authorization, live capabilities, subject-domain policy, and runtime policy. Missing, stale, conflicting, or unverifiable authority means denial.
5. Expose only tools named by the verified manifest and allowed by the effective ceiling. Re-check audience, action, object, nonce, time, revocation, and value limits immediately before every invocation.
6. Keep resolution, authority, state, signing, secrets, disclosure control, and receipt generation outside the model context.
7. Separate the four memory classes below and prohibit writes that cross class, workspace, subject, or run boundaries.
8. Record a hash-chained, secret-redacted trace and a verifiable run receipt bound to all source, policy, authority, tool, input, output, and human-review references needed for replay.
9. Require the named human review when policy demands it; stop rather than translate a recommendation into a protected effect.
10. Reject runtime self-modification. A run cannot change its identity document, manifest, Master artifact, kernel, policy, source pins, tool contracts, or receipt history.

The Master skill may orchestrate reasoning, normalization, evaluation, explanation, routing, and calls to exposed tools. It may not decide what is authoritative, activate tools, read secrets directly, suppress receipts, approve its own protected output, or change any kernel invariant.

The base prompt is presentation and task context only. Prompt text has lower authority than protocol state, the Oracle and subject domain documents, the manifest, runtime policy, and live capability decisions. Prompt injection is treated as untrusted data, including when it appears inside evidence or retrieved resources.

## Static and runtime conformance

Static and runtime conformance are separate verdicts.

**Static conformance** validates local structure and internally checkable integrity: extension and manifest schemas, declared versions, URI/CID/digest syntax, semantic references, one Master entry, lock completeness, duplicate or unsafe paths, declared ceilings, compatibility declarations, and changes that require security review. Static success does not prove that a URI resolves, a CID is current in canonical state, a capability is unrevoked, a clock is trusted, evidence may be disclosed, or a signer will authorize an action.

**Runtime conformance** resolves and verifies the exact bytes, current IID/DID and subject state, capability chain and revocation, trusted time, Flow state, evidence access and consent, human approvals, tool contract, trace chain, receipt signature, and replay inputs. A runtime verdict is scoped to a named release, run authorization, subject, time, and source set. It expires when any live dependency or authorization does.

The runtime MUST emit both verdicts and MUST NOT report the capsule as executable when either is missing or failed.

## Version, update, rollback and revocation

- A release is immutable. Any byte or semantic change creates a new manifest CID and release version.
- Patch versions may clarify metadata or fix behavior without changing fields, authority meaning, required kernel features, tool contracts, or outputs. Minor versions may add optional fields or compatible features. Major versions change interpretation, authority, canonicalization, required controls, or compatibility.
- `apiVersion` controls the contract. `metadata.release` controls the Oracle release. A runtime explicitly lists supported contract majors and kernel features; it never silently downgrades or auto-migrates.
- A new release may name exactly one `supersedes` manifest CID. Supersession is history, not activation. The active release is selected by a separate signed deployment or run authorization from the declared authority.
- Rollback is an explicit activation of a previously approved, compatible, unrevoked release. It requires a recorded reason and human authority. Rollback never deletes or rewrites later releases, traces, or receipts.
- Revocation applies independently to the Oracle identity/controller state, capsule release, Master artifact, tool adapter, capability, subject policy/resource, signer key, and run authorization. Revoking one invalidates any run that depends on it.
- The runtime checks current revocation and trusted time at bootstrap and immediately before every protected tool call. The experimental shadow pilot has no offline grace period. An unavailable or ambiguous revocation source fails closed.
- In-flight revocation stops new tool calls, marks the run interrupted, preserves the trace, and emits a non-success receipt. Already committed canonical state is never locally rolled back by the capsule.

These rules are directly testable with digest mismatch, unsupported contract, downgrade, supersession-without-activation, revoked release/artifact/capability/key, stale clock, and mid-run revocation fixtures.

## Memory classes

The runtime exposes four non-overlapping classes. The model receives only the minimum authorized projection of each class.

| Class                 | Purpose                                                                                    | Persistence and authority                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ephemeral_working`   | Current model context, scratch computation, and transient tool arguments                   | Run-scoped, non-authoritative, destroyed at run end; private chain-of-thought is neither requested nor stored                                     |
| `session_operational` | Checkpoints, normalized facts, pending review items, and resumable workflow state          | Encrypted, workspace/run scoped, retention-bound; never canonical IXO state                                                                       |
| `subject_record`      | Authorized durable facts or references needed across runs for the same subject             | Encrypted and purpose/subject scoped; writes require an explicit memory capability and provenance; canonical facts remain in their owning systems |
| `audit_record`        | Hash-chained traces, decisions, tool receipts, approvals, source pins, and replay metadata | Append-only, secret-redacted, retention-governed; authoritative only as evidence that the recorded run occurred                                   |

Raw secrets, private keys, decrypted evidence beyond authorized retention, and hidden chain-of-thought are prohibited in all four classes. A Master skill cannot change class policy, retention, encryption, access, or deletion rules.

## Shadow-pilot risk ceiling

The first pilot is a development-authority, shadow evaluation of the Livelihoods Contract Verification Oracle. It is advisory only.

Allowed effects are limited to reading an explicitly authorized evidence set, normalizing typed facts, applying one pinned approved rubric, producing a draft evaluation and reason codes, requesting human review, and writing development-scoped trace/receipt artifacts. The Oracle is not the Independent Evaluation Owner and its confidence score is never approval.

The pilot MUST NOT:

- issue a final claim determination, approve or reject payment, move value, broadcast a transaction, or call a production signer;
- issue or revoke a credential, mutate a DID/IID, controller, right, governance rule, rubric, evidence record, Flow state, or production state;
- delete evidence, change retention, broaden disclosure, decrypt without an explicit right, or persist raw decrypted evidence outside the authorized session;
- approve its own output, bypass the Independent Evaluation Owner, or continue when confidence is below the approved threshold;
- run with production authority, an unpinned rubric, unresolved consent/decryption rights, missing human reviewer, or incomplete audit configuration.

Confidence below 98 percent routes to human review; it does not become a negative outcome. The run also stops on any source-lock or CID mismatch, unsupported or revoked dependency, unavailable trusted clock/revocation provider, authority conflict, prompt-injection control failure, unexpected tool, evidence outside the authorized set, receipt-chain failure, or attempted protected effect.

The following launch inputs remain intentionally unresolved and block pilot packaging or execution, not the companion schema:

| Open decision                                                       | Required owner/approval                  | Blocks                               |
| ------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------ |
| Exact evidence corpus and legal basis for its use                   | Evidence controller and pilot data owner | IXO-3760, IXO-3761                   |
| Consent, disclosure, decryption, retention and deletion policy      | Governance/Risk and evidence controller  | IXO-3760, IXO-3761                   |
| Approved rubric version, disqualifiers and reason codes             | Methodology/rubric owner                 | IXO-3760, IXO-3761                   |
| Independent Evaluation Owner and human reviewer identities          | Pilot authority owner                    | IXO-3760, IXO-3761                   |
| Development authority issuer, trusted clock and revocation provider | Runtime/security owner                   | IXO-3756, IXO-3760                   |
| Production signer/AuthZ design and endpoint                         | Runtime/security owner                   | Production use; not the shadow pilot |

No unresolved decision in this table changes the field ownership, media type, schema identity, package boundary, hashing, versioning, or revocation semantics needed to draft the companion schema.

## Consequences and downstream gates

- IXO-3753 may draft the extension and manifest schemas, validator rules, source lock, positive fixtures, and negative security fixtures only after this decision and the threat model receive independent review.
- IXO-3754 may classify changes to `x-oracle-capsule` as security-sensitive despite the base specification's informational default for generic `x-*` fields.
- IXO-3755 through IXO-3758 implement resolution, kernel bootstrap, capability enforcement, memory, trace, receipt, and replay against this contract; they do not move portable authority into `qi-runtimes`.
- IXO-3759 proves cross-repository and installed-host conformance. Green CI alone is not a runtime or pilot-readiness verdict.
- IXO-3760 and IXO-3761 remain blocked until the pilot launch inputs above are explicitly approved and recorded.
- Standardization into a normative Oracle profile is deferred to IXO-3762 and requires evidence from the shadow pilot and audit.
